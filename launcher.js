var FlamebaseDatabaseCluster = require('./index.js');

var serverKey = "...";
var FDC = new FlamebaseDatabaseCluster("myDatabase", 1507, serverKey, true);
FDC.initCluster({
    start: function () {
        console.log("start!!")
    }
});

