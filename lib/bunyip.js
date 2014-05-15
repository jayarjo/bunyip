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
  color = require('./color').codes
, Yeti = require('./yeti')
, Agent = require('./agent')
, AgentFarm = require('./farm')
;


var good = "✔";
var bad = "✖";


function error() {
    console.error.apply(console, arguments);
}

function panic() {
    error.apply(panic, arguments);
    process.exit(1);
}

function puts() {
    console.log.apply(console, arguments);
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
	, timeStart
	, agentsRequested = {}
	, agentFarm
    , batchDetails = { passed: 0, failed: 0 }
	;


	function requestNextAgent() {
		var uid, agent;

		for (uid in agentsRequested) {
			if (!agentsRequested.hasOwnProperty(uid)) {
				continue;
			}
			agent = agentsRequested[uid];
			
			/*jshint loopfunc:true */
			if (agent.state === Agent.INIT) {

				agent.on('AgentTimeout', function() {
					requestNextAgent();
				});

				agentFarm
					.connect(config.hub, agent)
					.then(function() {
						agent.requested();
					})
					.fail(function() {
						agent.state = Agent.FAILED;
						requestNextAgent();
					});
				return;
			}
		}

		// no more agents to request
		tester.emit('allComplete');
	}

	// prepare agents
	config.browsers.forEach(function(agentData) {
		var agent = new Agent(agentData);
		agentsRequested[agent.uid] = agent;
	});

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

	// we have an agent breeding farm here
	agentFarm = new AgentFarm(config.farm, config[config.farm]);

	// and tester
	tester = new Yeti(config.hub);

	tester.on('ready', function() {
		timeStart = new Date();
		requestNextAgent();
	});


	tester.on('agentConnect', function(uid) {
		var agent = agentsRequested[uid];
		if (agent) {
			agent.started();
			tester.addJob(config.args);
		}
	});


	tester.on('agentResult', function(uid, agentStr, details) {
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
		    var lastSuite, k, k1,
		        suite, test, msg, m;
		    for (k in result) {
		        suite = result[k];
		        if ("object" === typeof suite) {
		            if (suite.failed) {
		                for (k1 in suite) {
		                    test = suite[k1];
		                    if ("object" === typeof test) {
		                        if ("fail" === test.result) {
		                            if (!lastSuite || lastSuite !== suite.name) {
		                                error("   in", color.bold(suite.name));
		                                lastSuite = suite.name;
		                            }
		                            msg = test.message.split("\n");
		                            error("    ", color.bold(color.red(test.name)) + ":", msg[0]);
		                            for (m = 1; m < msg.length; m = m + 1) {
		                                error("       " + msg[m]);
		                            }
		                        }
		                    }
		                }
		            }
		        }
		    }
		    error("");
		}

        batchDetails.passed += passed;
        batchDetails.failed += failed;

        error(iconColor(icon), color.bold(details.name), "on", agentStr);

        if (failed) {
            displayVerboseResult(details);
        }
	});


	tester.on('agentComplete', function(uid) {
		var agent = agentsRequested[uid];
		if (agent) { 
			agent.completed(true);
			agentFarm.kill(uid)
				.done(function() {
					requestNextAgent();
				});
		}
	});


	tester.on('agentScriptError', function(uid, agentStr, details) {
		error(color.red(bad + " Script error") + ": " + details.message);
        error("  URL: " + details.url);
        error("  Line: " + details.line);
        error("  User-Agent: " + agentStr);
	});


	tester.on('agentError', function(uid, agentStr, details) {
		error(color.red(bad + " Error") + ": " + details.message);
        error("  User-Agent: " + agentStr);
	});


	tester.on('allComplete', function() {
		var duration = new Date() - timeStart,
            total = batchDetails.passed + batchDetails.failed,
            durationString = "(" + duration + "ms)";

        if (batchDetails.failed) {
            error(color.red("Failures") + ":", batchDetails.failed,
                "of", total, "tests failed.", durationString);
        } else {
            error(color.green(total + " tests passed!"), durationString);
        }

		if (!config.wait) {
			//agentFarm.exit()
			//	.done(process.exit());
		}
	});


	tester.on('error', function() {
		console.info(arguments);
	});

	// let it start...
	tester.start();
}

exports.main = main;
