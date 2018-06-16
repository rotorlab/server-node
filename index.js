const forever =             require('forever-monitor');
// const Turbine =             require('./turbine_index.js');
const Turbine =             require('@efraespada/turbine');
const App =                 require('./ide_index.js');
const logjs =               require('logjsx');
const Redis =               require('ioredis');
const fs =                  require('fs');
const path =                require('path');
const logger = new logjs();

function RotorServer(callback) {

    let o = this;
    this.databases = ["paths", "notifications"];
    this.server_port = 1507;
    this.redis_port = 6379;
    this.turbine_port = 4000;
    this.ide_port = 5000;
    this.uid = "rotor-server";
    this.log_dir = "logs/";
    this.debug = false;
    this.redis_error = false;

    this.start = function () {
        if (callback !== undefined) {
            // databases
            if (callback.databases !== undefined && callback.databases.length > 0) {
                let databases = callback.databases;
                for (let d in databases) {
                    if (!this.databases.includes(databases[d])) {
                        this.databases.push(databases[d])
                    }
                }
            } else {
                logger.error("no db name defined on rotor configuration, adding myDatabase db");
                this.databases.push("myDatabase");
            }

            // rotor server port
            if (callback.server_port !== undefined && callback.server_port > 0) {
                this.server_port = callback.server_port;
            } else {
                logger.error("no port defined for rotor server, using default: " + this.server_port);
            }

            // redis port
            if (callback.redis_port !== undefined && callback.redis_port > 0) {
                this.redis_port = callback.redis_port;
            } else {
                logger.error("no port defined for redis server, using default: " + this.redis_port);
            }

            // turbine port
            if (callback.turbine_port !== undefined && callback.turbine_port > 0) {
              this.turbine_port = callback.turbine_port;
            } else {
              logger.error("no port defined for turbine, using default: " + this.turbine_port);
            }

            // ide port
            if (callback.ide_port !== undefined && callback.ide_port > 0) {
                this.ide_port = callback.ide_port;
            } else {
                logger.error("no port defined for rotor IDE, using default: " + this.ide_port);
            }

            // debug
            if (callback.debug !== undefined && callback.debug) {
                this.debug = callback.debug;
            } else {
                logger.error("no debug value defined, using default: " + this.debug);
            }
        }

        if (this.debug) {
            logger.init({
                level : "DEBUG"
            });
        }

        let config = {
            silent: false,
            uid: o.uid,
            pidFile: "./" + o.uid + ".pid",
            max: 10,
            killTree: true,

            minUptime: 2000,
            spinSleepTime: 1000,

            sourceDir: __dirname,

            args:    ['DATABASES=' + this.databases, 'DATABASE_PORT=' + this.server_port, 'REDIS_PORT=' + this.redis_port, 'TURBINE_PORT=' + this.turbine_port, 'DEBUG=' + this.debug.toString()],

            watch: false,
            watchIgnoreDotFiles: null,
            watchIgnorePatterns: null,
            watchDirectory: null,


            logFile: __dirname + "/" + this.log_dir + o.uid + "/logFile.log",
            outFile: __dirname + "/" + this.log_dir + o.uid + "/outFile.log",
            errFile: __dirname + "/" + this.log_dir + o.uid + "/errFile.log"
        };

        let redis = new Redis(this.redis_port);
        redis.on("error", async function(err) {
            if (!o.redis_error) {
                if (err.toString().indexOf("connect ECONNREFUSED") > 1) {
                    console.log("launching redis on port " + o.redis_port)
                    await o.startRedis()
                } else {
                    console.error("err: " + err)
                }
                o.redis_error = true;
            }
        });
        redis.on("ready", async function () {
            await o.createDir(o.log_dir + o.uid);
            logger.info("Redis server already started (" + o.redis_port + ")");
            /*
            let app = new App({log_dir:o.log_dir});
            app.start(o.ide_port).then(function () {
                // nothing to do here
            });*/

            let child = forever.start('./server.js', config);
            child.on('start', function(code) {
                logger.info("Rotor server started (" + o.server_port + ")");
                let turbine = new Turbine({
                    turbine_port: o.turbine_port,
                    debug: o.debug,
                    log_dir: o.log_dir,
                    databases: o.databases
                });
                turbine.server();
            });
        })
    };

    this.startRedis = async function () {
        let process = "redis";
        let redis_config = {
            silent: false,
            uid: process,
            pidFile: "./" + process + ".pid",
            max: 10,
            killTree: true,

            minUptime: 2000,
            spinSleepTime: 1000,

            args: [],

            watch: false,
            watchIgnoreDotFiles: null,
            watchIgnorePatterns: null,
            watchDirectory: null,

            logFile: __dirname + "/" + o.log_dir + process + "/logFile.log",
            outFile: __dirname + "/" + o.log_dir + process + "/outFile.log",
            errFile: __dirname + "/" + o.log_dir + process + "/errFile.log"
        };

        await this.createDir(o.log_dir + process + "/");

        let app = forever.start(["redis-server", "--port", o.redis_port + "", "--protected-mode", "no"], redis_config);
        app.on('start', function (code) {
            logger.info("Redis server started (" + o.redis_port + ")");
        });
    };

    this.createDir = async function (dirPath) {
        if (!await fs.existsSync(dirPath)) {
            try {
                await fs.mkdirSync(dirPath);
            } catch (e) {
                await this.createDir(path.dirname(dirPath));
                await this.createDir(dirPath);
            }
        }
    };

}

module.exports = RotorServer;
