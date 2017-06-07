var exec = require('child_process').spawn;

const TAG = "Flamebase Database";

function FlamebaseDatabaseServerCluster(database) {

    // object reference
    var object = this;

    this.start = function (callback, force) {
        var child = exec('node ./server.js');

        child.stdout.on('data', function(data) {
            console.log('stdout: ' + data);
        });
        child.stderr.on('data', function(data) {
            console.log('stdout: ' + data);
        });
        child.on('close', function(code) {
            console.log('closing code: ' + code);
        });
    }

}

module.exports = FlamebaseDatabaseServerCluster;