# Config Wrangler for Node.js
#### Load Etcd v3 keys, environment vars, and command line arguments in a predictable, standardized way.

I was searching for a simple, lightweight and standardized way to import config into projects, and to my surprise I couldn't find anything like that. So, I'm working on creating a collection of modules or includes for various languages I work in, in order to standardize the way that things are done.

Main goals:
- Load variables from Etcd v3, environment variables, command line arguments.
- Be extremely light weight, and have few or no dependencies.
- Simplify origin of keys in Etcd and Env. Each project should have it's own namespace, no common namespace.
- Predictable outcome between each language Config Wrangler is written in.
- Ability to reload sources by calling load function again.
- If the language supports async, have a watch function notify when a change occurs.

By using this module, variables are read from these sources in this order:
1. Etcd v3 keys
2. Environment variables
3. Command line arguments

Variables are overridden if they are redefined during that order. Meaning that if variable "port" is defined in Etcd, it can be overridden by ENV, and both Etcd and ENV can be overridden by command line argument. The key format is standardized, as to further reduce guesswork. Etcd keys are pretended by namespace, and are "lower-kebab-case". Environment variables are are prepended by namespace, and are "UPPER_SNAKE_CASE". Command line arguments are "lower-kebab-case", starting with "--". The config-wrangler module returns all keys as "camelCase", normalizing how config appears in code.

## Example
```javascript
// Load module
var configWrangler = require('config-wrangler');

// Global keeper of script config
GLOBAL.config = {};

// Set config-wrangler configuration
configWrangler.config({
  etcdNameSpace: 'cfg/web-service/',
  envNameSpace: 'WEBSVC',
  requiredKeys: ['port', 'serverName', 'maxConnects']
});

// Load config, and return contents in a callback. Save config into a global.
configWrangler.load(function (err, newConfig) {
  if (err) {
    console.error('Configuration load error.', err);
    process.exit();
  }
  GLOBAL.config = newConfig;
  // Configuration loaded, continue project code...
});

// Optionally watch for config changes, update global with new config.
configWrangler.watch(function (err, newConfig) {
  if (!err) {
    console.log('Configuration has been updated.');
    GLOBAL.config = newConfig;
  }
});
```

Config is now available to project in three different formats:

| Etcd key | Env key | CLI key | Code result |
| - | - | - | - |
| cfg/web-service/port | WEBSVC_PORT | --port | config.port |
| cfg/web-service/server-name | WEBSVC_SERVER_NAME | --server-name | config.serverName |
| cfg/web-service/max-connects | WEBSVC_MAX_CONNECTS | --max-connects | config.maxConnects |
| cfg/web-service/time-out-ms | WEBSVC_TIME_OUT_MS | --time-out-ms | config.timeOutMs |

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

## Config object options
| Key | Required | Description |
| - | - | - |
| etcdNameSpace | No | Namespace/prefix to search for keys in Etcd |
| envNameSpace | No | Namespace/prefix to search for keys in local environment |
| etcdApiPath | No | Etcd V3 JSON proxy is currently at "/v3alpha". Option is here if it changes |
| requiredKeys | No | List of camelCased keys which must exist, or script will exit |

## Other languages
Config Wrangler is available for the following languages:
- [Python](https://github.com/Brayyy/config-wrangler-misc)
- [PHP](https://github.com/Brayyy/config-wrangler-misc)
- [Node.js/JavaScript](https://github.com/Brayyy/config-wrangler-js) _(this project)_

## Notes
- The Etcd server can be overridden by using the environment variable `ETCD_CONN`, defaulting to `http://localhost:2379`.
- This module make use of Etcd v3 gRPC JSON proxy. Currently, the gRPC proxy has a prefix of /v3alpha, which I don't expect to be dropped any time soon, but I'm making it configurable as well.
- I could have used gRPC without the JSON proxy, however that adds additional weight to the modules, and in some cases far outweighs the project I'm trying to augment.
