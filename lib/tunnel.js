var exec = require('child_process').exec,
	tunnel;

var create = function(config){	
		var cmd = config.tunnel.cmd.replace(/<port>|<url>/g, function($0) {
			if ('<port>' === $0) {
				return config.port;
			} else if ('<url>' === $0) {
				return config.tunnel.url;
			}
		});

		// Hook up ssh tunnel to yeti hub
		tunnel = exec(cmd);
		console.log("Tunnel started. Awaiting agents on: " + config.tunnel.url + "...");
	},

	destroy = function() {
		// Clean up processes on exit
		try {
			tunnel.kill('SIGHUP');
		} catch(e) {}
	};

module.exports = {
	create: create,
	destroy: destroy
};