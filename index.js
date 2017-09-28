var forever = require('forever-monitor');
var log4js  = require('log4js');

const TAG   = "Flamebase Database";
var logger  = log4js.getLogger(TAG);
logger.level = 'all';


function FlamebaseDatabaseCluster(database, port, APIKey, debug) {

    this.initCluster = function (callback) {
        var child = forever.start('./server.js', {
            silent: false,
            uid: "flamebase-database",
            pidFile: "./flamebase-database.pid",
            max: 10,
            killTree: true,

            minUptime: 2000,
            spinSleepTime: 1000,

            sourceDir: __dirname,

            args:    ['DATABASE_NAME=' + database, 'DATABASE_PORT=' + port, 'API_KEY=' + APIKey, 'DEBUG=' + debug.toString()],

            watch: false,
            watchIgnoreDotFiles: null,
            watchIgnorePatterns: null,
            watchDirectory: null,


            logFile: __dirname + "/logs/logFile.log",
            outFile: __dirname + "/logs/outFile.log",
            errFile: __dirname + "/logs/errFile.log"
        });

        child.on('start', function(code) {
            callback.start();
        });
    }

}

module.exports = FlamebaseDatabaseCluster;