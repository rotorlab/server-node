var FlamebaseDatabaseCluster = require('./index.js');

var FDC = new FlamebaseDatabaseCluster();
FDC.initCluster({
    start: function () {
        console.log("flamebase cluster ready")
    },
    config: require("./config.json")
});

