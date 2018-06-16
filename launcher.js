const RotorServer = require('./index.js');
const RS = new RotorServer(require("./config.json"));
RS.start();

