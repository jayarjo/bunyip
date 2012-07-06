/*jshint laxcomma:true*/

var 
  request = require("request")
, async = require("async")
, querystring = require("querystring").stringify
, url = require("url")
, EventEmitter = require("events").EventEmitter
, util = require("./util")
;

var good = "✔";
var bad = "✖";

/**
@constructor
*/
function TestSwarm(config, agents) {
	var 
	  self = this
	, activeJobs = {}
	, completedAgents = {}
	, currState
	, baseUrl
	, apiUrl
	;

	if (!config.url) {
		throw "TestSwarm Url not supplied.";
	}

	EventEmitter.call(this);

	config = util.extend({
		verbose: true,
		pollInterval: 5000,
		timeout: 1000 * 60 * 15, // 15 minutes
		started: +new Date(),
	}, config);

	// make sure there's always a trailing slash
	baseUrl = url.format(url.parse(config.url)).replace( /\/$/, "" ) + "/";

	// url to TestSwarm API
	apiUrl = baseUrl + "api.php";

	/*for (var i = 55; i <= 61; i++) {
		deleteJob(i);
	}*/


	// gracefully handle Ctrl+C
	process.on('SIGINT', function() {
		deleteAllJobs(function() {
			process.exit();
		});
	});

	// TODO: our motto is - right here, right now - we are not looking to store results currently
	// deleteAllJobs();


	function uaIdGen(ua) {
		return [ua.browser || ua.device, parseInt(ua.version, 10)].join('|').toLowerCase();
	}


	function isRequestedAgent(uaId) {
		var itIs = false;

		if (!agents) {
			return true;
		}

		agents.forEach(function(ua) {
			if (uaId.toLowerCase() === uaIdGen(ua)) {
				return !(itIs = true);
			}
		});

		return itIs;
	}


	function checkCompleted(jobId) {
		var completed = {
			runTime: 0,
			passed: true
		};

		if (!agents || !completedAgents[jobId]) {
			return false;
		}

		agents.forEach(function(ua) {
			var uaRun = completedAgents[jobId][uaIdGen(ua)];
			if (!uaRun) {
				return (completed = false);
			} else {
				completed.runTime += parseInt(uaRun.runTime, 10);
				completed.passed &= !parseInt(uaRun.failedTests, 10);
			}
		});
		return completed;
	}


	function pollSwarmState() {
		// operate only if there are any listeners for agentConnect or agentDisconnect
		if (!self.listeners('agentConnect').length && !self.listeners('agentDisconnect').length && !config.verbose) {
			return;
		}
		
		swarmState(function(result) {
			var UAs = result.userAgents;
			
			if (currState) {
				Object.keys(UAs).forEach(function(ua) {
					var diff, agentName = UAs[ua].data.displaytitle;

					if (!currState[ua]) {
						if (config.verbose) {
							console.log("Agent connected: " + ua);
						}
						self.emit('agentConnect', ua, agentName, UAs[ua].stats);
						return true;
					}
					
					diff = UAs[ua].stats.onlineClients - currState[ua].stats.onlineClients;
					if (diff > 0) {
						// we need a loop here, since there might be multiple agents connected at once
						for (var i = 0; i < diff; i++) {
							if (config.verbose) {
								console.log("  Agent connected: " + agentName);
							}
							self.emit('agentConnect', ua, agentName, UAs[ua].stats);
						}
					} else if (diff < 0) {
						for (var i = 0; i < Math.abs(diff); i++) {
							if (config.verbose) {
								console.log("  Agent disconnected: " + agentName);
							}
							self.emit('agentDisconnect', ua, agentName, UAs[ua].stats);
						}
					}
				});
			} 
			currState = UAs;

			setTimeout(function() {
				pollSwarmState();
			}, config.pollInterval);
		});
	}


	function pollResults(jobId) {
		if (!activeJobs[jobId]) {
			return false;
		}

		jobStatus(jobId, function(job) {
			var run = job.runs[0];	

			Object.keys(run.uaRuns).forEach(function(uaId) {
				var uaRun, runId, report;

				// if particular browsers were requested and this is not one of them, bypass
				if (agents && !isRequestedAgent(uaId)) {
					return true;
				}

 				uaRun = run.uaRuns[uaId];

				if (/(progress|new)/.test(uaRun.runStatus)) {
					return true;
				}

				// check if we already checked that agent
				if (completedAgents[job.jobInfo.id] && completedAgents[job.jobInfo.id][uaId]) {
					return true;
				}

				if (!completedAgents.hasOwnProperty(job.jobInfo.id)) {
					completedAgents[job.jobInfo.id] = {};
				}

				// mark down runId for future
				uaRun.runId = parseInt(uaRun.runResultsUrl.match(/\d+$/)[0], 10);
				delete uaRun.runResultsUrl;

				completedAgents[job.jobInfo.id][uaId] = true; // flag as completed

				runResult(uaRun.runId, function(result) {
					var completed;

					util.extend(uaRun, result.resultInfo);
					
					completedAgents[job.jobInfo.id][uaId] = uaRun; // now store full result
					self.emit('agentComplete', uaId, result.client, uaRun);

					completed = checkCompleted(jobId);
					if (completed) {
						deleteJob(jobId, function() {
							self.emit('complete', jobId, completed.passed, completed.runTime);
						});
					}
				});
			});
		});
	}


	function apiRequest(params, cb) {
		// some api requests do no require authorization, but then it doesn't harm anything
		params = util.extend({
			"authUsername": config.username,
		    "authToken": config.authToken
		}, params);


		request.post({
			url: apiUrl,
			form: params
		}, function (error, response, body) {
			var result;
			
			if (error) {
				cb(error);
			} else {
				try {
					result = JSON.parse(body);					
				} catch (ex) {
					console.log("Error: Response body is not valid JSON: " + body);
					process.exit(1);
				}

				if (result[params.action]) {
					cb(null, result[params.action]);
				} else {
					cb(result.error.info || "Unknown error.");
				} 
			}
		});
	}


	function swarmState(cb) {
		var params = {
			"action": 'swarmstate'
		};

		apiRequest(params, function(error, result) {
			/* result sample: 

			{ 
				swarmstate: { 
					userAgents: { 
						'Chrome|19': { 
							data: { displaytitle: 'Chrome 19', displayicon: 'chrome' },
							stats: { 
								onlineClients: 0,
								activeRuns: 0,
								pendingRuns: 34,
								pendingReRuns: 0 
							} 
						},
						....
					}
				}
			}
			*/

			if (error) {
				console.log("Error: " + error);
				process.exit(1);
			}

			if (typeof cb === 'function') {
				cb(result);
			}
		});
	}


	function jobStatus(jobId, cb) {
		var params = { 
			"action": "job",
			"item": jobId
		}; 

		apiRequest(params, function (error, result) {
			/* result sample:
			{ 
				job: { 
					jobInfo: { 
						id: 33,
						name: 'job-1340991096269',
						ownerName: 'jayarjo',
						creationTimestamp: '20120629173136' 
					},
					runs: [
						{
							info: { id: '40', name: 'Utils', url: 'tests/Utils.html' },
    						uaRuns: { 
       							'Chrome|19': { 
       								runStatus: 'new', 
									runResultsLabel: ?
       							},
       							'Chrome|20': {
									useragentID: 'Chrome|20',
									clientID: '18',
									failedTests: '0',
									totalTests: '59',
									errors: '0',
									runStatus: 'passed',
									runResultsUrl: '/result/31',
									runResultsLabel: '59'
       							}
       							...
       						}
						},
						...
					],
					userAgents: { 
						'Chrome|19': { 
							displaytitle: 'Chrome 19', 
							displayicon: 'chrome' 
						},
						...
					}
				}
			}
			*/

			if (error) {
				console.log("Error: " + error);
				process.exit(1);
			}

			if (typeof cb === 'function') {
				cb(result);
			}
		});
	}


	function runResult(runId, cb) {
		var params = { 
			"action": "result",
			"item": runId
		}; 

		apiRequest(params, function (error, result) {
			/* result sample
			{
			    "result": {
			        "otherRuns": null,
			        "job": null,
			        "client": {
			            "id": "4",
			            "uaID": "Chrome|20",
			            "userAgent": "Mozilla\/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit\/536.11 (KHTML, like Gecko) Chrome\/20.0.1132.47 Safari\/536.11",
			            "userID": "1",
			            "userName": "jayarjo",
			            "userUrl": "\/user\/jayarjo"
			        },
			        "resultInfo": {
			            "id": 2,
			            "runID": "1",
			            "clientID": "4",
			            "status": "Finished",
			            "report": {
			                "Utils": {
			                    "each()": [{
			                        "result": false,
			                        "message": "Looping over an array",
			                        "actual": 6,
			                        "expected": 7,
			                        "source": "    at Object.<anonymous> (http:\/\/i8.pagekite.me:8080\/moxie\/tests\/Utils.html?_=1341237443015&swarmURL=http%3A%2F%2Fswarm.mxi%2Findex.php%3Fstatus%3D2%26run_id%3D1%26client_id%3D4%26run_token%3Dnull%26results_id%3D2%26results_store_token%3Dc174f0e7b4ca2483dfa8c96565899f4a4ecdc6db:68:2)",
			                        "count": 1
			                    }]
			                }
			            },
			            "runTime": 7,
			            "savedRawUTC": "20120702135729",
			            "savedISO": "2012-07-02T13:57:29Z",
			            "savedLocalFormatted": "Mon Jul  2 13:57:29 2012",
			            "startedRawUTC": "20120702135722",
			            "startedISO": "2012-07-02T13:57:22Z",
			            "startedLocalFormatted": "Mon Jul  2 13:57:22 2012"
			        }
			    }
			}
			*/
			if (error) {
				console.log("Error: " + error);
				process.exit(1);
			}

			if (typeof cb === 'function') {
				cb(result);
			}
		});
	}


	function addJob(params, cb) {
		params = util.extend({ 
			"jobName": "job-" + (new Date()).getTime(),
			"browserSets[]": ["default"],
			"action": "addjob"
		}, params); 

		params.runMax = 1; // what is the point of having more runs per test anyway?..

		if (!params["runUrls[]"]) {
			console.log("No tests to run.");
			if (typeof cb === 'function') {
				cb(false);
			}
			return;
		}

		if (!params["runNames[]"]) { 
			// extract file names without extensions
			params["runNames[]"] = params["runUrls[]"].map(function(url) { return url.match(/\/([^\/]+)\/?$/)[1].replace(/\.[^\.]+$/, ''); }); 
		}

		apiRequest(params, function (error, jobInfo) {
			var jobInfo;

			if (error) {
				console.log(error);
				process.exit(1);
			}
			
			activeJobs[jobInfo.id] = jobInfo;

			if (config.verbose) {
				console.log("Job #" + jobInfo.id + " started at: " + baseUrl + "job/" + jobInfo.id);
			}
			
			pollResults(jobInfo.id);
			pollSwarmState();
			
			if (typeof cb === 'function') {
				cb(jobInfo.id);
			}
		});
	}


	function resetJob(jobId, cb) {
		var params = {
		    "action": "wipejob",
		    "type": 'reset',
		    "job_id": jobID
		};

		apiRequest(params, function (error, result) {
			if (error) {
				console.log("Error: " + error);
				process.exit(1);
			}
			
			console.log("Job: #" + jobID + " was reset.");
			delete activeJobs[jobID];

			if (typeof cb === 'function') {
				cb(jobID);
			}
		});
	}


	function deleteJob(jobID, cb) {
		var params = {
		    "action": "wipejob",
		    "type": 'delete',
		    "job_id": jobID
		};

		apiRequest(params, function (error, result) {
			// result sample: { wipejob: { jobID: 5, type: 'delete', result: 'ok' } }
			if (error) {
				console.log("Error: " + error);
				process.exit(1);
			}
			
			if (config.verbose) {
				console.log("Job: #" + jobID + " was deleted!");
			}

			delete activeJobs[jobID];

			if (typeof cb === 'function') {
				cb(jobID);
			}
		});
	}


	function deleteAllJobs(cb) {
		async.forEach(Object.keys(activeJobs), deleteJob, cb);
	}

	this.swarmState = swarmState;
	this.addJob = addJob;
	this.jobStatus = jobStatus;
	this.resetJob = resetJob;
	this.deleteJob = deleteJob;
	this.deleteAllJobs = deleteAllJobs;
	this.apiRequest = apiRequest;
}

TestSwarm.super_ = EventEmitter;
TestSwarm.prototype = Object.create(EventEmitter.prototype, {
    constructor: {
        value: TestSwarm,
        enumerable: false
    }
});


module.exports = TestSwarm;
