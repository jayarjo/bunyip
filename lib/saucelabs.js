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
			, osName: 'Windows'
			, osVersion: '2012'
		}]

	@private
	@property _supportedAgents
	@type {Array}
	*/
	  _supportedAgents = []

	, _workers = {}

	;


	function api(action, method, data) {
		var 
		  deferred = Q.defer()
		, params
		; 

		if (typeof(method) !== 'string') {
			if (typeof(method) === 'object') {
				data = method;
			}
			method = 'get'; 
		}

		params = { 
			  method: method
			, uri: ["https://", options.user, ":", options.pass, "@saucelabs.com/rest/v1", action].join('')
			, body: JSON.stringify(data)
			, json: true
		};

		request(params, function (error, response, body) {
			if (error) {
				deferred.reject(error);
			} else {
				deferred.resolve(body);
			}
		});

		return deferred.promise;
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
				
				// make sure readyfile is not there when we start
				if (fs.existsSync(path.join(baseDir, readyFile))) {
					return Q(true);
				}

				console.log("Launching tunnelier...");
				
				return Q.delay(exec(util.format("java -jar %s %s %s -f %s -l %s &"
					, tunnelierPath
					, options.user
					, options.pass
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


	function _connect(urlParts, agent) {
		// otherwise proceed normally...
		var conn = wd.promiseRemote("ondemand.saucelabs.com", 80, options.user, options.pass);
		
		return this.resolve(agent)
			.then(function(agent) {
				console.log("%s %s requested.", agent.name, agent.version);
	util.extend(this, {

				return conn.init({
					  browserName: agent.farm.id
					, version: agent.farm.version
				})
				.then(function(sessionId) {
					_workers[agent.getUID()] = {
						  sessionId: sessionId
						, agent: agent
						, conn: conn
					};
					return conn.get(url.format(urlParts));
				});
			});
	}

		/**
		Bring agent to standard format
		*/
		, normalizeAgent: function(agent) {
			var os = agent.os.split(/\s(?=\d)/);

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

			return new Agent({
				  name: agent.long_name
				, id: _normalizeFarmId(agent.api_name)
				, version: +agent.long_version.replace(/^(\d+).*$/, '$1')
				, osName: os[0]
				, osId: _normalizeFarmOs(os[0])
				, osVersion: os[1] || ''
				, farm: {
					  id: agent.api_name
					, version: agent.short_version
					, osId: agent.os
				}
			});
		}

		
		getAvailable: function() {
			if (_supportedAgents.length) {
				Q(_supportedAgents);
			} 

			return api("/info/browsers/webdriver")
				.then(function(sauceAgents) {
					sauceAgents.forEach(function(agent) {
						agent = self.normalizeAgent(agent);
						_supportedAgents[agent.uid] = agent;
					});
					return _supportedAgents;
				});
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


		, kill: function(agentId) {
			var worker;

			if (typeof(agentId.getUID) === 'function') {
				agentId = agentId.getUID();
			}

			worker = _workers[agentId];

			if (!worker) {
				return Q(false);
			}

			return worker.conn.quit()
				.then(function() {
					console.info(worker.agent.name + "(" + worker.sessionId + "): killed.");
					delete _workers[agentId];
				});
		}


		, killAll: function() {

		}
	});
}

module.exports = SauceLabs;
