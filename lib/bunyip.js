#!/usr/bin/env node
/*
 * bunyip
 * http://ryanseddon.github.com/Bunyip
 *
 * Copyright (c) 2012 Ryan Seddon
 * Licensed under the MIT license.
 */

 /*jshint laxcomma:true*/ 

var 
  url = require("url")
, dns = require('dns')
, async = require("async")
, ip = require("range_check")
, fs = require("fs")
, Yeti = require("./yeti")
, TestSwarm = require('./testswarm')
, BrowserStack = require("./browserstack")
, Tunnel = require("./tunnel")
, config = require("./options")
, util = require('./util')
, color = require("./color").codes
;

var tester, bs;

var good = "✔";
var bad = "✖";


function error() {
    var args = Array.prototype.slice.apply(arguments);
    console.error.apply(console, args);
}

function panic() {
    var args = Array.prototype.slice.apply(arguments);
    error.apply(panic, args);
    process.exit(1);
}

function puts() {
    var args = Array.prototype.slice.apply(arguments);
    console.log.apply(console, args);
}



/**
Update host part of the url with new one

@method updateUrl
@private
@param {String|Array} urls Url(s) to update  
@param {String} oldHost Host to replace (hostname + port)
@param {String} newHost Host to replace with (hostname + port)
@return {String|Array} Updated url(s)
*/
function updateUrls(urls, oldHost, newHost) {
	// reconstruct file urls with new domain:port
	function regexpQuote(str) {
		return (str+'').replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
	}

	function replaceHost(url) {
		return url.replace(new RegExp(regexpQuote(oldHost) + "(:\d+)?"), newHost); 
	}

	return typeof urls === 'string' ? replaceHost(urls) : urls.map(replaceHost);
}


