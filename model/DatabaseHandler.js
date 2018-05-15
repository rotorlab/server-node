/**
 * Handles all actions related with server database
 * */

// server database
const sha1 =                    require('sha1');

// returns JSON differences
const diff =                    require('rus-diff').diff;

// logs
const logjs =                   require('logjsx');
const logger = new logjs();
logger.init({
    level : "DEBUG"
});

// JSON pretty print
JSON.stringifyAligned = require('json-align');

// possible actions
const ACTION_SIMPLE_UPDATE    = "simple_update";
const ACTION_SLICE_UPDATE     = "slice_update";
const ACTION_NO_UPDATE        = "no_update";

function DatabaseHandler(turbine, database, path) {

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

    // db reference
    this.ref = {};

    this.pushConfig = null;

    /**
     * loads the DB object reference of the given path on object.ref
     */
    this.syncFromDatabase = async function() {
        try {
          logger.debug("database 1: " + database)
          object.ref = await turbine.get(database, path);
        } catch(e) {
            logger.error("error getting from turbine: " + e)
        }
    };

    /**
     * stores object on server database
     */
    this.syncToDatabase = async function() {
        try {
            logger.debug("database 1: " + database)
            await turbine.post(database, path, object.ref);
        } catch(e) {
            logger.error("error sending to turbine: " + e)
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
    this.sendDifferencesForClient = async function(before, device, callback, connection) {

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
                data.sha1 = this.sha1Reference();
                data.index = 0;
                let send = {};
                send.data = data;
                send.tokens = android_tokens;
                send.notification = notification;
                if (ios_tokens.length === 0) {
                    await this.sendPushMessage(send, callback, function (error) {
                        // nothing to do here
                    }, connection);
                } else {
                    await this.sendPushMessage(send, callback, function (error) {
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
                    data.sha1 = this.sha1Reference();
                    data.index = i;
                    data.size = data_android.parts.length;
                    let send = {};
                    send.data = data;
                    send.tokens = android_tokens;
                    send.notification = notification;
                    if (ios_tokens.length === 0 && i === data_android.parts.length - 1) {
                        await this.sendPushMessage(send, callback, function (error) {
                            // nothing to do here
                        }, connection);
                    } else {
                        await this.sendPushMessage(send, callback, function (error) {
                            // nothing to do here
                        }, connection);
                    }
                }
            } else {
                let data = {};
                data.id = id;
                data.tag = this.pushConfig.tag();
                data.sha1 = this.sha1Reference();
                data.action = ACTION_NO_UPDATE;
                let send = {};
                send.data = data;
                send.tokens = android_tokens;
                send.notification = notification;
                if (ios_tokens.length === 0) {
                    await this.sendPushMessage(send, callback, function (error) {
                        // nothing to do here
                    }, connection);
                } else {
                    await this.sendPushMessage(send, callback, function (error) {
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
                data.sha1 = this.sha1Reference();
                data.index = 0;
                let send = {};
                send.data = data;
                send.tokens = ios_tokens;
                send.notification = notification;
                await this.sendPushMessage(send, callback, function (error) {
                    // nothing to do here
                }, connection);
            } else if (data_ios.parts.length > 1) {
                for (let i = 0; i < data_ios.parts.length; i++) {
                    let data = {};
                    data.id = id;
                    data.tag = this.pushConfig.tag();
                    data.reference = data_ios.parts[i];
                    data.action = ACTION_SLICE_UPDATE;
                    data.sha1 = this.sha1Reference();
                    data.index = i;
                    data.size = data_ios.parts.length;
                    let send = {};
                    send.data = data;
                    send.tokens = ios_tokens;
                    send.notification = notification;
                    if (i === data_ios.parts.length - 1) {
                        await this.sendPushMessage(send, callback, function (error) {
                            // nothing to do here
                        }, connection);
                    } else {
                        await this.sendPushMessage(send, callback, function (error) {
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
                await this.sendPushMessage(send, callback, function (error) {
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
    this.sendPushMessage = async function(toSend, success, fail, connection) {
        let message = {
            data: toSend.data,
            error: null
        };
        for (let t in toSend.tokens) {
            let token = toSend.tokens[t];
            try {
                await connection.callback(token, message,
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

    /**
     * Returns object SHA-1
     * @param token
     */
    this.sha1Reference = function () {
        return sha1(JSON.stringify(this.ref))
    };
}

module.exports = DatabaseHandler;
