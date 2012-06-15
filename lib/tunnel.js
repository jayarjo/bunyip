var exec = require('child_process').exec,
	tunnel;

var create = function(port, url){
		// Hook up ssh tunnel to yeti hub
		tunnel = exec('pagekite.py ' + port + ' ' + url);
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