/**
Inspects url and if they it is local, tunnels it out to public. When done invokes callback, passing updated url(s)
for consequent use.

@method expose
@private
@param {String|Array} url Url to check and expose (if Array is passed, only first item is checked, but the whole set is updated)
@param {Integer} toPort Destination port
@param {Function} cb Callback, that receives two params: first - error, second - updated url(s)
*/
function expose(urls, toPort, cb) {
	var urlParts = url.parse(typeof urls === 'string' ? urls : urls[0]);

	function makeItPublic() {
		// ... expose it
		var url, tunnel = new Tunnel(config.tunnel);

		tunnel.create({ // from
			url: urlParts.hostname,
			port: urlParts.port || 80
		}, { // to
			port: toPort
		});

		url = config.tunnel.url.replace(/^http:\/\//, '') + ":" + toPort;
		console.info("Tunneled to: http://" + url);
		return url;
	}

	if ('localhost' === urlParts.hostname) {
		cb(null, updateUrls(urls, urlParts.host, makeItPublic()));
	} else {
		dns.resolve4(urlParts.hostname, function(error, result) {
			if (error) {
				throw error;
			}

			if (ip.in_range(result[0], ['127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'])) { // is private ...
				cb(null, updateUrls(urls, urlParts.host, makeItPublic()));
			} else {
				cb(null, urls);
			}
		});
	}
}


function connectToSwarm(files, swarmUrl) {
	
	tester = new TestSwarm(config.testswarm, config.browsers);

	// agents join to this url...
	swarmUrl = swarmUrl.replace(/\/$/, '') + '/run/' + config.testswarm.username;

	tester.on('agentDisconnect', function() {
		tester.requiredBrowsers(function(browsers) {	
			if (bs && browsers && browsers.length) {
				bs.loadBrowsers(swarmUrl, browsers);
			}
		});
	});

	tester.on('agentResult', function(client, results) {
		/* client sample 
		{ id: '61',
		  uaID: 'Firefox|13',
		  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.6; rv:13.0) Gecko/20100101 Firefox/13.0.1',
		  userID: '6',
		  userName: 'ff',
		  userUrl: '/user/ff' 
		 }
		*/

		results = results.report || null;

		if (!results) {
			error(color.bold(bad), color.bold("Details are not available."));
			return;
		}

		if (results.passed != results.total) {
			error(color.red(bad), color.bold(results.name), "on", client.uaID.replace(/\|/, ' '));

			results.modules.forEach(function(module) {
				if (module.passed == module.total) {
					return true; // this one is ok, proceed to the next
				}

				error("   in", color.bold(module.name));

				module.tests.forEach(function(test) {
					if (test.passed == test.total) {
						return true; // ...
					}

					test.assertions.forEach(function(assertion) {
						if (+assertion.result) {
							return true;
						}

						error("    ", color.bold(color.red(test.name)) + ":", assertion.message);
						error("       Expected: " + assertion.expected, '(' + (typeof assertion.expected) + ')');
						error("       Actual: " + assertion.actual, '(' + (typeof assertion.actual) + ')');
						//error("       at: " + assertion.source);
						error("");
					});
				});
			});
		}
	});

	
	tester.on('agentComplete', function(agent) {
		error(good, "Agent completed:", agent);
	});
	

	tester.on('complete', function(jobId, result) {
		if (result.passed != result.total) {
			error(color.red("Failures") + ":", result.failed + " of " + result.total + " tests failed. (" + result.duration + "ms)");
		} else {
			error(color.green("Success") + ":", result.passed + " of " + result.total + " tests passed. (" + result.duration + "ms)");
		}
		exit();
	});

	async.series([
		function(cb) {
			tester.addJob({			
			    "runUrls[]": files
			}, function(jobId) {
				if (jobId) {
					cb(null);
				} else {
					cb("Job cannot be added");
				}
			});
		},
		function(cb) {
			tester.requiredBrowsers(function(browsers) {
				if (!browsers) {
					browsers = [];
				}		
				cb(null, browsers);		
			});
		}
	], function(error, results) {
		if (error) {
			console.info(error);
		} else if (bs) {
			bs.loadBrowsers(swarmUrl, results[1]);
		}
	});
	
}



function connectToYeti(files, hubUrl) {
	var timeStart = Number(new Date()),
        batchDetails = {
            passed: 0,
            failed: 0
        };

	tester.on('agentResult', function(agent, details) {
		/* details sample
			{ Utils: 
			   { name: 'Utils',
			     passed: 58,
			     failed: 1,
			     total: 59,
			     test1: { result: true, message: '', name: 'test1' },
			     ...
			     test10: 
			      { result: 'fail',
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

        error(iconColor(icon), color.bold(details.name), "on", agent);

        if (failed) {
            displayVerboseResult(details);
        }
	});

	tester.on('agentComplete', function(agent) {
		error(good, "Agent completed:", agent);
	});

	tester.on('agentScriptError', function(agent, details) {
		error(color.red(bad + " Script error") + ": " + details.message);
        error("  URL: " + details.url);
        error("  Line: " + details.line);
        error("  User-Agent: " + agent);
	});

	tester.on('agentError', function(agent, details) {
		error(color.red(bad + " Error") + ": " + details.message);
        error("  User-Agent: " + agent);
	});

	tester.on('complete', function() {
		var duration = Number(new Date()) - timeStart,
            total = batchDetails.passed + batchDetails.failed,
            durationString = "(" + duration + "ms)";

        if (batchDetails.failed) {
            error(color.red("Failures") + ":", batchDetails.failed,
                "of", total, "tests failed.", durationString);
        } else {
            error(color.green(total + " tests passed!"), durationString);
        }
        exit();
	});

	tester.addJob(files);

	// request agents from browserstack
	if (bs) {
		bs.loadBrowsers(hubUrl, config.browsers);
	}
}


function exit(code) {
	if (!code) {
		code = 0;
	}

	if (!config.wait) {
		async.series([
			function(cb) {
				if (config.tunnel) {
					var tunnel = new Tunnel(config.tunnel);
					tunnel.killAll(cb);
				} else {
					cb(null);
				}
			},
			function(cb) {
				if (bs) {
					bs.killBrowsers(cb);
				} else {
					cb(null);
				}
			}
		], function(error) {
			process.exit(code);
		});
	} else {
		process.exit(code);
	}
}


function route() {
	var 
	  agentUrl = config.url
	, files = [].slice.call(config.args)
	, cmd
	;

	if (config.browserstack) {
		bs = new BrowserStack(config.browserstack);
	}

	// if still in non-compliant format (e.g. passed as platform identifier or requested all)
	if (typeof config.browsers === 'string') {
		if (bs) {
			bs.parseBrowsers(config.browsers, function(browsers) {
				if (!browsers || !browsers.length) {
					error("Browsers requested in a wrong format.");
				} else {
					config.browsers = browsers;
					route(); // re-invoke our entry point
				}
			});
		} else {
			error("Browsers requested in a wrong format.");
		}
		return;
	}


	// check commands (only one and only one level deep counts)
	for (var i in config.commands) {
		cmd = config.commands[i];
		if (cmd.isSet) {
			switch (cmd.name) {
				case 'browserstack':
					if (!bs) {
						panic("BrowserStack is not initialized.");
					}

					if (cmd.list) {
						bs.listAvailableBrowsers();
					} 

					if (cmd.status) {
						bs.status();
					}

					if (cmd.kill) {
						bs.killBrowser(cmd.kill);
					}
					return;

				case 'tunnel': 
					if (!config.tunnel) {
						panic("Tunnel configuration not set.")
					}

					var tunnel = new Tunnel(config.tunnel);

					if (cmd.list) {
						tunnel.list();
					}

					if (cmd.kill) {
						tunnel.kill(cmd.kill);
					}

					if (cmd.killall) {
						tunnel.killAll();
					}
					return;
			}	
		}
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
	
	} else if ('testswarm' === config.tester) {
		// resolve relative test urls to absolute
		if (config.testswarm.testsurl) {
			files = files.map(function(url) { 
				// only urls without http:// prefix will be prefixed with base url
				return /^http:\/\//.test(url) ? url : config.testswarm.testsurl.replace(/\/$/, '') + '/' + url; 
			});
		}

		if (!config.tunnel) { // urls public already or browserstack not required
			connectToSwarm(files, config.testswarm.url);
		} else { // expose first
			async.parallel([
				function(cb) {
					expose(files, 8080, cb); // tests go to 8080
				},
				function(cb) {
					expose(config.testswarm.url, 80, cb); // testswarm goes to 80
				}
			], function(error, results) {
				if (error) {
					throw error;
				}

				connectToSwarm(results[0], results[1]);
			});
		}
	}
};

exports.route = route;
