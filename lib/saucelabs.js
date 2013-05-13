var 
  Q = require('q')
, wd = require('wd')
, request = require('request')
, util = require('./util')
;


function SauceLabsFarm(options) {
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
	, accessKey = options.accessKey
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


		, connect: function(agentId, url) {
			var conn = wd.promiseRemote("ondemand.saucelabs.com", 80, username, accessKey);
			
			return this.resolve(agentId)
				.then(function(agent) {
					return conn.init({
						  browserName: agent.farmId
						, version: agent.version
					})
					.then(function(sessionId) {
						_workers[sessionId] = {
							  agent: agent
							, conn: conn
						};
						return conn.get(url);
					});
				});
		}


		, kill: function(sessionId) {
			var worker = _workers[sessionId];
			if (!worker) {
				return Q.delay(1);
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

module.exports = SauceLabsFarm;
