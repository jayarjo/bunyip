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
	, agentsConnected = {}
	, timeStart
    , batchDetails = { passed: 0, failed: 0 }
	;

	function getAgentId(agent) {
		return [agent.id, agent.version, agent.osId].join(':');
	}


	function allAgentsConnected() {
		var i = config.browsers.length;
		while (i--) {
			if (!agentsConnected.hasOwnProperty(getAgentId(config.browsers[i]))) {
				return false;
			}
		}
		return true;
	} 


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
		agentFarm = new AgentFarm(config.farm, config[config.farm]);
		agentFarm.connect(config.hub, config.browsers);
	});


	tester.on('agentConnect', function(agent) {
		agentsConnected[getAgentId(agent)] = true;

		if (allAgentsConnected()) {
			timeStart = new Date();
			tester.addJob(config.args);
		}
	});


	tester.on('agentDisconnect', function(agent) {
		delete agentsConnected[getAgentId(agent)];
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

		var 
		  passed = details.passed
		, failed = details.failed
		, icon = failed ? bad : good
		, iconColor = failed ? color.red : color.green
		;

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
		var duration = new Date() - timeStart,
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
}

exports.main = main;
