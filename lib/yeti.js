// this heavily comes from yeti/cli.js, but slightly altered to meet our needs

var 
  yeti = require('yeti')
, EventEmitter = require('events').EventEmitter
, url = require('url')
, util = require('./util')
;


function Yeti(urlParts, options) {
    var 
      self = this
    , client
    ;

    function _createHub(url, cb) {
        var hub;

        if (options.verbose) {
            console.log("Creating a Hub at %s...", urlParts);
        }

        hub = new yeti.createHub({
            loglevel: options.loglevel
        });

        hub.listen(urlParts.port);

        hub.once('error', function (err) {
            self.emit('error', err);
        });

        client = yeti.createClient(url.format(urlParts));

        client.connect(function (err) {
            if (err) {
               self.emit('error', err);
            } else {
                cb();
            }
        });
    }


    options = util.extend({
          verbose: true
        , loglevel: 'silent'
    }, options || {});


    util.extend(this, {

        start: function() {
            client = yeti.createClient(url.format(urlParts)); 

            client.on('agentConnect', function (agent) {
                self.emit('agentConnect', agent);
            });

            client.on('agentDisconnect', function (agent) {
                self.emit('agentDisconnect', agent);
            });

            client.connect(function (err) {
                if (err) {
                    console.info(err);
                    _createHub(urlParts, function() {
                        self.emit('ready');
                    });
                } else {
                    if (options.verbose) {
                        console.log("Connected to s%.", url.format(urlParts));
                    }
                    self.emit('ready');
                }
            });
        }


        , addJob: function(tests) {
            var batch;

            batch = client.createBatch({
                  basedir: process.cwd()
                , tests: tests
            });

            batch.on('agentResult', function (agent, details) {
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
                self.emit('agentResult', agent, details);
            });

            batch.on('agentComplete', function(agent) {
                self.emit('agentComplete', agent);
            });

            batch.on('agentScriptError', function (agent, details) {
               self.emit('agentScriptError', agent, details);
            });

            batch.on('agentError', function (agent, details) {
                self.emit('agentError', agent, details);
            });

            batch.on('complete', function () {
                self.emit('complete');
            });
        }
    });
}


Yeti.super_ = EventEmitter;
Yeti.prototype = Object.create(EventEmitter.prototype, {
    constructor: {
        value: Yeti,
        enumerable: false
    }
});

module.exports = Yeti;
