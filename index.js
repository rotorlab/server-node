var forever = require('forever-monitor');
var log4js  = require('log4js');

const TAG   = "Flamebase Database";
var logger  = log4js.getLogger(TAG);

function FlamebaseDatabaseCluster(database) {

    // object reference
    var object = this;

    this.initCluster = function (callback, force) {
        var forever_config = require('./config/debug.json');
        var child = forever.start('./server.js', forever_config);

        child.on('start', function(code) {
            callback.start();
        });
    }

}

module.exports = FlamebaseDatabaseCluster;