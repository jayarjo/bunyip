var 
  program = require('commander')
, keypress = require('keypress')
, fs = require('fs')
, util = require('./util')
;


function parseConfigFile(configPath) {
	if (/^[^\/\.]/.test(configPath)) {
		configPath = process.cwd() + '/' + configPath; // make it absolute
	}

	if (fs.existsSync(configPath)) {
		return require(configPath);
	}
	return {};
}


function parseBrowsers(browserStr) {
	var browsers = [];

	if (!/[:]/.test(browserStr)) { // probably is file path
		try {
			return JSON.parse(fs.readFileSync(browserStr, 'utf8'));
		} catch(e) {
			return browserStr; // pass through for further investigation
		}
	} else {
		// Browser string has been passed, parse it
		var opt = browserStr.split('|'), versions, os, platform, data;

		opt.forEach(function(browser) {
			data = browser.split("/");
			platform = data[0].split(":");
			browser = platform[0];
			os = platform[1];
			versions = data[1].split(',');

			versions.forEach(function(ver) {
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

function parseTesterUrl(url) {
	var 
	  m
	, parts
	;

	if (url !== true) {
		m = url.match(/^(?:https?:\/\/)?([^\/]+)(?:\/|$)/);
		if (m) {
			parts = m[1].split(/:/);
			return {
				  domain: parts[0]
				, port: parts[1] || 80
			};
		}
	}
	return {
		domain: 'localhost',
		port: 9000
	};
}

// program.password doesn't work in commander.js (see https://github.com/visionmedia/commander.js/issues/72)
function passwordPrompt(str, fn) {
	var buf = '';

	keypress(process.stdin);

	process.stdin.resume();
	process.stdin.setRawMode(true);
	process.stdout.write(str);

	// keypress
	process.stdin.on('keypress', function(c, key) {
		if (key && 'enter' == key.name) {
			console.log();
			process.stdin.removeAllListeners('keypress');
			process.stdin.setRawMode(false);
			if (!buf.trim().length) {
				return passwordPrompt(str, fn);
			}
			fn(buf);
			return;
		}

		if (key && key.ctrl && 'c' == key.name) {
			process.exit();
		}

		//process.stdout.write(mask);
		buf += c;
	}).resume();
}

function getConfig(cb) {
	var config;

	program
		.version('0.2.0')
		.option('-b, --browsers <ie:win/6.0 || file.json>', 'browsers to test in e.g "ie:win/6.0,7.0|iPhone 3GS:ios/3.0"', parseBrowsers)
		.option('-c, --config <config>', 'path to standalone config file to use', parseConfigFile)
		.option('-h, --hub <url>', 'tester server, if not specified will default to localhost:9000', parseTesterUrl)
		.option('-f, --farm <service>', 'agent breeding service (currently saucelabs or browserstack)', 'saucelabs')
		.option('-u, --user <username>', 'username - at agent breeding farm')
		.option('-p, --pass [pass]', 'password - (or access key) at agent breeding farm')
		.option('-w, --wait', 'do not shut down tunnels and workers on quit')
		.option('-l, --list', 'display agents available from the agent farm')
		.option('-L, --list-workers', 'display agents connected (workers) to the tester')
		.option('-k, --kill <id>', 'kill worker process')
		.option('-K, --kill-all', 'kill all browserstack workers')
		;

	program
		.parse(process.argv);

	// output help screen by default
	if (process.argv.length <= 2) {
		process.stdout.write(program.helpInformation());
		program.emit('--help');
		process.exit();
	}

	config = util.extend(program.config || {}, program); 

	// if --pass specified by empty request prompt
	if (program.hasOwnProperty('pass') && program.pass === true) {
		passwordPrompt('Password: ', function(pass) {
			process.stdin.destroy();
			config.pass = pass;
			cb(config);
		});
	} else {
		cb(config);
	}
}


module.exports = getConfig;
