var
  EventEmitter = require('events').EventEmitter
, util = require('./util')
;


function Agent(data) {
	var _requestTimer
	, _startTime = 0
	, _duration = 0
	;

	if (typeof(data) === 'string') { // probably uid
		var parts = data.split(':');
		data = {
			  id: parts[0]
			, version: parts[1]
			, osId: parts[2]
		};
	}

	// defaults are for Chrome on Windows requested from SauceLabs
	util.extend(this, {
		  name: 'Google Chrome'
		, id: 'chrome'
		, version: 26
		, osId: 'win'
		, osVersion: '2003'
		, osName: 'Windows'
		, farm: {
			  id: 'chrome'
			, version: '26.0'
			, osId: 'WINDOWS'
		}

		, state: Agent.INIT

		, getUID: function() {
			return [this.id, this.version, this.osId].join(':');
		}

		, getRunDuration: function() {
			return _duration;
		}

		, requested: function() {
			var self = this;
			this.state = Agent.REQUESTED;
			_requestTimer = setTimeout(function() {
				self.state = Agent.FAILED;
				self.emit('AgentTimeout');
			}, Agent.TTL);
		}

		, started: function() {
			clearTimeout(_requestTimer);
			this.state = Agent.RUNNING;
			_startTime = +new Date();
		}

		, completed: function(result) {
			this.state = result ? Agent.DONE : Agent.FAILED;
			return (_duration = +new Date() - _startTime);
		}

		, toObject: function() {
			return {
				 name: this.name
				, id: this.id
				, version: this.version
				, osId: this.osId
				, osVersion: this.osVersion
				, osName: this.osName
				, farm: this.farm
			};
		}
	}, data);

	this.uid = this.getUID();
}


Agent.INIT = 0;
Agent.REQUESTED = 1;
Agent.RUNNING = 2;
Agent.DONE = 4;
Agent.FAILED = 5;

Agent.TTL = 10000;


Agent.super_ = EventEmitter;
Agent.prototype = Object.create(EventEmitter.prototype, {
    constructor: {
        value: Agent,
        enumerable: false
    }
});

module.exports = Agent;
