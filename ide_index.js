const forever =             require('forever-monitor');
const logjs =               require('logjsx');
const fs =                  require('fs');
const path =                require('path');
const logger = new logjs();
logger.init({
  level: "DEBUG"
});

function App(config) {
    let process = "rotor_ide";
    let app_config = {
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

        logFile: __dirname + "/" + config.log_dir + process + "/logFile.log",
        outFile: __dirname + "/" + config.log_dir + process + "/outFile.log",
        errFile: __dirname + "/" + config.log_dir + process + "/errFile.log"
    };


    this.start = async function(port) {
        await this.createDir(config.log_dir + process + "/");
        let app = forever.start(["ng", "serve", "--port", port + ""], app_config);
        app.on('start', function (code) {
            logger.info("Rotor IDE started (" + port + ")");
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

module.exports = App;
