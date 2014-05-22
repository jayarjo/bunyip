var
  Q = require('q')
, url = require('url')
, request = require('request')
, EventEmitter = require('events').EventEmitter
, util = require('./util')
, isLocal = require('./ip')
, Agent = require('./Agent')
, SauceLabs = require('./saucelabs')
, BrowserStack = require('./browserstack')
;

/**
Supplies the Tester with requested Agents. If tester is running on a local server,
will try to establish the tunnel.

@constructor 
@class AgentFarm
@param {String} farm Identifier of the agent breeding farm (saucelabs or browserstack)
@param {Object} options
	@param {String} options.user
	@params {String} options.pass
*/
function AgentFarm(farm, options) {
	if (!options.user || !options.pass && !options.key) {
		console.log("Error: Credentials for %s not supplied or wrong.", farm);
		process.exit(1);
	}

	if (farm === 'browserstack') {
		BrowserStack.call(this, options);
	} else {
		SauceLabs.call(this, options);
	}


	util.extend(this, {

		agents: {}

		/**
		Generate the functional Url for the specified action

		@method apiUrl
		@param {String} action
		@return {String} Functional Url for the action
		....
		*/

		
		/**
		Make an API call

		@method api
		@param {String} action
		@param {String|Object} [method="get"] (if Object is passed will be considered as @param data)
		@param {Object} data
		@return {Promise}
		*/
		, api: function(action, method, data) {
			var deferred = Q.defer()
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
				, uri: this.apiUrl(action)
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


		/**
		Bring agent to standard format

		@method normalizeAgent
		@param {Object} agent Agent identifier object in farm specific format
		@return {Agent} Normalized agent object 
		....
		*/


		/**
		Retrieve all agents supported by the current farm

		@method getSupportedAgents
		@return {Promise} Either rejected or resolved with the list of agents
		....
		*/


		/**
		Request the specified agent to the specified url.

		@method connect
		@param {String} url Url to navigate agent to
		@param {String|Object|Array} agent Agent identifier or an array of such
		@return {Promise}
		....
		*/


		/**
		Resolves agent id or partial object to full agent identifying object.

		e.g. for 'chrome' will return an object like this:
			{
				  name: 'Google Chrome'
				, id: 'chrome'
				, farmId: 'chrome'
				, version: '25'
				, osId: 'win'
				, osName: 'Windows'
				, osVersion: '2012'
			}
		
		@method resolveAgents
		@params {String|Object} agent Either normalized id or a set of agent identifiers
		@return {Promise} Promise fulfilled with agent identifying object or null
		*/
		, resolveAgents: function (requestedAgents) {
			var agents = {};

			return this.getSupportedAgents()
				.then(function(supportedAgents) {

					util.each(requestedAgents, function(requestedAgent) {
						var uid = Agent.getUID(requestedAgent);
						if (supportedAgents[uid]) {
							agents[uid] = supportedAgents[uid];
						} else if (options.verbose) {
							console.log("Requested agent cannot be resolved: %s", uid);
						}
					});

					if (!util.isEmptyObj(agents)) {
						return agents;
					}					
					return Q.reject("None of the requested agents is available from the agent farm.");
				});
		}


		, getPendingAgent: function() {
			var agentPicked = null;

			util.each(this.agents, function(agent) {
				if (agent.state == Agent.INIT) {
					agentPicked = agent;
					return false;
				}
			});

			return agentPicked ? agentPicked : false;
		}

		/**
		Prints out list of agents available from current agent farm.

		@method list 
		*/
		, list: function() {
			this.getAvailable().done(function() {
				
			});
		}


		/**
		Request agents from the farm to connect to the specified url

		@method requestAgents
		@param {String|Object} toUrl Either url or pre-parsed object containing url parts
		...
		*/


		

	});
}

util.inherits(AgentFarm, EventEmitter);

module.exports = AgentFarm;