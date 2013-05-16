#!/usr/bin/env node
/*
 * bunyip
 * http://ryanseddon.github.com/Bunyip
 *
 * Copyright (c) 2012 Ryan Seddon
 * Licensed under the MIT license.
 */

 /*jshint laxcomma:true */

var 
  fs = require('fs')
, util = require('./util')
, color = require('./color').codes
, Yeti = require('./yeti')
, AgentFarm = require('./farm')
;


var good = "✔";
var bad = "✖";


function msg() {
    var args = Array.prototype.slice.apply(arguments);
    console.error.apply(console, args);
}

function panic() {
    var args = Array.prototype.slice.apply(arguments);
    msg.apply(panic, args);
    process.exit(1);
}

function puts() {
    var args = Array.prototype.slice.apply(arguments);
    console.log.apply(console, args);
}



function exit(code) {
	if (!code) {
		code = 0;
	}
	process.exit(code);
}


function main(config) {
	var 
	  tester
	, agentFarm
	, timeStart
    , batchDetails = {
          passed: 0
        , failed: 0
    }
	;

	// by default close all connections and exit tunnels on quit
	if (!config.wait) {
		// gracefully handle Ctrl+C
		process.on('SIGINT', function() {
			exit();
		});

		// clean up processes on exit
		process.on('SIGTERM', function () {
			exit();
		});
	}


	// launch tester
	tester = new Yeti(config.hub);

	tester.on('ready', function() {
		agentFarm = new AgentFarm({
			  service: config.farm
			, username: config.user
			, password: config.pass
		});
		agentFarm.connect(config.hub, config.browsers);
	});

	tester.on('agentConnect', function(agent) {
		console.log("Connected %s", agent);
	});

	tester.on('agentDisconnect', function() {

	});

	tester.on('agentResult', function(agent, details) {
		/* details sample
			{ Utils: 
				{ 
					name: 'Utils',
					passed: 58,
					failed: 1,
					total: 59,
					test1: { result: true, message: '', name: 'test1' },
					...
					test10: 
					{ 
						result: 'fail',
						message: 'Looping over an array\nExpected: 7 (Number)\nActual: 6 (Number)',
						name: 'test10' }
					},
					passed: 58,
					failed: 1,
					total: 59,
					duration: 94,
					name: '✖ Plupload Test Suite' 
				}
		*/

		var passed = details.passed,
            failed = details.failed,
            icon = failed ? bad : good,
            iconColor = failed ? color.red : color.green;

		function displayVerboseResult(result) {
			var lastSuite, k, k1, suite, test, msg, m;

			for (k in result) {
				suite = result[k];
				if ("object" === typeof suite) {
					if (suite.failed) {
						for (k1 in suite) {
						test = suite[k1];
							if ("object" === typeof test) {
								if ("fail" === test.result) {
									if (!lastSuite || lastSuite !== suite.name) {
										msg("   in", color.bold(suite.name));
										lastSuite = suite.name;
									}
									msg = test.message.split("\n");
									msg("    ", color.bold(color.red(test.name)) + ":", msg[0]);
									for (m = 1; m < msg.length; m = m + 1) {
										msg("       " + msg[m]);
									}
								}
							}
						}
					}
				}
			}
			msg("");
		}

        batchDetails.passed += passed;
        batchDetails.failed += failed;

        msg(iconColor(icon), color.bold(details.name), "on", agent);

        if (failed) {
            displayVerboseResult(details);
        }
	});

	tester.on('agentComplete', function(agent) {
		msg(good, "Agent completed:", agent);
	});

	tester.on('agentScriptError', function(agent, details) {
		msg(color.red(bad + " Script error") + ": " + details.message);
        msg("  URL: " + details.url);
        msg("  Line: " + details.line);
        msg("  User-Agent: " + agent);
	});

	tester.on('agentError', function(agent, details) {
		msg(color.red(bad + " Error") + ": " + details.message);
        msg("  User-Agent: " + agent);
	});

	tester.on('complete', function() {
		var duration = Number(new Date()) - timeStart,
            total = batchDetails.passed + batchDetails.failed,
            durationString = "(" + duration + "ms)";

        if (batchDetails.failed) {
            msg(color.red("Failures") + ":", batchDetails.failed,
                "of", total, "tests failed.", durationString);
        } else {
            msg(color.green(total + " tests passed!"), durationString);
        }
	});

	tester.on('error', function() {
		console.info(arguments);
	});

	tester.start();

	/*tester.addJob(files);

	// request agents from browserstack
	if (bs) {
		bs.loadBrowsers(hubUrl, config.browsers);
	}

	// if still in non-compliant format (e.g. passed as platform identifier or requested all)
	if (typeof config.browsers === 'string') {
		if (bs) {
			bs.parseBrowsers(config.browsers, function(browsers) {
				if (!browsers || !browsers.length) {
					msg("Browsers requested in a wrong format.");
				} else {
					config.browsers = browsers;
					route(); // re-invoke our entry point
				}
			});
		} else {
			msg("Browsers requested in a wrong format.");
		}
		return;
	}
	


	// test runner logic start here...
	if ('yeti' == config.tester) {
		tester = new Yeti(config.yeti, config.browsers);

		tester.start(function() {
			if (!config.tunnel) {
				connectToYeti(files, config.yeti.url);
			} else {
				expose(config.yeti.url, 80, function(error, url) {
					if (error) {
						throw error;
					}
					connectToYeti(files, url);
				});
			}
		});

	} 
	*/
}

exports.main = main;
