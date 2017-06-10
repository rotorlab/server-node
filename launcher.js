var FlamebaseDatabaseCluster = require('./index.js');

var FSC = new FlamebaseDatabaseCluster(null);
FSC.initCluster({
    start: function () {
        console.log("start!!")
    }
}, null);

