var express =               require('express');
var bodyParser =            require('body-parser');
var timeout =               require('connect-timeout');
var logjs =                 require('logjsx');
var cluster =               require('cluster');
var Redis =                 require('ioredis');
var numCPUs =               require('os').cpus().length;
var FlamebaseDatabase =     require("./model/FlameDatabase.js");
var Path =                  require("./model/Path.js");
var apply =                 require('rus-diff').apply;
var sha1 =                  require('sha1');
var logger =                new logjs();

JSON.stringifyAligned =     require('json-align');
logger.init({
    level : "DEBUG"
});

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

var expectedDBNEnvVar = "DATABASE_NAME";
var expectedPORTEnvVar = "DATABASE_PORT";
var expectedRPORTEnvVar = "REDIS_PORT";
var expectedDebugKeyEnvVar = "DEBUG";
var dbMaster = null;
var server_port = null;
var redis_port = null;
var debug = null;

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
});

var redis = new Redis(redis_port);

var VARS = {
    USER_AGENT: "user-agent",
    APPLICATION_JSON: "application/json",
    WORKER: "worker",
    RESPONSE_KO: "KO"
};

var ERROR = {
    MISSING_PARAMS: "there vas an error on the connection instance creation: no_params"
};

var ERROR_REQUEST = {
    MISSING_PARAMS: "missing_params",
    MISSING_WRONG_PARAMS: "missing_or_wrong_params"
};

var ERROR_RESPONSE = {
    GET_UPDATES: "_error_getting_updates",
    GET_UPDATES_MSG: "_error_getting_updates",
    UPDATE_DATA: "_error_updating_data",
    UPDATE_DATA_MSG: "_error_updating_data",
    ADD_LISTENER: "_error_creating_listener",
    ADD_LISTENER_MSG: "_error_creating_listener",
    REMOVE_LISTENER: "_error_removing_listener",
    REMOVE_LISTENER_MSG: "_error_removing_listener"
};

var KEY_REQUEST = {
    METHOD: "method",
    PATH:   "path",
    SHA1:   "sha1",
    TOKEN:  "token",
    DIFFERENCES: "differences",
    CONTENT: "content",
    LEN: "len",
    OS: "os",
    CLEAN: "clean",
    UUID: "uuid"
};

