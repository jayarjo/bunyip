var
  util = require('./util')
, SauceLabsFarm = require('./saucelabs.js')
//, BrowserStackFarm = require('./browserstack')
;


function AgentFarm(farm, options) {
	var farms = {
		  saucelabs: SauceLabsFarm
		//, browserstack: BrowserStackFarm
	};

	if (typeof(farms[farm]) === 'function') {
		farms[farm].call(this, options);
	} else {
		throw "Not supported service: " + farm;
	}


	util.extend(this, {

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
		@return {Object} Full agent identifying object or null
		*/
		resolve: function (agent) {

			function matches(candidate, member) {
				var matched = true;
				util.each(candidate, function(value, key) {
					if (member[key] !== value) {
						return (matched = false);
					}
				});
				return matched;
			}

			if (typeof(agent) === 'string') {
				agent = {
					id: agent
				};
			}
			return this.getAvailable().then(function(agents) {
				for (var i = 0, length = agents.length; i < length; i ++) {
					if (matches(agent, agents[i])) {
						return agents[i];
					}
				}
				return null;
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
