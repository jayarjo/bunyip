var 
  browserstack = require("browserstack")
, util = require('./util')
, async = require("async")
;

function BrowserStack(config) {
	var workers = [],
		client,
		osMap = {};


	client = browserstack.createClient(config);


	function status() {
		client.getWorkers(function(err, workers) {
			var running = [],
				queued = [];

			workers.forEach(function(worker, i) {
				if(worker.status === "running") {
					running.push((worker.browser || worker.device) + " - " + worker.version + " ("+worker.id+") ");
				} else if(worker.status === "queue") {
					queued.push((worker.browser || worker.device) + " - " + worker.version + " ("+worker.id+") ");
				}
			});

			console.log("Running:\n\t" + running.join("\n\t"));
			console.log("Queued:\n\t" + queued.join("\n\t"));
		});
	}


	function loadBrowsers(url, browsers) {
		browsers.forEach(function(browser, idx){
			browser = util.extend({}, browser, {
				url: url,
				timeout: config.timeout
			});

			client.createWorker(browser, function(err, worker){
				if(err) {
					console.log(err);
					console.log("Whoops! BrowserStack failed to create a worker: %s", err);
				} else {
					console.log("  BrowserStack "+ (browser.browser || browser.device) + " " + browser.version +" worker launched: %s", worker.id);
					workers.push(worker.id);
				}
			});
		});
	}

	function availableBrowsers (cb) {
		client.getBrowsers(function(err, browsers){
			if(!err) {
				cb(browsers);
			}
			console.log(err);
		});
	}

	function killBrowser(id, cb) {
		client.terminateWorker(id, function(err, data) {
			if (err) {
				console.log("Error: There's no such worker running or queued.");
				process.exit(0);
			}

			console.log("Worker %s successfully killed, it ran for %ss", id, Math.round(data.time));
			
			if(cb) {
				cb(err, data, id);
			}
		});
	}

	function killBrowsers(cb) {
		client.getWorkers(function(err, workers) {
			var tasks = [];

			workers.forEach(function(worker, i){
				tasks.push(function(cb2) {
					killBrowser(worker.id, function(err, data, id) {
						cb2(null, data, id);
					});
				});
			});

			async.parallel(tasks, function(error, results) {
				if (cb) {
					cb(null);
				}
			});
		});
	}

	function platformBrowsers(os, cb) {
		osMap = {};

		availableBrowsers(function(browsers) {
			browsers.forEach(function(browser, i) {
				if(!osMap[browser.os]) {
					osMap[browser.os] = [];
				} 

				osMap[browser.os].push({
					browser: browser.browser || "",
					device: browser.device || "",
					version: browser.version,
					os: browser.os
				});
			});

			cb(osMap[os]);
		});
	}


	function parseBrowsers(browsers, cb) {
		if (typeof browsers !== 'string' || !/^(all|ios|win|mac|android|opera)$/.test(browsers)) {
			cb(false);
		}

		if ('all' === browsers) {
			availableBrowsers(cb);
		} else {
			platformBrowsers(browsers, cb);
		}
	}


	function listAvailableBrowsers() {
		availableBrowsers(function(browsers){
			var list = "",
				browser,
				device = {},
				curBrowser;

			for (var i = 0; i < browsers.length; i++) {
				curBrowser = browsers[i];

				if(curBrowser.device) {
					if(curBrowser.device === device.platform || curBrowser.version === device.version) {
						list += " " + curBrowser.device  + ", ";
					} else {
						list += "\n" + curBrowser.os + " "+ curBrowser.version + ": " + curBrowser.device + ",";
					}
				} else if(curBrowser.browser === browser) {
					list += " " + curBrowser.version  + ", ";
				} else {
					list += "\n" + curBrowser.browser + " ("+ curBrowser.os + "): " + curBrowser.version + ", ";
				}

				browser = curBrowser.browser;
				device = {
					platform: curBrowser.device,
					version: curBrowser.version
				};

			}
			console.log(list);
		});
	}


	this.status = status;
	this.parseBrowsers = parseBrowsers;
	this.loadBrowsers = loadBrowsers;
	this.killBrowser = killBrowser;
	this.killBrowsers = killBrowsers;
	this.availableBrowsers = availableBrowsers;
	this.platformBrowsers = platformBrowsers;
	this.listAvailableBrowsers = listAvailableBrowsers;
}

module.exports = BrowserStack;