var action = {
    response:       function (connection, data, error) {
        let result = {
            status: (data === null || error !== null ? "KO" : "OK"),
            data: (data === null ? {} : data),
            error: error
        };
        connection.callback(connection.token, result);
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
    addListener:    function (connection) {

        /**
         * work with path database
         */
        var paths = new FlamebaseDatabase("paths", "/");
        paths.syncFromDatabase();

        if (paths.ref === undefined) {
            paths.ref = {}
        }

        // valid path
        if (connection.path.indexOf("\.") === -1 && connection.path.indexOf("/") === 0) {
            logger.error(connection.path);
            var key = connection.path.replaceAll("/", "\.");
            key = key.substr(1, key.length - 1);

            if (paths.ref[key] === undefined) {
                paths.ref[key] = {};
                paths.ref[key].path = connection.path;
            }

            if (paths.ref[key].tokens === undefined) {
                paths.ref[key].tokens = {};
            }

            let data = {};
            if (paths.ref[key].tokens[connection.token] === undefined) {
                paths.ref[key].tokens[connection.token] = {};
                paths.ref[key].tokens[connection.token].os = connection.os;
                paths.ref[key].tokens[connection.token].queue = {};
                paths.ref[key].tokens[connection.token].time = new Date().getTime();

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
                if (paths.ref[key].tokens[connection.token].queue === undefined) {
                    paths.ref[key].tokens[connection.token].queue = {};
                    data.queueLen = 0;
                } else {
                    data.queueLen = Object.keys(paths.ref[key].tokens[connection.token].queue).length;
                }
                paths.ref[key].tokens[connection.token].time = new Date().getTime();

                data.info = "queue_ready";
            }

            paths.syncToDatabase();

            /**
             *
             */
            let object = this.getReference(connection);
            object.FD.syncFromDatabase();

            if (typeof object !== "string") {
                data.objectLen = JSON.stringify(object.FD.ref).length;
            } else {
                data.objectLen = 0;
            }

            // TODO send pending queues
            if (data.objectLen > 2) {
                let device = {
                    token: connection.token,
                    os: connection.os
                };
                object.sendUpdateByContent("{}", device, function() {
                    data.info = "queue_ready";
                    action.response(connection, data, null);
                }, connection);
            } else {
                data.info = "new_object";
                data.id = connection.path;
                action.response(connection, data, null);
            }

        } else {
            this.response(connection, null, "path_contains_dots");
        }

    },
    removeListener: function (connection) {
        var paths = new FlamebaseDatabase("paths", "/");
        paths.syncFromDatabase();

        if (connection.path.indexOf("\.") === -1 && connection.path.indexOf("/") === 0) {
            var key = connection.path.replaceAll("/", "\.");
            key = key.substr(1, key.length - 1);

            if (paths.ref[key] !== undefined && paths.ref[key].tokens !== undefined && paths.ref[key].tokens[connection.token] !== undefined) {
                delete paths.ref[key].tokens[connection.token];

                paths.syncToDatabase();

                var data = {};
                data.info = "listener_removed";

                this.response(connection, data, null, connection.worker);
            } else {
                if (paths.ref[key] === undefined) {
                    this.response(connection, null, "path_not_found");
                } else {
                    this.response(connection, null, "token_not_found");
                }
            }
        } else {
            this.response(connection, null, "path_contains_dots");
        }

    },
    /**
     * Updates last time field for the given token
     * @param connection
     */
    updateTime:     function (connection) {
        if (connection.path.indexOf("\.") === -1 && connection.path.indexOf("/") === 0) {
            let key = connection.path.replaceAll("/", "\.");
            key = key.substr(1, key.length - 1);

            var paths = new FlamebaseDatabase("paths", "/");
            paths.syncFromDatabase();

            if (paths.ref === undefined) {
                paths.ref = {};
            }

            if (paths.ref[key] === undefined) {
                paths.ref[key] = {};
            }

            if (paths.ref[key].tokens === undefined) {
                paths.ref[key].tokens = {};
            }

            if (paths.ref[key].tokens === undefined && connection.token !== undefined) {
                paths.ref[key].tokens[connection.token] = {};
            }

            if (paths.ref[key].tokens[connection.token] !== undefined) {
                paths.ref[key].tokens[connection.token].time = new Date().getTime();
            }

            paths.syncToDatabase();
        }
    },

    /**
     * Updates the queue in path database
     * @param connection
     */
    updateQueue:     function (connection) {
        let object = this.getReference(connection);
        if (typeof object === "string") {
            this.response(connection, null, object);
        } else {
            object.addDifferencesToQueue(connection);
            if (connection.differences !== undefined) {
                object.FD.syncFromDatabase();
                apply(object.FD.ref, JSON.parse(connection.differences));
                object.FD.syncToDatabase();

                this.updateTime(connection);

                if (connection[KEY_REQUEST.CLEAN] === true) {
                    let device = {
                        token: connection.token,
                        os: connection.os
                    };

                    logger.debug("sending full object");
                    object.sendUpdateByContent("{}", device, function() {
                        let data = {};
                        data.info = "queue_updated";
                        action.response(connection, data, null);
                    }, connection);
                } else {
                    object.sendQueues(connection, {
                        success:            function() {
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
    getReference:   function (connection) {
        var paths = new FlamebaseDatabase("paths", "/");
        paths.syncFromDatabase();
        let error = null;

        if (connection.path !== undefined) {
            if (connection.path.indexOf("\.") === -1) {
                if (connection.path.indexOf("/") === 0) {
                    let key = connection.path.replaceAll("/", "\.");
                    key = key.substr(1, key.length - 1);
                    if (paths.ref[key] !== undefined) {
                        logger.debug("path found");
                        return new Path(paths, connection, dbMaster, debug);
                    } else {
                        error = "holder_not_found";
                    }
                } else {
                    error = "path_not_starts_with_slash";
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
    printError:     function (msg, stackMessage) {
        logger.error(msg);
        let messages = stackMessage.split("\n");
        for (let i = 0; i < messages.length; i++) {
            logger.error(messages[i]);
        }
        return messages;
    },
    parseRequest:   function (req, res) {

        try {
            let message = req.body;
            let connection = {};     // connection element

            // logger.debug(VARS.USER_AGENT + ": " + req.headers[VARS.USER_AGENT]);
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
                        // logger.debug(KEY_REQUEST.SHA1 + ": " + connection[key]);
                        break;

                    case KEY_REQUEST.TOKEN:
                        connection[key] = message[key];
                        // logger.debug(KEY_REQUEST.TOKEN + ": " + connection[key]);
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
                        // logger.debug(KEY_REQUEST.LEN + ": " + connection[key]);
                        break;

                    case KEY_REQUEST.OS:
                        connection[key] = message[key];
                        // logger.debug(KEY_REQUEST.OS + ": " + connection[key]);
                        break;

                    case KEY_REQUEST.CLEAN:
                        connection[key] = message[key];
                        logger.debug(KEY_REQUEST.CLEAN + ": " + connection[key]);
                        break;

                    case KEY_REQUEST.UUID:
                        connection[key] = message[key];
                        // logger.debug(KEY_REQUEST.CLEAN + ": " + connection[key]);
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

                case "create_listener":
                    try {
                        this.addListener(connection);
                    } catch (e) {
                        this.printError("there was an error parsing request from addGreatListener: " + e.stack);
                        this.response(connection, null, "cluster_" + cluster.worker.id + ERROR_RESPONSE.ADD_LISTENER);
                    }
                    break;


                case "remove_listener":
                    try {
                        this.removeListener(connection);
                    } catch (e) {
                        logger.error("there was an error parsing request from addGreatListener: " + e.toString());
                        this.response(connection, null, "cluster_" + cluster.worker.id + ERROR_RESPONSE.REMOVE_LISTENER);
                    }
                    break;

                case "update_data":
                    try {
                        this.updateQueue(connection);
                    } catch (e) {
                        logger.error("there was an error parsing request from updateQueue: " + e.toString());
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

    let workers = [];

    let spawn = function(i) {
        workers[i] = cluster.fork();
        workers[i].on('exit', function(code, signal) {
            logger.debug('respawning worker ' + i);
            spawn(i);
        });
    };

    for (let i = 0; i < numCPUs; i++) {
        spawn(i);
    }

} else {

    var app = express();

    app.use(bodyParser.urlencoded({
        extended: true
    }));

    app.use(bodyParser.json({limit: '50mb'}));
    app.use(timeout('120s'));

    app.route('/')
        .get(function (req, res) {
            res.send("hi :)");
        })
        .post(function (req, res) {
            action.parseRequest(req, function(token, result) {
                logger.info("worker " + cluster.worker.id + ": socket.io emit() -> " + token);
                logger.info("worker " + cluster.worker.id + ": sending -> " + JSON.stringifyAligned(result));
                redis.publish(token, JSON.stringify(result));
            });
            res.send("{}")
        });

    app.listen(server_port, function () {
        logger.info("server cluster started on port " + server_port + " | worker => " + cluster.worker.id);
    });

}
