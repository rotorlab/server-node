var FlamebaseServer = require('./index.js');

var FDC = new FlamebaseServer();
FDC.initCluster({
    start: function () {
        console.log("flamebase server ready")
    },
    config: require("./config.json")
});

