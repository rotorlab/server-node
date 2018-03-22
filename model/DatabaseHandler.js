/**
 * Handles all actions related with server database.
 * For now we'll still using node-json-db package but
 * it should be replaced with MongoDB
 */

// server database
const JsonDB =                require('node-json-db');

// returns JSON differences
const diff =                  require('rus-diff').diff;

// logs
const logjs =                 require('logjsx');
const logger = new logjs();
logger.init({
    level : "DEBUG"
});

// queue
const SN =                    require('sync-node');

// sha1 converter, it should be removed
const sha1 =                  require('sha1');


const TAG = "Database Handler";

// JSON pretty print
JSON.stringifyAligned = require('json-align');

// possible actions
const ACTION_SIMPLE_UPDATE    = "simple_update";
const ACTION_SLICE_UPDATE     = "slice_update";
const ACTION_NO_UPDATE        = "no_update";

function DatabaseHandler(database, path) {

    // object reference
    var object = this;

    // debug
    this.debugVal = true;

    // os
    this.OS = {};
    this.OS.ANDROID = "android";
    this.OS.IOS = "ios";

    // max length of every message sent to client
    var lengthMargin = 400; // supposed length of additional info to send
    this.lengthLimit = {};
    this.lengthLimit.ANDROID = (4096 - lengthMargin);
    this.lengthLimit.IOS = (2048 - lengthMargin);

    // sync queue
    this.queue = SN.createQueue();

    // database
    this.db = new JsonDB(database, true, true);

    // db reference
    this.ref = {};

    this.pushConfig = null;

    /**
     * loads the DB object reference of the given path on object.ref
     * TODO change to mongoDB
     */
    this.syncFromDatabase = function() {
        try {
            object.db.reload();
            object.ref = object.db.getData(path);
        } catch(e) {
            setTimeout(function() {
                object.prepareUnknownPath();
            }, 200);
        }
    };

    /**
     * when some path doesn't exist on db and needs to create nested objects
     */
    this.prepareUnknownPath = function() {
        let paths = path.split("/");
        let currentObject = object.ref;
        for (let p in paths) {
            let pCheck = paths[p];
            currentObject[pCheck] = {};
            currentObject = currentObject[pCheck];
        }
        object.ref = currentObject;
        object.db.reload();
        object.db.push(path, object.ref);
    };

    /**
     * stores object on server database
     * TODO change to mongoDB
     */
    this.syncToDatabase = function() {
        object.db.reload();
        if (object.ref !== null) {
            object.db.push(path, object.ref)
        } else {
            object.db.delete(path)
        }
    };

    /**
     * configuration for publish on devices:

     {
        config: {
            devices: ["id_deviceA", "id_deviceB"..]
            tag: "/myObjects/objectA_sync"
            referenceId: "/myObjects/objectA"
            notification: null
        }
     }

     * notification field should be removed, was added at the beginning for show a notification
     * when some update was sent to device, but currently is not used
     * @param config
     */
    this.setSyncConfig = function(config) {
        this.pushConfig = config;
    };

    /**
     * enable debug logs
     * @param value
     */
    this.debug = function(value) {
        this.debugVal = value.toLowerCase() === "true";
    };

    /**
     * Passing the initial version (status) of the reference differences are calculated
     * with the current stored reference. This method only sends data to a specific device
     * @param before
     * @param device
     * @param callback
     * @param connection
     */
    this.sendDifferencesForClient = function(before, device, callback, connection) {

        let ios_tokens = [];
        let android_tokens = [];

        let id = this.pushConfig.referenceId();
        let notification = this.pushConfig.notification();

        if (device.os.indexOf(this.OS.IOS) !== -1) {
            ios_tokens.push(device.token);
        } else {
            android_tokens.push(device.token);
        }

        if (android_tokens.length > 0) {
            let data_android = this.getPartsFor(this.OS.ANDROID, JSON.parse(before), this.ref);
            if (object.debugVal) {
                logger.debug("android_tokens_size: " + android_tokens.length);
                logger.debug("data_android_size: " + data_android.parts.length);
            }
            if (data_android.parts.length === 1) {
                let data = {};
                data.id = id;
                data.tag = this.pushConfig.tag();
                data.reference = data_android.parts[0];
                data.action = ACTION_SIMPLE_UPDATE;
                data.size = data_android.parts.length;
                data.index = 0;
                let send = {};
                send.data = data;
                send.tokens = android_tokens;
                send.notification = notification;
                if (ios_tokens.length === 0) {
                    this.sendPushMessage(send, callback, function (error) {
                        // nothing to do here
                    }, connection);
                } else {
                    this.sendPushMessage(send, callback, function (error) {
                        // nothing to do here
                    }, connection);
                }
            } else if (data_android.parts.length > 1) {
                for (let i = 0; i < data_android.parts.length; i++) {
                    let data = {};
                    data.id = id;
                    data.tag = this.pushConfig.tag();
                    data.reference = data_android.parts[i];
                    data.action = ACTION_SLICE_UPDATE;
                    data.index = i;
                    data.size = data_android.parts.length;
                    let send = {};
                    send.data = data;
                    send.tokens = android_tokens;
                    send.notification = notification;
                    if (ios_tokens.length === 0 && i === data_android.parts.length - 1) {
                        this.sendPushMessage(send, callback, function (error) {
                            // nothing to do here
                        }, connection);
                    } else {
                        this.sendPushMessage(send, callback, function (error) {
                            // nothing to do here
                        }, connection);
                    }
                }
            } else {
                let data = {};
                data.id = id;
                data.tag = this.pushConfig.tag();
                data.action = ACTION_NO_UPDATE;
                let send = {};
                send.data = data;
                send.tokens = android_tokens;
                send.notification = notification;
                if (ios_tokens.length === 0) {
                    this.sendPushMessage(send, callback, function (error) {
                        // nothing to do here
                    }, connection);
                } else {
                    this.sendPushMessage(send, callback, function (error) {
                        // nothing to do here
                    }, connection);
                }
            }
        }

        if (ios_tokens.length > 0) {
            let data_ios = this.getPartsFor(this.OS.IOS, JSON.parse(before), this.ref);
            if (object.debugVal) {
                logger.debug("ios_tokens_size: " + ios_tokens.length);
                logger.debug("data_ios_size: " + data_ios.parts.length);
            }
            if (data_ios.parts.length === 1) {
                let data = {};
                data.id = id;
                data.tag = this.pushConfig.tag();
                data.reference = data_ios.parts[0];
                data.action = ACTION_SIMPLE_UPDATE;
                data.size = data_ios.parts.length;
                data.index = 0;
                let send = {};
                send.data = data;
                send.tokens = ios_tokens;
                send.notification = notification;
                this.sendPushMessage(send, callback, function (error) {
                    // nothing to do here
                }, connection);
            } else if (data_ios.parts.length > 1) {
                for (let i = 0; i < data_ios.parts.length; i++) {
                    let data = {};
                    data.id = id;
                    data.tag = this.pushConfig.tag();
                    data.reference = data_ios.parts[i];
                    data.action = ACTION_SLICE_UPDATE;
                    data.index = i;
                    data.size = data_ios.parts.length;
                    let send = {};
                    send.data = data;
                    send.tokens = ios_tokens;
                    send.notification = notification;
                    if (i === data_ios.parts.length - 1) {
                        this.sendPushMessage(send, callback, function (error) {
                            // nothing to do here
                        }, connection);
                    } else {
                        this.sendPushMessage(send, callback, function (error) {
                            // nothing to do here
                        }, connection);
                    }
                }
            } else {
                let data = {};
                data.id = id;
                data.tag = this.pushConfig.tag();
                data.action = ACTION_NO_UPDATE;
                let send = {};
                send.data = data;
                send.tokens = ios_tokens;
                send.notification = notification;
                this.sendPushMessage(send, callback, function (error) {
                    // nothing to do here
                }, connection);
            }
        }
    };

    /**
     * Primitive method to send "chicha" to devices. Connection parameter
     * has a callback object which allows us to publish data on device's channel.
     *
     * Callback will publish on device's channel, and the result is handler with
     * the success and fail functions (objects).
     *
     * If there wasn't any device subscribed to that channel, the message sent to
     * device still being on queue.
     *
     * TODO check if we should use reject() method instead resolve() when action fails
     *
     * @param toSend
     * @param success
     * @param fail
     * @param connection
     */
    this.sendPushMessage = function(toSend, success, fail, connection) {
        this.queue.pushJob(function() {
            return new Promise(function (resolve, reject) {
                let message = {
                    data: toSend.data,
                    error: null
                };
                for (let t in toSend.tokens) {
                    let token = toSend.tokens[t];
                    try {
                        connection.callback(token, message,
                            function () {
                                if (success !== undefined) {
                                    success();
                                }
                            },
                            function () {
                                if (fail !== undefined) {
                                    fail();
                                }
                            });
                    } catch (e) {
                        if (fail !== null && fail !== undefined) {
                            fail(e);
                        }
                    }
                }
                resolve();
            });
        });
    };

    /**
     * Used for slice queues. Queues are a collection of JSON differences.
     * @param os
     * @param content
     * @returns {{}}
     */
    this.getParts = function(os, content) {
        let notification = this.pushConfig.notification();
        let notificationLength = JSON.stringify(notification).length;

        let partsToSend = [];

        let c = content;

        c = this.string2Hex(c);

        let limit = os.indexOf(this.OS.IOS) !== -1 ? this.lengthLimit.IOS - notificationLength : this.lengthLimit.ANDROID - notificationLength;
        if (c.length > limit) {
            let index = -1;
            let pendingChars = c.length;
            while (pendingChars > 0) {
                index++;
                let part = c.slice(index * limit, (pendingChars < limit ? index * limit + pendingChars : (index + 1) * limit));
                pendingChars = pendingChars - part.length;
                partsToSend.push(part);
            }
        } else {
            partsToSend.push(c);
        }

        let result = {};
        result.parts = partsToSend;
        return result;
    };

    /**
     * Used for initial synchronization with reference where before is {}
     * and after is always the current stored object.
     * @param os
     * @param before
     * @param after
     * @returns {{}}
     */
    this.getPartsFor = function(os, before, after) {
        let notification = this.pushConfig.notification();
        let notificationLength = JSON.stringify(notification).length;

        let differences = JSON.stringify(diff(before, after));
        let partsToSend = [];

        if (this.debugVal) {
            logger.debug("diff: " + differences);
        }

        if (differences === "false") {
            let currentStringAfter = JSON.stringify(after);
            let currentStringBefore = JSON.stringify(before);
            if (currentStringBefore.length !== currentStringAfter.length) {
                logger.error("something went wrong; sha1 diff: " + currentStringBefore.length + " - " + currentStringAfter.length);
            }
            if (this.debugVal) {
                logger.debug("no differences");
            }
        } else {
            differences = this.string2Hex(differences);

            let limit = os.indexOf(this.OS.IOS) !== -1 ? this.lengthLimit.IOS - notificationLength : this.lengthLimit.ANDROID - notificationLength;
            if (differences.length > limit) {
                let index = -1;
                let pendingChars = differences.length;
                while (pendingChars > 0) {
                    index++;
                    let part = differences.slice(index * limit, (pendingChars < limit ? index * limit + pendingChars : (index + 1) * limit));
                    pendingChars = pendingChars - part.length;
                    partsToSend.push(part);
                }
            } else {
                partsToSend.push(differences);
            }
        }

        let result = {};
        result.parts = partsToSend;
        return result;
    };

    /**
     * converts some string to hex
     * @param tmp
     * @returns {string}
     */
    this.string2Hex = function (tmp) {
        let str = '';
        for (let i = 0; i < tmp.length; i++) {
            str += tmp[i].charCodeAt(0).toString(16);
        }
        return str;
    };
}

module.exports = DatabaseHandler;