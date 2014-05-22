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
	  _supportedAgents = {}

	, _workers = {}

	, _tunnelRunning = false

	, _tunnelierName = "Sauce-Connect.jar"

	, _tunnelierReadyFile = "sauce.pid"

	;


		return deferred.promise;
	}


	function _getTunellier(tunnelierPath) {
		if (fs.existsSync(tunnelierPath)) {
			return Q(true);
		}

		console.log("Tunnelier (%s) not found. Retrieving...", _tunnelierName);

		return download("http://saucelabs.com/downloads/Sauce-Connect-latest.zip", {
				to: path.dirname(tunnelierPath)
			})
			.then(function(file) {
				console.log("Unpacking: %s. Wait...", file.name);

				var 
				  buffer = fs.readFileSync(path.join(file.path, file.name))
				, reader = require('zip').Reader(buffer)
				;

				reader.toObject();
				reader.forEach(function (entry) {
					if (entry.getName() === _tunnelierName) {
						fs.writeFileSync(path.join(file.path, _tunnelierName), entry.getData());
					}
				});
				reader.iterator();

				fs.unlinkSync(path.join(file.path, file.name));
				console.log("Done.");
				return true;
			});
	}



					} else {
					}
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
		apiUrl: function(action) {
			return ["https://", options.user, ":", options.pass, "@saucelabs.com/rest/v1", action].join('');
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

		
		, getSupportedAgents: function() {
			var self = this;

			if (!util.isEmptyObj(_supportedAgents)) {
				Q(_supportedAgents);
			} 

			return this.api("/info/browsers/webdriver")
				.then(function(sauceAgents) 
				{
					sauceAgents.forEach(function(agent) {
						agent = self.normalizeAgent(agent);
						_supportedAgents[agent.uid] = agent;
					});
					return _supportedAgents;
				});
		}


		, connect: function(urlParts, agents) {
			var self = this;
		, launchTunellier: function() {
			var 
			  tunnelierPath = path.resolve('tools/' + _tunnelierName)
			, baseDir = path.dirname(tunnelierPath)
			;	

			if (typeof(urlParts) === 'string') {
				urlParts = url.parse(urlParts);
			}
			return _getTunellier(tunnelierPath)
				.then(function() {
					// make sure readyfile is not there when we start
					if (fs.existsSync(path.join(baseDir, _tunnelierReadyFile))) {
						return Q((_tunnelRunning = true));
					}

			if (!util.isArray(agents)) {
				agents = [agents];
			}
					console.log("Launching tunnelier...");

			return isLocal(urlParts.hostname)
				.then(function(result) {
					return result ? _exposeToAgents.call(self, urlParts) : urlParts;
					exec(util.format("java -jar %s %s %s -f %s -l %s &"
						, tunnelierPath
						, options.user
						, options.pass
						, path.join(baseDir, _tunnelierReadyFile)
						, path.join(baseDir, 'sauce.log')
					));

					return Q.delay((_tunnelRunning = true), 1);
				})
				.then(function(urlParts) {
				.then(function() {
					var 
					  queue = []
					, i = agents.length
					  deferred = Q.defer()
					, start = new Date()
					;
					while (i--) {
						queue.push(_connect.call(self, urlParts, agents[i]));

					function isReady() {
						if (fs.existsSync(path.join(baseDir, _tunnelierReadyFile))) {
							deferred.resolve(true);
						} else if (new Date() - start < 120 * 1000) { // 60 secs to launch
							setTimeout(isReady, 500);
						} else {
							deferred.reject("Timeout: Tunnelier failed to launch within 120 secs.");
						}
					}
					return Q.all(queue);
				});	
					isReady();
					return deferred.promise;
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
