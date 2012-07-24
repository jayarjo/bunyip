var 
  exec = require('child_process').exec
, request = require("request")
, async = require("async")
, util = require('./util')
, color = require("./color").codes
;

function Tunnel(config) {
	var self = this, tunnel;

	config = util.extend({
		verbose: true
	}, config);


	function create(from, to, cb) {
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

		isFunctional(params, function(result, tunnel) {
			if (!result) {
				cmd = config.cmd;

				if (params.localhost !== 'localhost') {
					// not exactly performant solution, as it doesn't support persisstent http connections, 
					// but for small to mid projects should be just fine 
					cmd += " --nullui --logfile=/dev/null --be_config=<url>/<port>:rewritehost:True"; 
				}

				cmd = cmd.replace(/(<([^>]+)>)/g, function($0, $1, $2) {
					return params[$2] ? params[$2] : "";
				});
				tunnel = exec(cmd);
			} 

			if (typeof cb === 'function') {
				cb();
			}
		});
	}


	function destroy() {
		try {
			tunnel.kill('SIGHUP');
		} catch(e) {}
	}


	function isRunning(params, cb) {
		var found = false;

		getList(function(list) {
			util.each(list, function(tunnel) {
				if (tunnel.local.url === tunnel.local.protocol + params.localhost + ':' + params.localport && 
					tunnel.remote.url === tunnel.remote.protocol + params.url + ':' + params.port) {
					cb(tunnel, list);
					return !(found = true);
				}
			});

			if (!found) {
				cb(false, list);
			}
		});
	}


	function isFunctional(params, cb) {
		async.waterfall([
			function(cb2) {
				isRunning(params, function(tunnel, list) {
					if (!tunnel) {
						cb2("Tunnel not found", list);
					} else {
						cb2(null, tunnel);
					}
				});
			},

			function(tunnel, cb2) {
				request.get({
					url: tunnel.remote.url
				}, function (error, response, body) {
					if (error || response.statusCode == 503) {
						// running, but not functional... probably zombie, kill it...
						kill(tunnel.pid);
						cb2("Tunnel not functional", tunnel);
					} else {
						cb2(null, tunnel);
					}
				});
			}

		], function(error, results) {
			if (error) {
				cb(false, tunnel);
			} else {
				cb(true, tunnel);
			}
		});
	}


	function getList(cb) {
		exec("ps -ef | grep pagekite | grep -v grep", function(error, stdout, stderr) {
			var list = [];

			if (!error) {
				stdout.split(/\n/).forEach(function(line) {
					var m, pid, protocol;

					m = line.match(/^\s*\d+\s*([^\s]+).+backend=([^\/]+)\/([^:]+):([^:]+):([^:]+):([^:]+):/);
					if (m) {
						pid = m[1];
						protocol = m[2] + "://";
						
						list.push({
							pid: pid,
							local: {
								protocol: protocol,
								host: m[5],
								port: m[6] || 80,
								url: protocol + m[5] + ':' + m[6]
							},
							remote: {
								protocol: protocol,
								host: m[4],
								port: m[3] || 80,
								url: protocol + m[4] + ':' + m[3]
							}
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
					console.info(t.pid + "\t" + t.local.url + ' -> ' + t.remote.url);
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


	function killAll(cb) {
		getList(function(tunnels) {
			tunnels.forEach(function(tunnel) {
				kill(tunnel.pid);
			});	

			if (typeof cb === 'function') {
				cb(null);
			}
		});
	}


	this.create = create;
	this.destroy = destroy;
	this.list = list;
	this.kill = kill;
	this.killAll = killAll;
}

module.exports = Tunnel;
