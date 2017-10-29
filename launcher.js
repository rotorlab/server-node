var FlamebaseDatabaseCluster = require('./index.js');
var config = require("./config.json");

var FDC = new FlamebaseDatabaseCluster("myDatabase", 1507, config.serverKey, true);
FDC.initCluster({
    start: function () {
        console.log("start!!")
    }
});

