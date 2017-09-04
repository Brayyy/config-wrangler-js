# Config-EEC for Node.js
#### A standardized way to get configuration into your script using Etcd, environment vars and command line arguments

I was searching for a clear, simple, standardized and portable way to import config into projects, and to my surprise I couldn't find anything like that. So, I'm working on creating a collection of modules or includes for various languages I work in, in order to standardize the way that things are done.

By using this module, variables are read from three sources, in this order:
1. Etcd v3 service
2. Environment variables
3. Command line arguments

Variables are overridden if they are redefined during that order. Meaning that if variable "port" is defined in Etcd, it can be overridden by ENV, and both Etcd and ENV can be overridden by command line argument. The key format is standardized, as to further reduce guesswork. Etcd keys are pretended by namespace, and are "lower-kebab-case". Environment variables are are prepended by namespace, and are "UPPER_SNAKE_CASE". Command line arguments are "lower-kebab-case", starting with "--". The Config-EEC module returns all keys as "camelCase", normalizing how config appears in code.

## Example
Hypothetical web project is configured as so in Python or PHP:
```javascript
var configEEC = require('config-eec');

var configEECSetup = {
	etcdNameSpace: 'cfg/web-service/',
	envNameSpace: 'WEBSVC'
};

var start = Date.now();
configEEC.load(configEECSetup, function (err, config) {
  var bench = 'Took ' + (Date.now() - start) + 'ms';
  if (err) {
    console.log('LOAD ERROR.' + bench, err);
    process.exit();
  }
  console.log('LOAD OK.' + bench);
  console.log(JSON.stringify(config, null, 4));
});
```

Config is now available to project in three different formats:

| Etcd key | Env key | CLI key | Code result |
| - | - | - | - |
| cfg/web-service/port | WEBSVC_PORT | --port | config['port'] |
| cfg/web-service/server-name | WEBSVC_SERVER_NAME | --server-name | config['serverName'] |
| cfg/web-service/max-connects | WEBSVC_MAX_CONNECTS | --max-connects | config['maxConnects'] |
| cfg/web-service/time-out-ms | WEBSVC_TIME_OUT_MS | --time-out-ms | config['timeOutMs'] |

```bash
# Assuming Etcd has all of the above keys configured,
# they can be overridden by ENV by doing:
export WEBSVC_MAX_CONNECTS=100
export WEBSVC_SERVER_NAME="New staging server"
node someScript.js

# And they can be overridden again by using CLI arguments:
node someScript.js --max-connects=50 --server-name="Test server"
```

The configuration is now agnostic of the language of the script/service. The example above could have been PHP, Python or Node.js, being configured the same way.

## Notes
- The Etcd server can be overridden by using the environment variable `ETCD_CONN`, defaulting to `http://localhost:2379`.
- This module make use of Etcd v3 gRPC JSON proxy. Currently, the gRPC proxy has a prefix of /v3alpha, which I don't expect to be dropped any time soon, but I'm making it configurable as well.
- I could have used gRPC without the JSON proxy, however that adds additional weight to the modules, and in some cases far outweighs the project I'm trying to augment.
