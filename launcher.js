const RotorServer = require('./index.js');
const RS = new RotorServer();
RS.start({
    ready: function () {
        console.log("rotor server ready")
    },
    config: require("./config.json")
});

