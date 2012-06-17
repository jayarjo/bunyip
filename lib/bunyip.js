#!/usr/bin/env node
/*
 * bunyip
 * http://ryanseddon.github.com/Bunyip
 *
 * Copyright (c) 2012 Ryan Seddon
 * Licensed under the MIT license.
 */

var util = require('util'),
	fs = require("fs"),
	yeti = require("./yeti"),
	browserstack = require("./browserstack"),
	tunnel = require("./tunnel");


exports.route = function(program) {
	var url;

	if (program.browserstack) {
		browserstack.init(program);
	}

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

		yeti.start(program, function(client) {
			url = client.url;

			// start tunnel if requested
			if (program.tunnel && program.tunnel.cmd) {	
				if (program.tunnel.url) {
					url = program.tunnel.url;
				} else {
					program.tunnel.url = url;
				}
				tunnel.create(program);

				process.on('exit', function () {
					tunnel.destroy();
				});
			}

			// use browserstack if possible
			if (program.browsers && program.browserstack) {
				browserstack.requestAgents(program, function(workers) {
					var connectedAgents = 0;

					client.on("agentConnect", function (agent) {
						connectedAgents++;

						if (connectedAgents === workers.length && !program.wait) {
							yeti.startTesting(client, program.args);
						}
					});
				});
			}
		});
	}
};