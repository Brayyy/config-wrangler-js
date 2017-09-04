var configEEC = require('../index.js');

var configEECSetup = {
	etcdNameSpace: 'cfg/flash-service/',
	envNameSpace: 'FLASH'
};


function loadConfig () {
	var start = Date.now();
	configEEC.load(configEECSetup, function (err, config) {
		var bench = 'Took ' + (Date.now() - start) + 'ms';
		if (err) {
			console.log('LOAD ERROR.' + bench, err);
		} else {
			console.log('LOAD OK.' + bench);
			console.log(JSON.stringify(config, null, 4));
		}
	});
}

function reloadConfig () {
	var start = Date.now();
	configEEC.load(null, function (err, config) {
		var bench = 'Took ' + (Date.now() - start) + 'ms';
		if (err) {
			console.log('LOAD ERROR.' + bench, err);
		} else {
			console.log('LOAD OK.' + bench);
			console.log(JSON.stringify(config, null, 4));
		}
		setTimeout(reloadConfig, 1000);
	});
}

function beginWatch () {
	setTimeout(function () {
		console.log('WATCH init');
		var start = Date.now();
		configEEC.watch(function (err, config) {
			var bench = 'Took ' + (Date.now() - start) + 'ms';
			if (err) {
				console.log('WATCH ERROR.' + bench, err);
			} else {
				console.log('WATCH OK.' + bench);
				console.log(JSON.stringify(config, null, 4));
			}
		});
	}, 2000);
}

// Test initial load
loadConfig();

// Test repeated load()
// setInterval(loadConfig, 3000);

// Test manual reloading of config
// reloadConfig();

// Test watch
beginWatch();
