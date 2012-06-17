var program = require('commander'),
	fs = require("fs");

function extend(a, b, ifnotset) {
	if (b) {
		var props = Object.getOwnPropertyNames(b);

		props.forEach(function(name) {
			if (!a.hasOwnProperty(name) && ifnotset || !ifnotset) {
				var destination = Object.getOwnPropertyDescriptor(b, name);
				Object.defineProperty(a, name, destination);
			}
		});
	}
	return a;
}

program
  .version('0.1.0')
  .option('-a, --available', 'returns available browsers on browserstack')
  .option('-b, --browsers <ie:win/6.0 || file.json>', 'specify browsers to test in e.g "ie:win/6.0,7.0|iPhone 3GS:ios/3.0"', String)
  .option('-c, --config <config>', 'path to the config file (by default: bunyip/config.json)', String)
  .option('-h, --hub', 'yeti hub to connect to [localhost]')
  .option('-k, --kill <id>', 'kill browserstack worker process')
  .option('-p, --port <port>', 'port [9000]', Number)
  .option('-s, --status', 'get status of all browserstack browser')
  .option('-w, --wait', 'do not run tests until ENTER is pressed')
  .parse(process.argv);

var config,
	defaults = {
		hub: 'localhost',
		port: 9000,
		timeout: 60,
		loglevel: "silent"
	},
	configPath = program.config || __dirname.replace(/\/lib\/?$/, '/')  + "config.json";

try {
	config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch(err) {}

config = extend(defaults, config);

// command-line params have priority
program = extend(program, config, true); // copy over only not defined properties

module.exports = program;