// this heavily comes from yeti/cli.js, but slightly altered to meet our needs

var 
  yeti = require("yeti")
, EventEmitter = require("events").EventEmitter
, util = require("./util")
, tty = require("tty")
;


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


function Yeti(config, agents) {
    var 
      self = this
    , client
    , agentsConnected = {}
    ;

    config = util.extend({
        verbose: true
    }, config);

    // gracefully handle Ctrl+C
    process.on('SIGINT', function() {
        process.exit();
    });

    function start(cb) {
        client = yeti.createClient(config.url); // by default localhost:9000

        client.connect(function (err) {
            if (err) {
                createHub(config.url, function() {
                    wait(cb);
                });
            } else if (config.verbose) {
                console.info("Connected to " + config.url);
                 wait(cb);
            }
        });
    }

    function createHub(url, cb) {
        var hub;

        if (config.verbose) {
            console.info("Creating a Hub at " + url);
        }

        hub = new yeti.createHub({
            loglevel: config.loglevel
        });

        hub.listen(config.port);

        hub.once("error", function (err) {
            throw err;
        });

        client = yeti.createClient(url);

        client.connect(function (err) {
            if (err) {
                throw err;
            } else {
                cb();
            }
        });
    }

    function sameBrowsers(uaStr, uaObj) {
        var m, browser, version, map;

        map = {
            'Internet Explorer': 'ie'
        };

        m = uaStr.match(/^([^\(]+)\(([^\.]+)/);
        if (!m) {
            return 'unknown';
        } 

        browser = m[1].trim();
        version = m[2].trim();

        if (map[browser]) {
            browser = map[browser];
        } else {
            browser = browser.toLowerCase();
        }

        return browser === uaObj.browser.toLowerCase() && +version === +uaObj.version;
    }


    function allRequestedAgentsConnected() {
        var connected;

        if (!agents) {
            false;
        }

        agents.forEach(function(uaObj) {
            connected = false;
            Object.keys(agentsConnected).forEach(function(uaStr) {
                if (sameBrowsers(uaStr, uaObj)) {
                    return !(connected = true); // match found, break the loop
                }
            });
            return connected; // if match was found continue, otherwise break and return false
        });
        return connected;
    }


    function wait(cb) {
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
            } 
        });
    
        client.on("agentConnect", function (agent) {
            agentsConnected[agent] = true;

            if (config.verbose) {
                console.info("  Agent connected:", agent);
            }
            self.emit("agentConnect", agent);
        });

        client.on("agentDisconnect", function (agent) {
            delete agentsConnected[agent];

            if (config.verbose) {
                console.info("  Agent disconnected:", agent);
            }
            self.emit("agentDisconnect", agent);
        });

        cb(client);
    }


    function addJob(tests) {
        var batch;

        if (!allRequestedAgentsConnected()) {
            setTimeout(function() { // hold back the script until all requested agents connect
                addJob(tests);
            }, 2000);
        } else {
            batch = client.createBatch({
                basedir: process.cwd(),
                tests: tests
            });

            batch.on("agentResult", function (agent, details) {
                /* details sample

                { Utils: { 
                    name: 'Utils',
                    passed: 58,
                    failed: 1,
                    total: 59,
                    test1: { result: true, message: 'Check array iteration', name: 'test1' },
                    test2: { result: true, message: 'Check array iteration', name: 'test2' },
                    ...
                    test9: { 
                        result: 'fail',
                        message: 'Looping over an array\nExpected: 7 (Number)\nActual: 6 (Number)',
                        name: 'test9' 
                    },
                    passed: 58,
                    failed: 1,
                    total: 59,
                    duration: 75,
                    name: '✖ Plupload Test Suite' 
                  }

                */
                self.emit("agentResult", agent, details);
            });

            batch.on("agentComplete", function(agent) {
                self.emit("agentComplete", agent);
            });

            batch.on("agentScriptError", function (agent, details) {
               self.emit("agentScriptError", agent, details);
            });

            batch.on("agentError", function (agent, details) {
                self.emit("agentError", agent, details);
            });

            batch.on("complete", function () {
                self.emit("complete");
            });
        }
    }


    this.start = start;
    this.addJob = addJob;
}

Yeti.super_ = EventEmitter;
Yeti.prototype = Object.create(EventEmitter.prototype, {
    constructor: {
        value: Yeti,
        enumerable: false
    }
});

module.exports = Yeti;
