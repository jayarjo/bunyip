var browserstack = require("browserstack");

var workers = [],
	osMap = {};


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


function loadBrowsers(browsers, cb) {
	browsers.forEach(function(browser, idx){
		client.createWorker(browser, function(err, worker){
			if(err) {
				console.log(err);
				console.log("Whoops! BrowserStack failed to create a worker: %s", err);
			} else {
				console.log("  BrowserStack "+ (browser.browser || browser.device) + " " + browser.version +" worker launched: %s", worker.id);
				workers.push(worker.id);
			}

			// if finished loading  invoke callback
			if (browsers.length === workers.length) {
				cb(workers);
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
	client.terminateWorker(id, function(err, data, id) {
		if(cb) {
			cb(err, data, id);
		}
	});
}

function killBrowsers() {
	client.getWorkers(function(err, workers) {
		var ids = [];

		workers.forEach(function(worker, i){
			ids.push(worker.id);
		});

		ids.forEach(function(id, i){
			killBrowser(id, function(err, data, id){
				console.log("Worker %s successfully killed, it ran for %ss", id, Math.round(data.time));
			});
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


function parseBrowsers(browserStr, cb) {

	process.nextTick(function () {
		var platforms = /^(all|ios|win|mac|android|opera)$/,
			browsers = [],
			file = false;

		if(platforms.test(browserStr)) {
			switch(browsers) {
				case "all":
					availableBrowsers(cb);
					return;
				case "ios":
					platformBrowsers("ios", cb);
					return;
				case "android":
					platformBrowsers("android", cb);
					return;
				case "opera":
					platformBrowsers("opera", cb);
					return;
				case "win":
					platformBrowsers("win", cb);
					return;
				case "mac":
					platformBrowsers("mac", cb);
					return;
			}	
		} else {

			// You can pass in a JSON file specifying the browsers
			try {
				browsers = JSON.parse(fs.readFileSync(browserStr, 'utf8'));
				cb(browsers);	
				return;
			} catch(e) {}
			
			if(file) {
				browsers = file;
			} else {
				// Browser string has been passed, parse it
				var opt = browserStr.split('|'),
					versions, os, platform, data;

				opt.forEach(function(browser,i) {
					data = browser.split("/");
					platform = data[0].split(":");
					browser = platform[0];
					os = platform[1];
					versions = data[1].split(',');

					versions.forEach(function(ver, i) {
						browsers.push({
							browser: browser,
							device:  browser,
							os: os,
							version: ver
						});
					});
				});
			}

			cb(browsers);	
		} 
	});
}


function requestAgents(config, cb) {
	var url = encodeURI(config.tunnel.url.replace(/^http:\/\//, '')),
		timeout = config.timeout;

	client = browserstack.createClient(config.browserstack);

	parseBrowsers(config.browsers, function(list){
		list.forEach(function(browser, i) {
			browser.url = url;
			browser.timeout = timeout;
		});

		process.nextTick(function() {
			loadBrowsers(list, cb);
		});
	});
}

module.exports = {
	status: 			status,
	requestAgents: 		requestAgents,
	loadBrowsers: 		loadBrowsers,
	availableBrowsers:	availableBrowsers,
	killBrowser:		killBrowser,
	killBrowsers:		killBrowsers,
	platformBrowsers:	platformBrowsers
};