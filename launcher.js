var FlamebaseDatabaseCluster = require('./index.js');

var FSC = new FlamebaseDatabaseCluster("draco");
FSC.initCluster({
    start: function () {
        console.log("start!!")
    }
}, null);

