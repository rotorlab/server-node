var express =               require('express');
var logjs =                 require('logjsx');
var cluster =               require('cluster');
var net =                   require('net');
var sio =                   require('socket.io');
var sio_redis =             require('socket.io-redis');
var farmhash =              require('farmhash');
var numCPUs =               require('os').cpus().length;
var FlamebaseDatabase =     require("./model/FlameDatabase.js");
var Path =                  require("./model/Path.js");
var port =                  1507;
var apply =                 require('rus-diff').apply;
var sha1 =                  require('sha1');
var logger =                new logjs();
var paths =                 new FlamebaseDatabase("paths", "/");



JSON.stringifyAligned =     require('json-align');
logger.init({
    level : "DEBUG"
});

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

var dbMaster = "myDatabase";
var debug = "true";
var ROOM =                  "/databases/";
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
     * @param pId
     */
    addListener:    function (connection) {

        /**
         * work with path database
         */
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

            logger.info(JSON.stringifyAligned(object.FD.ref));

            if (data.objectLen > 2) {
                let device = {
                    token: connection.token,
                    os: connection.os
                };
                object.sendUpdateFor("{}", device, function() {
                    logger.info("sending full object");
                    data.info = "queue_ready";
                    action.response(connection, data, null);
                }, connection);
            } else {
                object.sync(connection, {
                    success:            function() {
                        action.response(connection, data, null);
                    }
                });
            }

        } else {
            this.response(connection, null, "path_contains_dots");
        }

    },
    removeListener: function (connection) {
        paths.syncFromDatabase();

        if (connection.path.indexOf("\.") === -1 && connection.path.indexOf("/") === 0) {
            var key = connection.path.replaceAll("/", "\.");
            key = key.substr(1, key.length - 1);

            if (paths.ref[key] !== undefined && paths.ref[key].tokens !== undefined && paths.ref[key].tokens[connection.token] !== undefined) {
                delete paths.ref[key].tokens[connection.token];

                paths.syncToDatabase();

                var data = {};
                data.info = "listener_removed";

                this.response(connection, data, null, pId);
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
                    object.sendUpdateFor("{}", device, function() {
                        let data = {};
                        data.info = "queue_updated";
                        action.response(connection, data, null);
                    }, connection);
                } else {
                    object.sync(connection, {
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
        paths.syncFromDatabase();
        let error = null;

        if (connection.path !== undefined) {
            if (connection.path.indexOf("\.") === -1) {
                if (connection.path.indexOf("/") === 0) {
                    let key = connection.path.replaceAll("/", "\.");
                    key = key.substr(1, key.length - 1);
                    if (paths.ref[key] !== undefined) {
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
            let message = req;
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
        logger.debug("spawning worker " + i);
        workers[i] = cluster.fork();
        workers[i].on('exit', function(code, signal) {
            logger.debug('respawning worker ' + i);
            spawn(i);
        });
    };

    for (let i = 0; i < numCPUs; i++) {
        spawn(i);
    }

    cluster.on('error', err => {
        // handle the err here or just ignore them
    });


} else {

    let clusterId = cluster.worker.id;
    let app = express();
    let server = app.listen(port, function () {
        logger.info("server started on port " + port + " => worker " + cluster.worker.id);
    });
    let io = sio(server);

    io.adapter(sio_redis({ host: 'localhost', port: 6379 }));
    io.on('connection', function (client) {
        let key = "database";
        client.on(key, function (data) {
            try {
                logger.error("joining with " + client.id)
                // logger.error("joining with " + JSON.parse(data).token)
            } catch (e) {
                logger.error(e)
            }

            io.of('/').adapter.remoteJoin(client.id, "/" + key + "/" + JSON.parse(data).token, (err) => {
                if (err) {
                    logger.error("unknown id joining")
                } else {
                    action.parseRequest(JSON.parse(data), function(token, result) {
                        logger.info("worker " + clusterId + ": socket.io emit() -> " + token);
                        logger.info("worker " + clusterId + ": sending -> " + JSON.stringifyAligned(result));
                        io.in("/" + key + "/" + token).emit(key, result);
                    });
                }
            });

        });
    });

}
