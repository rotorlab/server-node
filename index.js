var forever = require('forever-monitor');

const TAG = "Flamebase Database";

function FlamebaseDatabaseCluster(database) {

    // object reference
    var object = this;

    this.start = function (callback, force) {
        var forever_config = require('./config/debug.json');
        var child = forever.start('./server.js', forever_config);

        child.on('exit:code', function(code) {
            console.error('Forever detected script exited with code ' + code);
        });
    }

}

module.exports = FlamebaseDatabaseCluster;