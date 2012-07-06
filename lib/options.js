var 
  program = require('commander')
, fs = require("fs")
, path = require('path')
;

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

function parseBrowsers(browserStr) {
	var 
	  browsers = []
	, file = false
	;

	if (!/[:]/.test(browserStr)) { // probably is file path
		try {
			return JSON.parse(fs.readFileSync(browserStr, 'utf8'));
		} catch(e) {
			return browserStr; // pass through for further investigation
		}
	} else {
		// Browser string has been passed, parse it
		var opt = browserStr.split('|'), versions, os, platform, data;

		opt.forEach(function(browser,i) {
			data = browser.split("/");
			platform = data[0].split(":");
			browser = platform[0];
			os = platform[1];
			versions = data[1].split(',');

			versions.forEach(function(ver, i) {
				browsers.push({
					browser: browser,
					device:  browser,
					os: os,
					version: ver
				});
			});
		});
		return browsers;
	} 
}


program
	.version('0.1.0')
	.option('-b, --browsers <ie:win/6.0 || file.json>', 'browsers to test in e.g "ie:win/6.0,7.0|iPhone 3GS:ios/3.0"', parseBrowsers)
	.option('-c, --config <config>', 'path to the config file (default: bunyip/config.js)', String)
//	.option('-w, --wait', 'do not run tests until ENTER is pressed')
	;

program
	.command('browserstack')
	.option('-l, --list', 'returns available browsers on browserstack')
	.option('-k, --kill <id>', 'kill browserstack worker process')
	.option('-s, --status', 'get status of all browserstack browsers')
	.action(function(cmd) {
		cmd.isSet = true;
	}) 
	;

program
	.command('testswarm')
	.option('-s, --state', 'get the state of the swarm')
	.action(function(cmd) {
		cmd.isSet = true;
	})
	;

  	
program
	.parse(process.argv);

var 
  config
, configPath = program.config || __dirname.replace(/\/lib\/?$/, '/')  + "config.js"
;

if (/^[^\/\.]/.test(configPath)) {
	configPath = process.cwd() + '/' + configPath; // make it absolute
}

if (path.existsSync(configPath)) {
	config = require(configPath);
}

// command-line params have priority
config = extend(program, config, true); // copy over only not defined properties


// parse url
var 
  tester = config.tester
, url = config[tester].url
, m = url.match(/^(http:\/\/)?([^\/]+)(\/|$)/)
, parts
;

if (m) {
	parts = m[2].split(/:/);
	config[tester].domain = parts[0];
	config[tester].port = parts[1] || 80;
}

config.url = url;

module.exports = config;