var 
exec = require('child_process').exec,
util = require('./util');

function Tunnel(config) {
	var self = this, tunnel;

	config = util.extend({
		verbose: true
	}, config);

	// gracefully handle Ctrl+C
	process.on('SIGINT', function() {
		self.destroy();
	});

	// clean up processes on exit
	process.on('exit', function () {
		self.destroy();
	});


	function create(from, to) {
		var cmd, params;

		from = util.extend({
			url: 'localhost',
			port: 80
		}, from);

		to = util.extend({
			url: config.url, 
			port: from.port
		}, to);

		params = util.extend({}, config, to, {
			localhost: from.url,
			localport: from.port,
		});

		cmd = config.cmd;

		if (params.localhost !== 'localhost') {
			/* not exactly performant solution, as it doesn't support persisstent http connections, 
			but for small to mid projects should be just fine */
			cmd += " --be_config=<url>/<port>:rewritehost:True"; 
		}

		cmd = cmd.replace(/(<([^>]+)>)/g, function($0, $1, $2) {
			return params[$2] ? params[$2] : "";
		});

		tunnel = exec(cmd);
	}

	function destroy() {
		try {
			tunnel.kill('SIGHUP');
		} catch(e) {}
	}

	this.create = create;
	this.destroy = destroy;
}

module.exports = Tunnel;