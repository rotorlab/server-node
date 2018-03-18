var RotorServer = require('./index.js');

var server = new RotorServer();
server.initCluster({
    start: function () {
        console.log("rotor server ready")
    },
    config: require("./config.json")
});

