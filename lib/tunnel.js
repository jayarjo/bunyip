var 
  exec = require('child_process').exec
, util = require('./util')
, color = require("./color").codes
;

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


	function getList(cb) {
		exec("ps -ef | grep pagekite | grep -v grep", function(error, stdout, stderr) {
			var list = [];

			if (!error) {
				stdout.split(/\n/).forEach(function(line) {
					var m, pid, protocol, localhost, remotehost;

					m = line.match(/^\s*\d+\s*([^\s]+).+backend=([^\/]+)\/([^:]+):([^:]+):([^:]+):([^:]+):/);
					if (m) {
						pid = m[1];
						protocol = m[2] + "://";
						localhost = protocol + m[5] + ':' + m[6];
						remotehost = protocol + m[4] + ':' + m[3];
						list.push({
							pid: pid,
							localhost: localhost,
							remotehost: remotehost
						});
					}
				});
			}
			cb(list);
		});
	}


	function list() {
		getList(function(tunnels) {
			if (!tunnels.length) {
				console.info("No active tunnels found");
				process.exit(0);
			} else {
				console.info(color.green("Active tunnels: "));
				console.info(color.bold("pid\ttunnel"));

				tunnels.forEach(function(t) {
					console.info(t.pid + "\t" + t.localhost + ' -> ' + t.remotehost);
				});
			}
		});
	}


	function kill(pid) {
		exec("kill -9 " + pid, function(error) {
			if (error) {
				console.info("No such tunnel.");
			} else {
				console.info("Tunnel " + pid + " killed.");
			}
		});
	}


	this.create = create;
	this.destroy = destroy;
	this.list = list;
	this.kill = kill;
}

module.exports = Tunnel;
