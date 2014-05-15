var
  Q = require('q')
, util = require('./util')
, SauceLabs = require('./saucelabs')
, BrowserStack = require('./browserstack')
;


function AgentFarm(farm, options) {

	if (!options.user || !options.pass) {
		console.log("Error: Credentials for %s not supplied or wrong.", farm);
		process.exit(1);
	}

	if (farm === 'browserstack') {
		BrowserStack.call(this, options);
	} else {
		SauceLabs.call(this, options);
	}

	util.extend(this, {

		/**
		Request the specified agent to the specified url.

		@method connect
		@param {String} url Url to navigate agent to
		@param {String|Object|Array} agent Agent identifier or an array of such
		@return {Promise}
		*/
		//# connect: function(url, agent)

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
		
		@method resolve
		@params {String|Object} agent Either normalized id or a set of agent identifiers
		@return {Promise} Promise fulfilled with agent identifying object or null
		*/
		resolve: function (agent) {

			function matches(candidate, member) {
				return candidate.getUID() === [member.id, member.version, member.osId].join(':');
			}

			if (typeof(agent) === 'string') {
				agent = {
					id: agent
				};
			}
			return this.getAvailable()
				.then(function(agents) {
					for (var i = 0, length = agents.length; i < length; i ++) {
						if (matches(agent, agents[i])) {
							return agent;
						}
					}

					var err = util.format("Requested agent cannot be resolved: %s", agent.getUID());
					console.error(err);
					return Q.reject(err);
				});
		}


		/**
		Prints out list of agents available from current agent farm.

		@method list 
		*/
		, list: function() {
			this.getAvailable().done(function() {
				
			});
		}


		

	});
}

module.exports = AgentFarm;
