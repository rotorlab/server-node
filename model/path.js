// var FlamebaseDatabase =     require("flamebase-database-node");
var FlamebaseDatabase =     require("./FlameDatabase.js");
const logjs =                 require('logjsx');

JSON.stringifyAligned = require('json-align');

var logger = new logjs();

logger.init({
    level : "DEBUG"
});

let TAG =                   "PATH CLUSTER";
let ACTION_SIMPLE_UPDATE    = "simple_update";
let ACTION_SLICE_UPDATE     = "slice_update";
let ACTION_NO_UPDATE        = "no_update";
let NOT_REGISTERED        = "NotRegistered";

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
        this.pathReference.syncFromDatabase();

        let path = connection.path.replaceAll("/", "\.");
        path = path.substr(1, path.length - 1);

        let keys = Object.keys(this.pathReference.ref[path].tokens);
        let date = new Date().getTime() + "";
        for (let key in keys) {
            this.pathReference.ref[path].tokens[keys[key]].queue[date] = JSON.parse(connection.differences);
        }

        this.pathReference.syncToDatabase()
    };

    this.sync = function(connection, callback) {
        if (this.fcm === null) {
            logger.error("# no fcm detected, set an API key");
            return;
        }

        let path = connection.path.replaceAll("/", "\.");
        path = path.substr(1, path.length - 1);

        if (this.debugVal) {
            logger.debug("synchronizing with devices for path: " + path);
        }
        this.pathReference.syncFromDatabase();

        if (this.pathReference.ref[path].tokens !== undefined) {
            let referenceId = config.referenceId();
            let notification = config.notification();

            let tokens = Object.keys(this.pathReference.ref[path].tokens);

            for (let i in tokens) {
                let tok = tokens[i];
                let token = this.pathReference.ref[path].tokens[tok];
                let os = token.os;
                let queue = token.queue;

                let changes = Object.keys(queue);

                for (let t in changes) {
                    let id = changes[t];

                    let dataToSend = this.FD.getParts(os, JSON.stringify(queue[id]));

                    /**
                     * single part, ACTION_SIMPLE_UPDATE
                     */
                    if (dataToSend.parts.length === 1) {
                        let data = {};
                        data.id = referenceId;
                        data.tag = config.tag();
                        data.reference = dataToSend.parts[0];
                        data.action = ACTION_SIMPLE_UPDATE;
                        data.size = dataToSend.parts.length;
                        data.index = 0;
                        let send = {};
                        send.data = data;
                        send.tokens = [tok];
                        send.notification = notification;
                        this.FD.sendPushMessage(send,
                            /**
                             * success
                             */
                            function () {
                                logger.info("success event");
                                object.removeQueue(path, tok, id);
                            },
                            /**
                             * fail
                             * @param error
                             */
                            function (error) {
                                logger.error(error);
                                switch (error) {

                                    case NOT_REGISTERED:
                                        object.removeToken(tok);
                                        break;

                                    default:
                                        // nothing to do here
                                        break;
                                }
                            });
                    } else if (dataToSend.parts.length > 1) {
                        /**
                         * few parts, ACTION_SLICE_UPDATE
                         */
                        for (let i = 0; i < dataToSend.parts.length; i++) {
                            let data = {};
                            data.id = referenceId;
                            data.tag = config.tag();
                            data.reference = dataToSend.parts[i];
                            data.action = ACTION_SLICE_UPDATE;
                            data.index = i;
                            data.size = dataToSend.parts.length;
                            let send = {};
                            send.data = data;
                            send.tokens = [tok];
                            send.notification = notification;
                            this.FD.sendPushMessage(send,
                                /**
                                 * success
                                 */
                                function () {
                                    object.removeQueue(path, tok, id);
                                },
                                /**
                                 * fail
                                 * @param error
                                 */
                                function (error) {
                                    logger.error(error);
                                    switch (error) {

                                        case NOT_REGISTERED:
                                            object.removeToken(tok);
                                            break;

                                        default:
                                            // nothing to do here
                                            break;
                                    }
                                });
                        }
                    } else {
                        /**
                         * no parts, ACTION_NO_UPDATE
                         */
                        let data = {};
                        data.id = referenceId;
                        data.tag = config.tag();
                        data.action = ACTION_NO_UPDATE;
                        let send = {};
                        send.data = data;
                        send.tokens = [tok];
                        send.notification = notification;
                        this.FD.sendPushMessage(send,
                            /**
                             * success
                             */
                            function () {
                                object.removeQueue(path, tok, id);
                            },
                            /**
                             * fail
                             * @param error
                             */
                            function (error) {
                                logger.error(error);
                                switch (error) {

                                    case NOT_REGISTERED:
                                        object.removeToken(tok);
                                        break;

                                    default:
                                        // nothing to do here
                                        break;
                                }
                            });
                    }


                    // TODO send push message and wait for confirmation to remove
                }
            }

            this.pathReference.syncToDatabase();
            callback();
        } else {
            logger.error("no tokens found for path: " + path);
        }

    };

    this.removeToken = function (token) {
        this.pathReference.syncFromDatabase();

        let paths = Object.keys(this.pathReference.ref);
        for (let i in paths) {
            let tokens = Object.keys(this.pathReference.ref[paths[i]].tokens);
            for (let p in tokens) {
                if (tokens[p] === token) {
                    delete this.pathReference.ref[paths[i]].tokens[tokens[p]];
                }
            }
        }

        this.pathReference.syncToDatabase()
    };

    this.removeQueue = function (path, token, id) {
        this.pathReference.syncFromDatabase();

        delete this.pathReference.ref[path].tokens[token].queue[id];

        this.pathReference.syncToDatabase()
    };


}

module.exports = Path;