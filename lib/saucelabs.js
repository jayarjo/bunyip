var 
  Q = require('q')
, wd = require('wd')
, fs = require('fs')
, url = require('url')
, path = require('path')
, request = require('request')
, util = require('./util')
, isLocal = require('./ip')
, download = require('./download')
, exec = require('child_process').exec
;


function SauceLabs(options) {
	var
	/**
	Available agents in normalized form

	e.g.
		[{
			  name: 'Google Chrome'
			, id: 'chrome'
			, farmId: 'chrome'
			, version: '25'
			, os: 'win'
			, osVersion: '2012'
		}]

	@private
	@property _agents
	@type {Array}
	*/
	  _agents = []

	, _workers = {}

	, username = options.username
	, accessKey = options.password
	;


	function api(method, data) {
		var 
		  methods = {}
		, deferred = Q.defer()
		; 

		request({ 
			  method: methods[method] || 'get'
			, uri: ["https://", username, ":", accessKey, "@saucelabs.com/rest/v1", method].join('')
			, body: JSON.stringify(data)
			, json: true
		}
		, function (error, response, body) {
			deferred.resolve(body);
		});

		return deferred.promise;
	}


	function _normalizeFarmId(farmId) {
		var map = {
			  'internet explorer': 'ie'
		};
		return map[farmId] ? map[farmId] : farmId;
	}


	function _normalizeFarmOs(os) {
		var map = {
			  'Windows': 'win'
			, 'Linux': 'linux'
			, 'Mac': 'mac'
		};
		return map[os] ? map[os] : os;
	}


	function _getTunellier(tunnelierPath) {
		if (fs.existsSync(tunnelierPath)) {
			return Q(true);
		}

		console.log("Tunnelier (Sauce-Connect.jar) not found. Retrieving...");

		return download("http://saucelabs.com/downloads/Sauce-Connect-latest.zip", {
				to: path.dirname(tunnelierPath)
			})
			.then(function(file) {
				console.log("Unpacking: %s. Wait...", file.name);

				var 
				  buffer = fs.readFileSync(path.join(file.path, file.name))
				, reader = require('zip').Reader(buffer)
				, tunnelierName = 'Sauce-Connect.jar'
				;

				reader.toObject();
				reader.forEach(function (entry) {
					if (entry.getName() === tunnelierName) {
						fs.writeFileSync(path.join(file.path, tunnelierName), entry.getData());
					}
				});
				reader.iterator();

				fs.unlinkSync(path.join(file.path, file.name));
				console.log("Done.");
				return true;
			});
	}


	function _exposeToAgents(urlParts) {
		var 
		  tunnelierPath = path.resolve('tools/Sauce-Connect.jar')
		, baseDir = path.dirname(tunnelierPath)
		, readyFile = 'sauce.pid'
		;	

		return _getTunellier(tunnelierPath)
			.then(function() {
				console.log("Launching tunnelier...");

				// make sure readyfile is not there when we start
				if (fs.existsSync(path.join(baseDir, readyFile))) {
					fs.unlinkSync(path.join(baseDir, readyFile));
				}
				
				return Q.delay(exec(util.format("java -jar %s %s %s -f %s -l %s &"
					, tunnelierPath
					, username
					, accessKey
					, path.join(baseDir, readyFile)
					, path.join(baseDir, 'sauce.log')
				)), 1);
			})
			.then(function() {
				var 
				  deferred = Q.defer()
				, start = new Date()
				;

				function isReady() {
					if (fs.existsSync(path.join(baseDir, readyFile))) {
						deferred.resolve(urlParts);
					} else if (new Date() - start < 60 * 1000) { // 60 secs to launch
						setTimeout(isReady, 500);
					} else {
						deferred.reject("Timeout: Tunnelier failed to launch within 30 secs.");
					}
				}
				isReady();
				return deferred.promise;
			});
	}


	function _connect(urlParts, agentId) {
		// otherwise proceed normally...
		var conn = wd.promiseRemote("ondemand.saucelabs.com", 80, username, accessKey);
		
		return this.resolve(agentId)
			.then(function(agent) {
				console.log("%s %s requested.", agent.name, agent.version);

				return conn.init({
					  browserName: agent.farmId
					, version: agent.version
				})
				.then(function(sessionId) {
					_workers[sessionId] = {
						  agent: agent
						, conn: conn
					};
					return conn.get(url.format(urlParts));
				});
			});
	}


	if (!username || !accessKey) {
		console.info("Error: Credentials for SauceLabs connection not supplied or wrong.");
		process.exit(1);
	}

	util.extend(this, {
		
		getAvailable: function() {
			var deferred = Q.defer();

			if (_agents.length) {
				setTimeout(function() {
					deferred.resolve(_agents);
				}, 1);
			} else {
				api("/info/browsers/webdriver").done(function(sauceAgents) {
					sauceAgents.forEach(function(agent) {
						var os = agent.os.split(/\s(?:\d)/);
						_agents.push({
							  name: agent.long_name
							, id: _normalizeFarmId(agent.api_name)
							, farmId: agent.api_name
							, version: agent.short_version
							, osName: os[0]
							, osId: _normalizeFarmOs(os[0])
							, osVersion: os[1] || ''
						});
					});
					deferred.resolve(_agents);
				});
			}
			return deferred.promise;
		}


		, connect: function(urlParts, agents) {
			var self = this;

			if (typeof(urlParts) === 'string') {
				urlParts = url.parse(urlParts);
			}

			if (!util.isArray(agents)) {
				agents = [agents];
			}

			return isLocal(urlParts.hostname)
				.then(function(result) {
					return result ? _exposeToAgents.call(self, urlParts) : urlParts;
				})
				.then(function(urlParts) {
					var 
					  queue = []
					, i = agents.length
					;
					while (i--) {
						queue.push(_connect.call(self, urlParts, agents[i]));
					}
					return Q.all(queue);
				});	
		}


		, kill: function(sessionId) {
			var worker = _workers[sessionId];
			if (!worker) {
				return Q(false);
			}

			return worker.conn.quit()
				.then(function() {
					console.info(worker.agent.name + "(" + sessionId + "): killed.");
					delete _workers[sessionId];
				});
		}


		, killAll: function() {

		}
	});
}

module.exports = SauceLabs;
