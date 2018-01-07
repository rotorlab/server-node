var express =               require('express');
var bodyParser =            require('body-parser');
var timeout =               require('connect-timeout');
var logjs =                 require('logjsx');
var cluster =               require('cluster');
var sticky =                require('sticky-session');
var http =                  require('http');
var numCPUs =               require('os').cpus().length;
var FlamebaseDatabase =     require("./model/FlameDatabase.js");
var Path =                  require("./model/Path.js");
var apply =                 require('rus-diff').apply;
var clone =                 require('rus-diff').clone;
var sha1 =                  require('sha1');
var redis =                 require('socket.io-redis');
JSON.stringifyAligned =     require('json-align');

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

var expectedDBNEnvVar = "DATABASE_NAME";
var expectedPORTEnvVar = "DATABASE_PORT";
var expectedDebugKeyEnvVar = "DEBUG";
var dbMaster = null;
var port = null;
var debug = null;

process.argv.forEach(function (val, index, array) {
    if (val.indexOf(expectedDBNEnvVar) > -1) {
        dbMaster = val.replaceAll(expectedDBNEnvVar + "=", "");
    }
    if (val.indexOf(expectedPORTEnvVar) > -1) {
        port = val.replaceAll(expectedPORTEnvVar + "=", "");
    }
    if (val.indexOf(expectedDebugKeyEnvVar) > -1) {
        debug = val.replaceAll(expectedDebugKeyEnvVar + "=", "") === "true" ? true : false;
    }
});

debug = true;


var TAG =                   "SERVER CLUSTER";
var ROOM =                   "/databases/";
var logger = new logjs();

logger.init({
    level : "DEBUG"
});

var dbPaths = "paths";
var dbSessions = "sessions";
var sessions = new FlamebaseDatabase(dbSessions, "/");
var paths = new FlamebaseDatabase(dbPaths, "/");

var server = require('http').createServer(function(req, res) {
    res.end('worker: ' + cluster.worker.id);
});
var io = require('socket.io')(server);

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
                    },
                    refreshOnWorker:    function(worker) {
                        action.refreshPathOnWorker({
                            path: connection.path,
                            worker: worker
                        })
                    }
                });
            }

        } else {
            this.response(connection, null, "path_contains_dots");
        }

    },
    removeListener: function (connection) {
        var paths = new FlamebaseDatabase(dbPaths, "/");
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
     * Updates the queue on on path database
     * @param connection
     * @param pId
     * @param sessions
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
                        },
                        refreshOnWorker:    function(worker) {
                            action.refreshPathOnWorker({
                                path: connection.path,
                                worker: worker
                            })
                        }
                    });
                }
            } else {
                this.response(connection, "no_diff_updated", null);
            }
        }
    },
    /**
        {
            path: path,
            worker: worker
        }
     * @param info
     */
    refreshPathOnWorker: function (info) {
        logger.debug("asking for refresh path: " + JSON.stringifyAligned(info));
        process.send(info)
    },
    getReference:   function (connection) {
        let paths = new FlamebaseDatabase(dbPaths, "/");
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

if (!sticky.listen(server, port)) {

    logger.info("Master " + process.pid + " is running");

    for (var i = 0; i < numCPUs; i++) {
        let worker = cluster.fork();
        worker.on('exit', (code, signal) => {
            if (signal) {
                console.log(`worker was killed by signal: ${signal}`);
            } else if (code !== 0) {
                console.log(`worker exited with error code: ${code}`);
            } else {
                console.log('worker success!');
            }
        });
        /*
        worker.on('message', function(msg) {
            let w = msg.worker;
            let p = msg.path;
            let k = Object.keys(workers);
            for (let t in k) {
                if (w === k[t]) {
                    let wo = workers[k[t]];
                    wo.send({path: p});
                }
            }
            console.log('Master ' + process.pid + ' received message from worker ' + this.pid + '.', msg);
        });*/
    }

    cluster.on('message', (worker, message, handle) => {
        if (message.worker !== undefined && message.path !== undefined) {
            let w = message.worker;
            let p = message.path;
            let ki = Object.keys(cluster.workers);
            for (let l in ki) {
                let wor = cluster.workers[ki[l]];
                if (wor.id === w) {
                    logger.error("wId: " + wor.id);
                    cluster.workers[w].send({path: p});
                    break;
                }
            }
        }
    });

    cluster.on('exit', function (worker) {
        logger.error('Worker %d died :(', worker.id);
        cluster.fork();
    });

    server.once('listening', function() {
        logger.info('server started on ' + port + ' port');
    });
} else {

    // var app = express();
    // var app = require('express')();
    // var server = require('http').Server(app);

    // io.adapter(redis({ host: 'localhost', port: port }));

    /*
    app.use(bodyParser.urlencoded({
        extended: true
    }));

    app.use(bodyParser.json({limit: '50mb'}));
    app.use(timeout('120s'));

    app.route('/')
        .get(function (req, res) {
            //action.parseRequest(req, res, cluster.worker.id)
        })
        .post(function (req, res) {
            //action.parseRequest(req, res, cluster.worker.id)
        });*/

    //var connectedUsers = {};

    let cId = cluster.worker.id;

    io.on('connection', function (socket) {
        let key = "database";
        // socket.emit(key, { worker_id: cluster.worker.id });
        //io.emit(key, { worker_id: cluster.worker.id });
        socket.on(key, function (data) {
            let req = JSON.parse(data);
            socket.join(ROOM + req.token);

            sessions.syncFromDatabase();
            sessions.ref[req.token] = cId;
            sessions.syncToDatabase();

            action.parseRequest(req, function(token, result) {
                logger.info(cId + " callback worker");
                // logger.info("response: " + JSON.stringifyAligned(result));
                logger.info(cId + " id: " + JSON.stringifyAligned(token));
                io.sockets.in(ROOM + token).emit(key, result);

            });
        });
    });

    process.on('message', function(msg) {
        if (msg.path !== undefined) {
            let connection = {};
            connection.path = msg.path;
            connection.worker = cId;
            let key = "database";
            connection.callback = function(token, result) {
                logger.info(cId + " callback worker: " + cId);
                // logger.info("response: " + JSON.stringifyAligned(result));
                logger.info(cId + " id: " + JSON.stringifyAligned(token));
                io.sockets.in(ROOM + token).emit(key, result);

            };

            let object = action.getReference(connection);
            if (typeof object === "string") {
               logger.error(cId + " error: " + object);
                    // action.response(connection, null, object);
            } else {
                console.log(cId + ' synchronizing');
                object.sync(connection, {
                    success:            function() {
                        logger.debug(cId + ' synchronized');
                    },
                    refreshOnWorker:    function(worker) {
                        // logger.error('error');
                    }
                });
            }
            // logger.debug('Worker ' + cId + ' received message from master.', msg);
        } else {
            // logger.error("received this from master: " + JSON.stringifyAligned(msg));
        }
    });

    /*
    server.listen(port, function () {
        logger.info("server cluster started on port " + port + " on " + cluster.worker.id + " worker");
    });

    app.listen(port, function () {
        logger.info("server cluster started on port " + port + " on " + cluster.worker.id + " worker");
    });
    */
}