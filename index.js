const forever =            require('forever-monitor');
const logjs =              require('logjsx');

const TAG   = "Flamebase Database";
var logger = new logjs();

logger.init({
    level : "DEBUG"
});


function FlamebaseDatabaseCluster(database, port, debug) {

    this.initCluster = function (callback) {
        let config = {
            silent: false,
            uid: "flamebase-database",
            pidFile: "./flamebase-database.pid",
            max: 10,
            killTree: true,

            minUptime: 2000,
            spinSleepTime: 1000,

            sourceDir: __dirname,

            args:    ['DATABASE_NAME=' + database, 'DATABASE_PORT=' + port, 'DEBUG=' + debug.toString()],

            watch: false,
            watchIgnoreDotFiles: null,
            watchIgnorePatterns: null,
            watchDirectory: null,


            logFile: __dirname + "/logs/logFile.log",
            outFile: __dirname + "/logs/outFile.log",
            errFile: __dirname + "/logs/errFile.log"
        };

        var child = forever.start('./server.js', config);

        child.on('start', function(code) {
            logger.info(config.args);
            callback.start();
        });
    }

}

module.exports = FlamebaseDatabaseCluster;