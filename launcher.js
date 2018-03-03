var FlamebaseServer = require('./index.js');

var server = new FlamebaseServer();
server.initCluster({
    start: function () {
        console.log("flamebase server ready")
    },
    config: require("./config.json")
});

