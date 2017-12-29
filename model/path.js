// var FlamebaseDatabase =     require("flamebase-database-node");
var FlamebaseDatabase =     require("./FlameDatabase.js");
const logjs =                 require('logjsx');

JSON.stringifyAligned = require('json-align');

var logger = new logjs();

logger.init({
    level : "DEBUG"
});

var TAG =                   "PATH CLUSTER";

function Path(APIKey, pathReference, connection, database, pid, dbg) {

    // object reference
    var object = this;

    this.path = connection.path; //
    this.database = database;
    this.pathReference = pathReference;
    this.FD = new FlamebaseDatabase(this.database, this.path);
    this.FD.syncFromDatabase();

    var config = {};

    /**
     * server API key for firebase cloud messaging
     */
    config.APIKey = function() {
        return APIKey;
    };

    /**
     * all device objects must have token and os info in order
     * to slice big JSON changes for android or ios push notifications
     */
    config.devices = function() {
        let path = connection.path.replaceAll("/", "\.");
        path = path.substr(1, path.length - 1);
        var devices = [];
        var keys = Object.keys(object.pathReference.ref[path].tokens);
        for (var i = 0; i < keys.length; i++) {
            var devic = object.pathReference.ref[path].tokens[keys[i]];

            var device = {};
            device.token = keys[i];
            device.os = devic.os;

            devices.push(device);
        }
        return devices;
    };

    /**
     * tag that informs android/ios client which action is being called
     */
    config.tag = function() {
        return object.path + "_sync"; // groupA_sync
    };

    /**
     * custom id for client database (used as primary key)
     */
    config.referenceId = function() {
        return object.path;
    };

    /**
     * custom notification to send when database reference changes.
     * return null if not needed
     */
    config.notification = function() {
        return null;
    };

    this.FD.setSyncConfig(config);
    this.FD.debug(dbg === "true");

    this.sendUpdateFor = function (before, device, callback) {
        this.FD.sendDifferencesForClient(before, device, callback);
    };

    this.addDifferencesToQueue = function (connection) {
        object.pathReference.syncFromDatabase();

        let path = connection.path.replaceAll("/", "\.");
        path = path.substr(1, path.length - 1);

        let keys = Object.keys(object.pathReference.ref[path].tokens);
        let date = new Date().getTime() + "";
        for (let key in keys) {
            object.pathReference.ref[path].tokens[keys[key]].queue[date] = JSON.parse(connection.differences);
        }

        object.pathReference.syncToDatabase()
    }

}

module.exports = Path;