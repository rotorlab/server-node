const forever =            require('forever-monitor');
const logjs =              require('logjsx');
const logger = new logjs();

logger.init({
    level : "DEBUG"
});

function RotorServer() {

    this.initCluster = function (callback) {
        let db_name = "database";
        let server_port = 1507;
        let redis_port = 6379;
        let uid = "flamebase-database";
        let log_dir = "logs/";
        let debug = false;

        if (callback.config !== undefined) {
            if (callback.config.db_name !== undefined && callback.config.db_name.length > 0) {
                db_name = callback.config.db_name;
            }
            if (callback.config.server_port !== undefined && callback.config.server_port > 0) {
                server_port = callback.config.server_port;
            }
            if (callback.config.redis_port !== undefined && callback.config.redis_port > 0) {
                redis_port = callback.config.redis_port;
            }
            if (callback.config.debug !== undefined && callback.config.debug) {
                debug = callback.config.debug;
            }
            if (callback.config.log_dir !== undefined && callback.config.log_dir) {
                log_dir = callback.config.log_dir;
            }
        }

        let config = {
            silent: false,
            uid: uid,
            pidFile: "./" + uid + ".pid",
            max: 10,
            killTree: true,

            minUptime: 2000,
            spinSleepTime: 1000,

            sourceDir: __dirname,

            args:    ['DATABASE_NAME=' + db_name, 'DATABASE_PORT=' + server_port, 'REDIS_PORT=' + redis_port, 'DEBUG=' + debug.toString()],

            watch: false,
            watchIgnoreDotFiles: null,
            watchIgnorePatterns: null,
            watchDirectory: null,


            logFile: __dirname + "/" + log_dir + "logFile.log",
            outFile: __dirname + "/" + log_dir + "outFile.log",
            errFile: __dirname + "/" + log_dir + "errFile.log"
        };

        let child = forever.start('./server.js', config);
        child.on('start', function(code) {
            logger.info(config.args);
            callback.start();
        });
    }

}

module.exports = RotorServer;