var http = require('http');
var runSeries = require('run-series');
// var debug = require('debug')('config-wrangler');

var etcRetryDelay = 3000;
var mConfig = {};
var foundVars = {};

function stripLowerCamel (str, prefix) {
	if (prefix) str = str.substring(prefix.length);
	str = str.toLowerCase();
	return str.replace(/[^A-Za-z0-9]/g, ' ').replace(/^\w|[A-Z]|\b\w|\s+/g, function (match, index) {
		if (+match === 0 || match === '-' || match === '.') {
			return '';
		}
		return index === 0 ? match.toLowerCase() : match.toUpperCase();
	});
}

function b64Encode (str) {
	return new Buffer(str).toString('base64');
}

function b64Decode (buf) {
	return new Buffer(buf, 'base64').toString('ascii');
}

function etcdHttpInner (isWatch, postCallback) {
	var f = 'etcdHttpInner()';

	//  HTTP host+port to find etcd API
	var etcdConn = process.env.ETCD_CONN || 'http://localhost:2379';
	// debug(f + ' etcdConn:', etcdConn);

	// HTTP path to post against. Watch differs from query.
	var etcdPath = mConfig.etcdApiPath || 'v3alpha';
	etcdPath = '/' + etcdPath + (isWatch ? '/watch' : '/kv/range');
	// debug(f + ' etcdPath:', etcdPath);

	// Post data includes the Etcd key range
	var postData = {
		key: b64Encode(mConfig.etcdNameSpace),
		range_end: b64Encode(mConfig.etcdNameSpace + 'zzzzz')
	};
	if (isWatch) postData = { create_request: postData };
	postData = JSON.stringify(postData);
	// debug(f + ' postData:', postData);

	// An object of options to indicate where to post to
	var connParts = etcdConn.replace('http://', '').split(':');
	var requestOptions = {
		host: connParts[0],
		port: connParts[1],
		path: etcdPath,
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Content-Length': Buffer.byteLength(postData)
		}
	};
	// debug(f + ' requestOptions:', requestOptions);

	// console.log('  # curl http://' + connParts[0] + ':' + connParts[1] +
	// 	etcdPath + ' -X POST -d \'' + postData + '\'');

	// Data collected from responses
	var data = '';

	// Set up the request
	var postReq = http.request(requestOptions, function (res) {
		res.setEncoding('utf8');
		res.on('data', function (chunk) {
			if (isWatch && chunk !== '') {
				// debug(f + ' done (hit res.on(data)');
				postCallback(null, chunk);
			}
			data += chunk;
		});
		res.on('end', function () {
			// debug(f + ' done (hit res.on(end)');
			postCallback(null, data);
		});
	});

	// Handle error
	postReq.on('error', function (err) {
		console.error(f, 'http.request error, will retry:', err.code);
		setTimeout(function () {
			etcdHttpInner(isWatch, postCallback);
		}, etcRetryDelay);
	});

	// Post the data
	postReq.write(postData);
	postReq.end();
}

function etcdHttp (isWatch, postCallback) {
	// debug('etcdHttp()');
	etcdHttpInner(isWatch, function (err, data) {
		if (err) {
			postCallback(err, data);
		} else {
			try {
				data = JSON.parse(data);
				if (isWatch) {
					if (data.result && data.result.events) {
						postCallback(err, data);
					} else {
						// no-op
						// postCallback('No events in watch response', data);
					}
				} else if (data.kvs) {
					postCallback(err, data.kvs);
				} else {
					postCallback('No kvs found in query response', null);
					console.error(data);
				}
			} catch (e) {
				postCallback(e, data);
			}
		}
	});
}

function queryEtcd (callback) {
	// debug('queryEtcd()');
	if (!mConfig.etcdNameSpace) {
		// debug('queryEtcd() done (no-op)');
		return callback(null);
	}

	etcdHttp(false, function (err, data) {
		if (!err && data) {
			// debug('queryEtcd() no error');
			data.forEach(function (etcdItem) {
				// debug('queryEtcd() etcdItem: ', etcdItem);
				// Decode key/value
				var key = b64Decode(etcdItem.key);
				var value = b64Decode(etcdItem.value);
				// Standardize the key
				var newKey = stripLowerCamel(key, mConfig.etcdNameSpace);
				foundVars[newKey] = value;
			}, this);
		}
		// debug('queryEtcd() done');
		callback(err);
	});
}

function queryEnv (callback) {
	if (!mConfig.envNameSpace) {
		// debug('queryEnv() done (no-op)');
		return callback(null);
	}
	var envPrefix = mConfig.envNameSpace + '_';
	Object.keys(process.env).forEach(function (envKey) {
		// Skip env keys which don't start with prefix
		if (envKey.substring(0, envPrefix.length) === envPrefix) {
			// Standardize the key
			var newKey = stripLowerCamel(envKey, envPrefix);
			foundVars[newKey] = process.env[envKey];
		}
	});
	// debug('queryEnv() done');
	callback(null);
}

function queryArgs (callback) {
	process.argv.forEach(function (val) {
		// Skip args that don't start with "--"
		if (val.substring(0, 2) === '--') {
			// Break apart key/value
			var argParts = val.substring(2).split('=', 2);
			if (argParts.length > 1) {
				// Standardize the key
				var newKey = stripLowerCamel(argParts[0], false);
				foundVars[newKey] = argParts[1];
			}
		}
	});
	// debug('queryArgs() done');
	callback(null);
}

/**
 * Set configuration of module
 * @param {*} mConfigIn Config data object passed in
 */
exports.config = function (mConfigIn) {
	// debug('options() setting config');
	mConfig = mConfigIn;
};

/**
 * Load config from all sources and return composite object of keys/values
 * @param {*} watchCallback Function to call after config is fetched from all sources
 */
exports.load = function (loadCallback) {
	// debug('load()');
	foundVars = {};
	runSeries([
		queryEtcd,
		queryEnv,
		queryArgs
	], function (err) {
		// If requiredKeys is defined, verify they all exist
		if (mConfig.requiredKeys) {
			mConfig.requiredKeys.forEach(function (key) {
				if (foundVars[key] === undefined) {
					console.error('config-wrangler: Missing required config key "' + key + '", exiting.');
					process.exit();
				}
			}, this);
		}
		// Sort keys alphabetically
		var orderedVars = {};
		Object.keys(foundVars).sort().forEach(function (key) {
			orderedVars[key] = foundVars[key];
		});
		// debug('load() complete');
		loadCallback(err, orderedVars);
	});
};

/**
 * Watch for Etcd changes for configured namespace
 * @param {*} watchCallback Function to call when anything in namespace is changed
 */
exports.watch = function (watchCallback) {
	// debug('watch()');
	if (!mConfig.etcdNameSpace) {
		// debug('watch() done. etcdNameSpace not defined');
		return;
	}
	etcdHttp(true, function (err, data) {
		if (!err && data) {
			// debug('watch() triggered');
			exports.load(null, function (err, vars) {
				// debug('watch() back from load()');
				watchCallback(err, vars);
			});
		}
	});
};
