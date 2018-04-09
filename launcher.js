const RotorServer = require('./index.js');
const RS = new RotorServer({config: require("./config.json")});
RS.start();

