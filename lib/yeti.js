// this heavily comes from yeti/cli.js, but slightly altered to meet our needs

var yeti = require("yeti"),
	tty = require("tty"),
	color = require("../node_modules/yeti/lib/color").codes;

var good = "✔";
var bad = "✖";


function error() {
    var args = Array.prototype.slice.apply(arguments);
    console.error.apply(console, args);
}

function panic() {
    var args = Array.prototype.slice.apply(arguments);
    error.apply(panic, args);
    process.exit(1);
}

function puts() {
    var args = Array.prototype.slice.apply(arguments);
    console.log.apply(console, args);
}


function setupProcess() {
    process.on("uncaughtException", function (err) {
        var message;

        if ("string" !== typeof err) {
            err = err.stack;
        }

        if (isTTY) {
            message = [
                color.red(bad + " Whoops!") + " " + err, "",
                "If you believe this is a bug in Yeti, please report it.",
                "    " + color.bold(meta.bugs.url),
                "    Yeti v" + meta.version,
                "    Node.js " + process.version
            ];
        } else {
            message = [
                "Yeti v" + meta.version + " " +
                    "(Node.js " + process.version +
                    ") Error: " + err,
                "Report this bug at " + meta.bugs.url
            ];
        }

        panic(message.join("\n"));
    });
}


function submitBatch(client, tests) {
    error(good, "Testing started!");

    function displayVerboseResult(result) {
        var lastSuite, k, k1,
            suite, test, msg, m;
        for (k in result) {
            suite = result[k];
            if ("object" === typeof suite) {
                if (suite.failed) {
                    for (k1 in suite) {
                        test = suite[k1];
                        if ("object" === typeof test) {
                            if ("fail" === test.result) {
                                if (!lastSuite || lastSuite !== suite.name) {
                                    error("   in", color.bold(suite.name));
                                    lastSuite = suite.name;
                                }
                                msg = test.message.split("\n");
                                error("    ", color.bold(color.red(test.name)) + ":", msg[0]);
                                for (m = 1; m < msg.length; m = m + 1) {
                                    error("       " + msg[m]);
                                }
                            }
                        }
                    }
                }
            }
        }
        error("");
    }

    var batch = client.createBatch({
            basedir: process.cwd(),
            tests: tests
        }),
        timeStart = Number(new Date()),
        batchDetails = {
            passed: 0,
            failed: 0
        };

    batch.on("agentResult", function (agent, details) {
        var passed = details.passed,
            failed = details.failed,
            icon = failed ? bad : good,
            iconColor = failed ? color.red : color.green;

        batchDetails.passed += passed;
        batchDetails.failed += failed;

        error(iconColor(icon), color.bold(details.name), "on", agent);

        if (failed) {
            displayVerboseResult(details);
        }
    });

    batch.on("agentScriptError", function (agent, details) {
        error(color.red(bad + " Script error") + ": " + details.message);
        error("  URL: " + details.url);
        error("  Line: " + details.line);
        error("  User-Agent: " + agent);
    });

    batch.on("agentError", function (agent, details) {
        error(color.red(bad + " Error") + ": " + details.message);
        error("  User-Agent: " + agent);
    });

    batch.on("agentComplete", function (agent) {
        error(good, "Agent completed:", agent);
    });

    batch.on("complete", function () {
        var duration = Number(new Date()) - timeStart,
            total = batchDetails.passed + batchDetails.failed,
            durationString = "(" + duration + "ms)";

        if (batchDetails.failed) {
            error(color.red("Failures") + ":", batchDetails.failed,
                "of", total, "tests failed.", durationString);
            process.exit(1);
        } else {
            error(color.green(total + " tests passed!"), durationString);
            process.exit(0);
        }
    });
}


function start(config, cb) {
	var port = config.port,
		url = config.hub,
		files = config.args;

	function prepareTests(client) {
        // In this case, nobody is connected yet.
        // If we connected to a server, we would list
        // the current agents.

        process.stdin.resume();
        tty.setRawMode(true);

        process.stdin.on("keypress", function (s, key) {
            if (key.ctrl) {
                switch (key.name) {
                case "c":
                    process.kill(process.pid, "SIGINT");
                    break;
                case "z":
                    process.kill(process.pid, "SIGSTP");
                    break;
                }
            } else if (key.name !== "enter") {
                error("Press Enter to begin testing, or Ctrl-C to exit.");
            } else {
                startTesting(client, files);
            }
        });
        error("Waiting for agents to connect at " + url + ".");

        if (config.wait) {
        	error("When ready, press Enter to begin testing.");
        }

        client.on("agentConnect", function (agent) {
            error("  Agent connected:", agent);
        });

        client.on("agentDisconnect", function (agent) {
            error("  Agent disconnected:", agent);
        });

        cb(client);
    }

	function createHub() {
        url = "http://localhost:" + port;

        error("Creating a Hub at " + url);

        var client,
        	hub = new yeti.createHub({
	            loglevel: config.loglevel
	        });

        hub.listen(port);

        hub.once("error", function (err) {
            throw err;
        });

        client = yeti.createClient(url);

        client.connect(function (err) {
            if (err) {
                throw err;
            } else {
                prepareTests(client);
            }
        });
    }

	function connectToURL(url) {
        var client = yeti.createClient(url);
        client.connect(function (err) {
            if (err) {
                createHub();
            } else {
                error("Connected to " + url);
                prepareTests(client);
            }
        });
    }

    setupProcess();

    url = "http://" + url.replace(/^http:\/\//, '') + ':' + port;
    connectToURL(url);
}


function startTesting(client, files) {
	if (files && files.length) {
		tty.setRawMode(false);
	    process.stdin.pause();
	    submitBatch(client, files);
	}
}


function stop() {

}


module.exports = {
	start: start,
	startTesting: startTesting,
	stop: stop
};