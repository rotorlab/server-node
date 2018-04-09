const express = require('express');
const bodyParser = require('body-parser');
const timeout = require('connect-timeout');
const logjs = require('logjsx');
const cluster = require('cluster');
const Redis = require('ioredis');
const numCPUs = require('os').cpus().length;
const DatabaseHandler = require("./model/DatabaseHandler.js");
const Reference = require("./model/Reference.js");
const apply = require('rus-diff').apply;
const boxen = require('boxen');
const logger = new logjs();

JSON.stringifyAligned = require('json-align');

String.prototype.replaceAll = function (search, replacement) {
    let target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

const expectedDBNEnvVar = "DATABASE_NAME";
const expectedPORTEnvVar = "DATABASE_PORT";
const expectedRPORTEnvVar = "REDIS_PORT";
const expectedTPORTEnvVar = "TURBINE_PORT";
const expectedDebugKeyEnvVar = "DEBUG";
let dbMaster = null;
let server_port = null;
let redis_port = null;
let turbine_port = null;
let debug = null;

process.argv.forEach(function (val, index, array) {
    if (val.indexOf(expectedDBNEnvVar) > -1) {
        dbMaster = val.replaceAll(expectedDBNEnvVar + "=", "");
    }
    if (val.indexOf(expectedPORTEnvVar) > -1) {
        server_port = val.replaceAll(expectedPORTEnvVar + "=", "");
    }
    if (val.indexOf(expectedDebugKeyEnvVar) > -1) {
        debug = val.replaceAll(expectedDebugKeyEnvVar + "=", "") === "true";
    }
    if (val.indexOf(expectedRPORTEnvVar) > -1) {
        redis_port = val.replaceAll(expectedRPORTEnvVar + "=", "");
    }
    if (val.indexOf(expectedTPORTEnvVar) > -1) {
        turbine_port = val.replaceAll(expectedTPORTEnvVar + "=", "");
    }
});

logger.init({
    level: debug ? "DEBUG" :  "INFO"
});

let redis = new Redis(redis_port);

const VARS = {
    USER_AGENT: "user-agent",
    APPLICATION_JSON: "application/json",
    WORKER: "worker",
    RESPONSE_KO: "KO"
};

const ERROR_REQUEST = {
    MISSING_PARAMS: "missing_params",
    MISSING_WRONG_PARAMS: "missing_or_wrong_params"
};

const ERROR_RESPONSE = {
    GET_UPDATES: "_error_getting_updates",
    GET_UPDATES_MSG: "_error_getting_updates",
    UPDATE_DATA: "_error_updating_data",
    UPDATE_DATA_MSG: "_error_updating_data",
    ADD_LISTENER: "_error_creating_listener",
    ADD_LISTENER_MSG: "_error_creating_listener",
    REMOVE_LISTENER: "_error_removing_listener",
    REMOVE_LISTENER_MSG: "_error_removing_listener"
};

const KEY_REQUEST = {
    METHOD: "method",
    PATH: "path",
    SHA1: "sha1",
    TOKEN: "token",
    DIFFERENCES: "differences",
    CONTENT: "content",
    LEN: "len",
    OS: "os",
    CLEAN: "clean",
    UUID: "uuid",
    NOTIFICATION_ID: "notificationId",
    RECEIVERS: "receivers"
};

let action = {
    response: function (connection, data, error) {
        let result = {
            status: (data === null || error !== null ? "KO" : "OK"),
            data: (data === null ? {} : data),
            error: error
        };
        connection.callback(connection.token, result).then(function () {

        });
    },
    responseTo: function (connection, data, error, token) {
        let result = {
            status: (data === null || error !== null ? "KO" : "OK"),
            data: (data === null ? {} : data),
            error: error
        };
        connection.callback(token, result).then(function () {

        });
    },
    notify: function (connection, id, notifications, error) {
        let result = {
            status: (notifications === null || error !== null ? "KO" : "OK"),
            notifications: (notifications === null ? {} : notifications),
            error: error
        };
        connection.callback(id, result).then(function () {

        });
    },
    /**
     * replaces path format: /contacts/batman -> contacts.batman
     * creates a token reference for the given path:
     "contacts.batman": {
                "path": "/contacts/batman",
                "tokens": {
                    "6FBAEC3CD175FD1F4F86E59A5F2DEFF1D1ACD350": {
                        "queue": {},
                        "os": "android",
                        "time": 1506663439626
                    }
                }
            }
     * @param connection
     */
    listen: async function (connection) {
        let paths = action.getPath(connection);
        /**
         * work with path database
         */
        await paths.syncFromDatabase();

        if (paths.ref === undefined || paths.ref === null) {
            paths.ref = {}
        }

        // valid path
        if (connection.path.indexOf("\.") === -1 && connection.path.indexOf("/") === 0) {
            logger.debug("ref: " + paths.ref);

            if (paths.ref.path === undefined) {
                paths.ref.path = connection.path;
            }

            if (paths.ref.tokens === undefined) {
                paths.ref.tokens = {};
            }

            let data = {};
            if (paths.ref.tokens[connection.token] === undefined) {
                paths.ref.tokens[connection.token] = {};
                paths.ref.tokens[connection.token].os = connection.os;
                paths.ref.tokens[connection.token].queue = {};
                paths.ref.tokens[connection.token].time = new Date().getTime();

                /**
                 * queue is ready, all changes in the current path will be queue here
                 * and will be removed when device receive it.
                 * respond queue ready
                 */
                data.queueLen = 0;
                data.info = "queue_ready";
            } else {
                /**
                 * respond queue ready
                 *
                 */
                if (paths.ref.tokens[connection.token].queue === undefined) {
                    paths.ref.tokens[connection.token].queue = {};
                    data.queueLen = 0;
                } else {
                    data.queueLen = Object.keys(paths.ref.tokens[connection.token].queue).length;
                }
                paths.ref.tokens[connection.token].time = new Date().getTime();

                data.info = "queue_ready";
            }

            await paths.syncToDatabase();
            /**
             *
             */
            let object = await this.getReference(connection);
            if (typeof object === "string") {
                this.response(connection, null, object);
            } else {
                await object.DH.syncFromDatabase();

                if (typeof object !== "string") {
                    data.objectLen = JSON.stringify(object.DH.ref).length;
                } else {
                    data.objectLen = 0;
                }

                // TODO send pending queues
                if (data.objectLen > 2) {
                    let device = {
                        token: connection.token,
                        os: connection.os
                    };
                    logger.debug("sha: " + connection.sha1);
                    logger.debug("sha cached: " + object.sha1Reference());

                    if (connection.sha1 === object.sha1Reference()) {
                        let k = Object.keys(paths.ref.tokens[connection.token].queue);
                        for (let key in k) {
                            delete paths.ref.tokens[connection.token].queue[k[key]]
                        }
                        await paths.syncToDatabase();
                        data.info = "queue_ready";
                        action.response(connection, data, null);
                    } else {
                        let keys = Object.keys(paths.ref.tokens[connection.token].queue);
                        if (keys.length > 0) {
                            object.sendQueues(connection, {
                                success: function () {
                                    let data = {};
                                    data.info = "queue_sent";
                                    action.response(connection, data, null);
                                }
                            });
                        } else {
                            await object.sendUpdateByContent("{}", device, function () {
                                let data = {};
                                data.info = "queue_ready";
                                action.response(connection, data, null);
                            }, connection);
                        }
                    }
                } else {
                    data.info = "new_object";
                    data.id = connection.path;
                    action.response(connection, data, null);
                }
            }
        } else if (connection.path.indexOf("/") !== 0) {
            this.response(connection, null, "path_not_start_with_slash");
        } else {
            this.response(connection, null, "path_contains_dots");
        }
    },
    unlisten: async function (connection) {
        let paths = action.getPath(connection);
        await paths.syncFromDatabase();

        if (connection.path.indexOf("\.") === -1 && connection.path.indexOf("/") === 0) {
            if (paths.ref !== undefined && paths.ref.tokens !== undefined && paths.ref.tokens[connection.token] !== undefined) {
                delete paths.ref.tokens[connection.token];
                await paths.syncToDatabase();

                let data = {};
                data.info = "listener_removed";
                this.response(connection, data, null, connection.worker);
            } else {
                if (paths.ref === undefined) {
                    this.response(connection, null, "path_not_found");
                } else {
                    this.response(connection, null, "token_not_found");
                }
            }
        } else if (connection.path.indexOf("/") !== 0) {
            this.response(connection, null, "path_not_start_with_slash");
        } else {
            this.response(connection, null, "path_contains_dots");
        }

    },
    /**
     * Updates last time field for the given token
     * @param connection
     */
    updateTime: async function (connection) {
        if (connection.path.indexOf("\.") === -1 && connection.path.indexOf("/") === 0) {
            let paths = action.getPath(connection);

            await paths.syncFromDatabase();

            if (paths.ref === undefined) {
                paths.ref = {};
            }

            if (paths.ref === undefined) {
                paths.ref = {};
            }

            if (paths.ref.tokens === undefined) {
                paths.ref.tokens = {};
            }

            if (paths.ref.tokens === undefined && connection.token !== undefined) {
                paths.ref.tokens[connection.token] = {};
            }

            if (paths.ref.tokens[connection.token] !== undefined) {
                paths.ref.tokens[connection.token].time = new Date().getTime();
            }

            await paths.syncToDatabase();
        }
    },

    /**
     * Updates the queue in path database
     * @param connection
     */
    updateQueue: async function (connection) {
        let object = await this.getReference(connection);
        if (typeof object === "string") {
            this.response(connection, null, object);
        } else {
            await object.addDifferencesToQueue(connection);
            if (connection.differences !== undefined) {

                await object.DH.syncFromDatabase();
                apply(object.DH.ref, JSON.parse(connection.differences));
                await object.DH.syncToDatabase();

                await this.updateTime(connection);

                if (connection[KEY_REQUEST.CLEAN] === true) {
                    let device = {
                        token: connection.token,
                        os: connection.os
                    };

                    logger.debug("sending full object");
                    await object.sendUpdateByContent("{}", device, function () {
                        let data = {};
                        data.info = "queue_updated";
                        action.response(connection, data, null);
                    }, connection);
                } else {
                    await object.sendQueues(connection, {
                        success: function () {
                            let data = {};
                            data.info = "queue_updated";
                            action.response(connection, data, null);
                        }
                    });
                }
            } else {
                this.response(connection, "no_diff_updated", null);
            }
        }
    },

    /**
     * Removes reference in database
     * @param connection
     */
    remove: async function (connection) {
        let object = await this.getReference(connection);
        if (typeof object === "string") {
            this.response(connection, null, object);
        } else {
            await object.pathReference.syncFromDatabase();
            let dvs = Object.keys(object.pathReference.ref.tokens);
            object.DH.ref = null;
            await object.DH.syncToDatabase();
            for (let d in dvs) {
                let data = {};
                data.info = "reference_removed";
                data.id = connection.path;
                action.responseTo(connection, data, null, dvs[d]);
            }
        }
    },
    /**
     * Updates from old content
     * @param connection
     */
    updateFrom: async function (connection) {
        let object = await this.getReference(connection);
        if (typeof object === "string") {
            this.response(connection, null, object);
        } else {
            let device = {
                token: connection.token,
                os: connection.os
            };
            await object.DH.syncFromDatabase();
            await object.sendUpdateByContent(connection.content, device, function () {
                let data = {};
                data.info = "queue_ready";
                action.response(connection, data, null);
            }, connection);

        }
    },
    sendNotifications: function (connection) {
        let receivers = connection[KEY_REQUEST.RECEIVERS];
        let notifications = {};
        notifications.id = connection[KEY_REQUEST.NOTIFICATION_ID];
        notifications.method = "add";
        for (let i = 0; i < receivers.length; i++) {
            logger.debug("notification ID: " + connection[KEY_REQUEST.NOTIFICATION_ID]);
            action.notify(connection, receivers[i].id, notifications, null)
        }
    },
    getReference: async function (connection) {
        let paths = action.getPath(connection);
        await paths.syncFromDatabase();
        let error = null;

        if (connection.path !== undefined) {
            if (connection.path.indexOf("\.") === -1) {
                if (connection.path.indexOf("/") === 0) {
                    if (paths.ref !== undefined) {
                        return new Reference(paths, connection, dbMaster, debug.toString(), turbine_port.toString());
                    } else {
                        error = "holder_not_found_on" + key;
                    }
                } else {
                    error = "path_not_start_with_slash";
                }
            } else {
                error = "path_contains_dots";
            }
        } else {
            error = "json_path_not_found";
        }
        logger.error(error);
        return error;
    },
    getPath: function (connection) {
        if (connection.path !== undefined) {
            let k = connection.path.replaceAll("/", "\.");
            if (k.startsWith(".")) {
                k = k.substring(1, k.length)
            }
            k = "/paths/" + k;
            return new DatabaseHandler("paths", k, turbine_port.toString());
        } else {
            return null
        }
    },
    printError: function (msg, stackMessage) {
        logger.error(msg);
        let messages = stackMessage.split("\n");
        for (let i = 0; i < messages.length; i++) {
            logger.error(messages[i]);
        }
        return messages;
    },
    parseRequest: async function (req, res) {

        try {
            let message = req.body;
            let connection = {};     // connection element

            logger.debug(VARS.USER_AGENT + ": " + req.headers[VARS.USER_AGENT]);
            logger.debug(VARS.WORKER + ": " + cluster.worker.id);

            let keys = Object.keys(message); // keys
            for (let i = 0; i < keys.length; i++) {
                let key = keys[i];
                switch (key) {
                    case KEY_REQUEST.METHOD:
                        connection[key] = message[key];
                        logger.debug(KEY_REQUEST.METHOD + ": " + connection[key]);
                        break;

                    case KEY_REQUEST.PATH:
                        connection[key] = message[key];
                        logger.debug(KEY_REQUEST.PATH + ": " + connection[key]);
                        break;

                    case KEY_REQUEST.SHA1:
                        connection[key] = message[key];
                        logger.debug(KEY_REQUEST.SHA1 + ": " + connection[key]);
                        break;

                    case KEY_REQUEST.TOKEN:
                        connection[key] = message[key];
                        logger.debug(KEY_REQUEST.TOKEN + ": " + connection[key]);
                        break;

                    case KEY_REQUEST.DIFFERENCES:
                        connection[key] = message[key];
                        logger.debug(KEY_REQUEST.DIFFERENCES + ": " + connection[key]);
                        break;

                    case KEY_REQUEST.CONTENT:
                        connection[key] = message[key];
                        logger.debug(KEY_REQUEST.CONTENT + ": " + connection[key]);
                        break;

                    case KEY_REQUEST.LEN:
                        connection[key] = message[key];
                        logger.debug(KEY_REQUEST.LEN + ": " + connection[key]);
                        break;

                    case KEY_REQUEST.OS:
                        connection[key] = message[key];
                        logger.debug(KEY_REQUEST.OS + ": " + connection[key]);
                        break;

                    case KEY_REQUEST.CLEAN:
                        connection[key] = message[key];
                        logger.debug(KEY_REQUEST.CLEAN + ": " + connection[key]);
                        break;

                    case KEY_REQUEST.UUID:
                        connection[key] = message[key];
                        logger.debug(KEY_REQUEST.CLEAN + ": " + connection[key]);
                        break;

                    case KEY_REQUEST.NOTIFICATION_ID:
                        connection[key] = message[key];
                        logger.debug(key + ": " + connection[key]);
                        break;

                    case KEY_REQUEST.RECEIVERS:
                        connection[key] = message[key];
                        logger.debug(key + ": " + connection[key]);
                        break;

                    default:

                        //
                        break;
                }
            }

            // super important values
            connection.id = new Date().getTime();
            connection.worker = cluster.worker.id;
            connection.request = req;
            connection.callback = res;

            switch (connection.method) {

                case "listen_reference":
                    try {
                        await this.listen(connection);
                    } catch (e) {
                        logger.error("there was an error parsing request from listen: " + e.stack);
                        this.response(connection, null, "cluster_" + cluster.worker.id + ERROR_RESPONSE.ADD_LISTENER);
                    }
                    break;


                case "unlisten_reference":
                    try {
                        await this.unlisten(connection);
                    } catch (e) {
                        logger.error("there was an error parsing request from unlisten: " + e.toString());
                        this.response(connection, null, "cluster_" + cluster.worker.id + ERROR_RESPONSE.REMOVE_LISTENER);
                    }
                    break;

                case "update_reference":
                    try {
                        await this.updateQueue(connection);
                    } catch (e) {
                        logger.error("there was an error parsing request from updateQueue: " + e.toString());
                        this.response(connection, null, "cluster_" + cluster.worker.id + ERROR_RESPONSE.UPDATE_DATA);
                    }
                    break;

                case "remove_reference":
                    try {
                        await this.remove(connection);
                    } catch (e) {
                        logger.error("there was an error parsing request from remove: " + e.toString());
                        this.response(connection, null, "cluster_" + cluster.worker.id + ERROR_RESPONSE.UPDATE_DATA);
                    }
                    break;

                case "update_reference_from":
                    try {
                        await this.updateFrom(connection);
                    } catch (e) {
                        logger.error("there was an error parsing request from updateFrom: " + e.toString());
                        this.response(connection, null, "cluster_" + cluster.worker.id + ERROR_RESPONSE.UPDATE_DATA);
                    }
                    break;

                case "send_notifications":
                    try {
                        this.sendNotifications(connection);
                    } catch (e) {
                        logger.error("there was an error parsing request from send_notifications: " + e.toString());
                        this.response(connection, null, "cluster_" + cluster.worker.id + ERROR_RESPONSE.UPDATE_DATA);
                    }
                    break;

                default:
                    //
                    break;

            }

        } catch (e) {
            logger.error("there was an error parsing request: " + e.toString());

            let result = {status: VARS.RESPONSE_KO, data: null, error: ERROR_REQUEST.MISSING_WRONG_PARAMS};
            res(req.token, result);
        }
    }
};

if (cluster.isMaster) {

    console.log(boxen('rotor', {padding: 2, borderColor: "white",borderStyle: 'round'}));

    let workers = [];

    let spawn = function (i) {
        workers[i] = cluster.fork();
        workers[i].on('exit', function (code, signal) {
            logger.debug('respawning worker ' + i);
            spawn(i);
        });
    };

    for (let i = 0; i < numCPUs; i++) {
        spawn(i);
    }

} else {
    let app = express();
    app.use(bodyParser.urlencoded({extended: true}));
    app.use(bodyParser.json({limit: '50mb'}));
    app.use(timeout('120s'));
    app.route('/')
        .get(function (req, res) {
            res.send("hi :)");
        })
        .post(async function (req, res) {
            await action.parseRequest(req, async function (token, result, success, fail) {
                logger.debug("worker " + cluster.worker.id + ": socket.io emit() -> " + token);
                logger.debug("worker " + cluster.worker.id + ": sending -> " + JSON.stringifyAligned(result));
                let r = await redis.publish(token, JSON.stringify(result));
                logger.debug("result: " + r);
                if (r > 0) {
                    logger.debug("SUCCESS publish result");
                    if (success !== undefined) {
                        success();
                    }
                } else {
                    logger.debug("FAILED publish result");
                    if (fail !== undefined) {
                        fail();
                    }
                }
            });
            res.send("{}")
        });
    app.listen(server_port, function () {
        logger.debug("rotor cluster started on port " + server_port + " | worker => " + cluster.worker.id);
    });
}
