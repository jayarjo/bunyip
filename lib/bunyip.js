#!/usr/bin/env node
/*
 * bunyip
 * http://ryanseddon.github.com/Bunyip
 *
 * Copyright (c) 2012 Ryan Seddon
 * Licensed under the MIT license.
 */

var util = require('util'),
	yeti = require("../node_modules/yeti/lib/cli").route,
	fs = require("fs"),
	browserstack = require("./browserstack"),
	tunnel = require("./tunnel"),
	config, timeout,
	platforms = /^(all|ios|win|mac|android|opera)$/;


exports.route = function(program) {
	// include config 
	var configPath = program.config || __dirname.replace(/lib\/?$/, '')  + "/config.json";
	try {
		config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
	} catch(err) {
		console.log("Config Error: "  + configPath + " doesn't exist or in wrong format (expected - JSON)\n" + err);
		process.exit(1);
	}

	timeout = config.browserstack.timeout || 480;

	if(program.port) {
		var url = "http://localhost:"+program.port;
		config.tunnel.port = config.tunnel.port;
	}

	browserstack.init(config);

	if(program.status) {
		browserstack.status();
	} else if(program.available) {
		browserstack.availableBrowsers(function(browsers){
			var list = "",
				browser,
				device = {},
				curBrowser;

			for (var i = 0; i < browsers.length; i++) {
				curBrowser = browsers[i];

				if(curBrowser.device) {
					if(curBrowser.device === device.platform || curBrowser.version === device.version) {
						list += " " + curBrowser.device  + ", ";
					} else {
						list += "\n" + curBrowser.os + " "+ curBrowser.version + ": " + curBrowser.device + ",";
					}
				} else if(curBrowser.browser === browser) {
					list += " " + curBrowser.version  + ", ";
				} else {
					list += "\n" + curBrowser.browser + " ("+ curBrowser.os + "): " + curBrowser.version + ", ";
				}

				browser = curBrowser.browser;
				device = {
					platform: curBrowser.device,
					version: curBrowser.version
				};

			}

			console.log(list);
		});
	} else if(program.kill) {
		if(program.kill ==="all") {
			browserstack.killBrowsers();
		} else {
			browserstack.killBrowser(program.kill, function(err, data, id){
				console.log("Worker %s successfully killed, it ran for %ss", id, Math.round(data.time));
			});
		}
	} else {
		yeti(["","", program.file, "--port=" + config.tunnel.port]);

		tunnel.create(config.tunnel.port, config.tunnel.url);

		process.nextTick(function () {
			var testURL = "http://"+config.tunnel.url.replace(/^http:\/\//, ''),
				browsers = [],
				file = false;

			if(program.browsers && !platforms.test(program.browsers)) {
				try {
					file = fs.readFileSync(program.browsers,'utf8');
				} catch(e) {}
				
				if(file) {
					// You can pass in a JSON file specifying the browsers
					browsers = JSON.parse(file);
					
					browsers.forEach(function(browser,i) {
						browser.url = testURL;
						browser.timeout = timeout;
					});
				} else {
					var opt = program.browsers.split('|'),
						versions, os, platform, data;

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
								version: ver,
								url: testURL,
								timeout: timeout
							});
						});
					});
				}
				
				process.nextTick(function() {
					browserstack.loadBrowsers(browsers);
				});
			} else if(platforms.test(program.browsers)) {
				
				switch(program.browsers) {
					case "all":
						browserstack.availableBrowsers(function(list){
							list.forEach(function(browser, i) {
								browser.url = testURL;
								browser.timeout = timeout;
							});

							browserstack.loadBrowsers(list);
						});
						break;
					case "ios":
						browserstack.platformBrowsers("ios");
						break;
					case "android":
						browserstack.platformBrowsers("android");
						break;
					case "opera":
						browserstack.platformBrowsers("opera");
						break;
					case "win":
						browserstack.platformBrowsers("win");
						break;
					case "mac":
						browserstack.platformBrowsers("mac");
						break;
				}

				
			}
		});

		process.on('exit', function () {
			tunnel.destroy();
		});
	}
};