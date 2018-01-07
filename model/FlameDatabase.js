
var JsonDB =                require('node-json-db');
var diff =                  require('rus-diff').diff;
const logjs =                 require('logjsx');
var logger = new logjs();

logger.init({
    level : "DEBUG"
});

var SN =                    require('sync-node');
var sha1 =                  require('sha1');


const TAG = "Flamebase Database";

JSON.stringifyAligned = require('json-align');

var ACTION_SIMPLE_UPDATE    = "simple_update";
var ACTION_SLICE_UPDATE     = "slice_update";
var ACTION_NO_UPDATE        = "no_update";

function FlamebaseDatabase(database, path) {

    // object reference
    var object = this;

    // debug
    this.debugVal = true;

    // os
    this.OS = {};
    this.OS.ANDROID = "android";
    this.OS.IOS = "ios";

    var lengthMargin = 400; // supposed length of additional info to send
    this.lengthLimit = {};
    this.lengthLimit.ANDROID = (4096 - lengthMargin);
    this.lengthLimit.IOS = (2048 - lengthMargin);
    this.queue = SN.createQueue();


    // database
    this.db = new JsonDB(database, true, true);

    // db reference
    this.ref = {};

    // last db string reference
    this.lastStringReference = JSON.stringify({});
    this.pushConfig = null;

    /**
     * sync from database
     */
    this.syncFromDatabase = function() {
        try {
            object.ref = new JsonDB(database, true, true).getData(path);
            this.lastStringReference = JSON.stringify(object.ref);
        } catch(e) {
            this.prepareUnknownPath();
            this.lastStringReference = JSON.stringify(object.ref);
        }
    };

    this.prepareUnknownPath = function() {
        let paths = path.split("/");
        let currentObject = object.ref;
        for (let p in paths) {
            let pCheck = paths[p];
            currentObject[pCheck] = {};
            currentObject = currentObject[pCheck];
        }
        object.ref = currentObject;
        new JsonDB(database, true, true).push(path, object.ref);
    };

    /**
     * sync to database
     */
    this.syncToDatabase = function(restart, callback) {
        if (restart !== undefined && restart) {
            this.lastStringReference = JSON.stringify({});
            if (this.debugVal) {
                logger.debug("cleaning last reference on " + path);
            }
        }
        new JsonDB(database, true, true).push(path, object.ref);
        // object.syncNotifications(callback);
    };

    /**
     * config for real time synchronization
     * @param config
     */
    this.setSyncConfig = function(config) {
        this.pushConfig = config;
        this.lastStringReference = JSON.stringify({});
    };

    /**
     * debug logs
     * @param callback
     */
    this.debug = function(value) {
        this.debugVal = value;
    };


    /**
     *
     */
    this.sendDifferencesForClient = function(before, device, callback, connection) {

        var ios_tokens = [];
        var android_tokens = [];

        var id = this.pushConfig.referenceId();
        var notification = this.pushConfig.notification();

        if (device.os.indexOf(this.OS.IOS) !== -1) {
            ios_tokens.push(device.token);
        } else {
            android_tokens.push(device.token);
        }

        if (android_tokens.length > 0) {
            var data_android = this.getPartsFor(this.OS.ANDROID, JSON.parse(before), this.ref);
            if (object.debugVal) {
                logger.debug("android_tokens_size: " + android_tokens.length);
                logger.debug("data_android_size: " + data_android.parts.length);
            }
            if (data_android.parts.length === 1) {
                var data = {};
                data.id = id;
                data.tag = this.pushConfig.tag();
                data.reference = data_android.parts[0];
                data.action = ACTION_SIMPLE_UPDATE;
                data.size = data_android.parts.length;
                data.index = 0;
                var send = {};
                send.data = data;
                send.tokens = android_tokens;
                send.notification = notification;
                if (ios_tokens.length === 0) {
                    this.sendPushMessage(send, callback, null, connection);
                } else {
                    this.sendPushMessage(send, callback, null, connection);
                }
            } else if (data_android.parts.length > 1) {
                for (var i = 0; i < data_android.parts.length; i++) {
                    var dat = {};
                    dat.id = id;
                    dat.tag = this.pushConfig.tag();
                    dat.reference = data_android.parts[i];
                    dat.action = ACTION_SLICE_UPDATE;
                    dat.index = i;
                    dat.size = data_android.parts.length;
                    var sen = {};
                    sen.data = dat;
                    sen.tokens = android_tokens;
                    sen.notification = notification;
                    if (ios_tokens.length === 0 && i === data_android.parts.length - 1) {
                        this.sendPushMessage(sen, callback, null, connection);
                    } else {
                        this.sendPushMessage(sen, callback, null, connection);
                    }
                }
            } else {
                var data = {};
                data.id = id;
                data.tag = this.pushConfig.tag();
                data.action = ACTION_NO_UPDATE;
                var send = {};
                send.data = data;
                send.tokens = android_tokens;
                send.notification = notification;
                if (ios_tokens.length === 0) {
                    this.sendPushMessage(send, callback, null, connection);
                } else {
                    this.sendPushMessage(send, callback, null, connection);
                }
            }
        }

        if (ios_tokens.length > 0) {
            var data_ios = this.getPartsFor(this.OS.IOS, JSON.parse(before), this.ref);
            if (object.debugVal) {
                logger.debug("ios_tokens_size: " + ios_tokens.length);
                logger.debug("data_ios_size: " + data_ios.parts.length);
            }
            if (data_ios.parts.length === 1) {
                var da = {};
                da.id = id;
                da.tag = this.pushConfig.tag();
                da.reference = data_ios.parts[0];
                da.action = ACTION_SIMPLE_UPDATE;
                da.size = data_ios.parts.length;
                da.index = 0;
                var se = {};
                se.data = da;
                se.tokens = ios_tokens;
                se.notification = notification;
                this.sendPushMessage(se, callback, null, connection);
            } else if (data_ios.parts.length > 1) {
                for (var i = 0; i < data_ios.parts.length; i++) {
                    var d = {};
                    d.id = id;
                    d.tag = this.pushConfig.tag();
                    d.reference = data_ios.parts[i];
                    d.action = ACTION_SLICE_UPDATE;
                    d.index = i;
                    d.size = data_ios.parts.length;
                    var s = {};
                    s.data = d;
                    s.tokens = ios_tokens;
                    s.notification = notification;
                    if (i === data_ios.parts.length - 1) {
                        this.sendPushMessage(s, callback, null, connection);
                    } else {
                        this.sendPushMessage(s, callback, null, connection);
                    }
                }
            } else {
                var data = {};
                data.id = id;
                data.tag = this.pushConfig.tag();
                data.action = ACTION_NO_UPDATE;
                var send = {};
                send.data = data;
                send.tokens = ios_tokens;
                send.notification = notification;
                this.sendPushMessage(send, callback, null, connection);
            }
        }

        this.lastStringReference = JSON.stringify(this.ref);
    };

    this.sendPushMessage = function(send, success, fail, connection) {
        this.queue.pushJob(function() {
            return new Promise(function (resolve, reject) {
                var message = {
                    data: send.data,
                    error: null
                };

                for (let t in send.tokens) {
                    let token = send.tokens[t];
                    try {
                        logger.error("will send messages")
                        connection.callback(token, message);
                        logger.error("sent messages")
                        if (success !== undefined) {
                            success();
                        }
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

    this.getPartsFor = function(os, before, after) {
        var notification = this.pushConfig.notification();
        var notificationLength = JSON.stringify(notification).length;

        //var differences = JSON.stringify(diff(JSON.parse(this.lastStringReference), this.ref));
        var differences = JSON.stringify(diff(before, after));
        var partsToSend = [];

        if (this.debugVal) {
            logger.debug("diff: " + differences);
        }

        if (differences === "false") {
            var currentStringAfter = JSON.stringify(after);
            var currentStringBefore = JSON.stringify(before);
            if (currentStringBefore.length !== currentStringAfter.length) {
                logger.error("something went wrong; sha1 diff: " + currentStringBefore.length + " - " + currentStringAfter.length);
            }
            if (this.debugVal) {
                logger.debug("no differences");
            }
        } else {
            differences = this.string2Hex(differences);

            var limit = os.indexOf(this.OS.IOS) !== -1 ? this.lengthLimit.IOS - notificationLength : this.lengthLimit.ANDROID - notificationLength;
            if (differences.length > limit) {
                var index = -1;
                var pendingChars = differences.length;
                while (pendingChars > 0) {
                    index++;
                    var part = differences.slice(index * limit, (pendingChars < limit ? index * limit + pendingChars : (index + 1) * limit));
                    pendingChars = pendingChars - part.length;
                    partsToSend.push(part);
                }
            } else {
                partsToSend.push(differences);
            }
        }

        var result = {};
        result.parts = partsToSend;
        return result;
    };

    this.exist = function() {
        return !(this.ref === null || this.ref === undefined)
    };

    this.string2Hex = function (tmp) {
        var str = '';
        for (var i = 0; i < tmp.length; i++) {
            str += tmp[i].charCodeAt(0).toString(16);
        }
        return str;
    };
}

module.exports = FlamebaseDatabase;