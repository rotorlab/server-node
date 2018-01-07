var FlamebaseDatabaseCluster = require('./index.js');
var config = require("./config.json");

var port = 1507;
var FDC = new FlamebaseDatabaseCluster("myDatabase", port, true);
FDC.initCluster({
    start: function () {
        console.log("started on port " + port)
    }
});

