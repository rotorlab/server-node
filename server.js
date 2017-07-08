var express =               require('express');
var bodyParser =            require('body-parser');
var log4js =                require('log4js');
var cluster =               require('cluster');
var http =                  require('http');
var numCPUs =               require('os').cpus().length;
var FlamebaseDatabase =     require("flamebase-database-node");
var Path =                  require("./model/path.js");
var apply =                 require('rus-diff').apply;
var clone =                 require('rus-diff').clone;
var sha1 =                  require('sha1');

JSON.stringifyAligned = require('json-align');

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

var expectedDBNEnvVar = "DATABASE_NAME";
var expectedPORTEnvVar = "DATABASE_PORT";
var expectedAPIKeyEnvVar = "API_KEY";
var dbMaster = null;
var port = null;
var APIKey = null;

process.argv.forEach(function (val, index, array) {
    if (val.indexOf(expectedDBNEnvVar) > -1) {
        dbMaster = val.replaceAll(expectedDBNEnvVar + "=", "");
    }
    if (val.indexOf(expectedPORTEnvVar) > -1) {
        port = val.replaceAll(expectedPORTEnvVar + "=", "");
    }
    if (val.indexOf(expectedAPIKeyEnvVar) > -1) {
        APIKey = val.replaceAll(expectedAPIKeyEnvVar + "=", "");
    }
});


var TAG =                   "SERVER CLUSTER";
var logger =                log4js.getLogger(TAG);

var dbPaths = "paths";

if (cluster.isMaster) {

    var workers = {};

    logger.info("Master " + process.pid + " is running");

    for (var i = 0; i < numCPUs; i++) {
        var worker = cluster.fork();
        workers[worker.pid] = worker;
    }

    cluster.on('exit', function (worker) {
        console.log('Worker %d died :(', worker.id);
        var w = cluster.fork();
        workers[w.pid] = w;
    });

} else {

    var action = {
        response: function (connection, data, error, pId) {
            var result = {status: (data === null || error !== null ? "KO" : "OK"),
                data: (data === null ? {} : data), error: error};
            logger.info("worker: " + pId);
            logger.info("response: " + JSON.stringify(result));
            connection.response.contentType('application/json');
            connection.response.send(result);
        },
        addSingleListener: function (connection, pId) {
            this.addGreatListener(connection, pId);
        },
        addGreatListener: function (connection, pId) {
            var paths = new FlamebaseDatabase(dbPaths, "/");
            paths.syncFromDatabase();
            logger.debug(JSON.stringifyAligned(paths.ref));
            paths.syncFromDatabase();
            logger.debug("getting");
            logger.debug(JSON.stringifyAligned(paths.ref));

            if (paths.ref === undefined) {
                paths.ref = {}
            }

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

                if (paths.ref[key].tokens[connection.token] === undefined) {
                    paths.ref[key].tokens[connection.token] = {};
                    paths.ref[key].tokens[connection.token].os = connection.os;
                }

                var keys = Object.keys(paths.ref[key].tokens);
                var lastChangeTime = 0;
                var lastToken = null;

                for (var i = keys.length - 1; i >= 0; i--) {
                    var time = paths.ref[key].tokens[keys[i]].time;
                    if (lastChangeTime < time) {
                        lastChangeTime = time;
                        lastToken = keys[i];
                    }
                }

                paths.ref[key].tokens[connection.token].time = new Date().getTime();

                paths.syncToDatabase();

                var equals = this.verifyLenght(connection, pId);

                var object = this.getReference(connection, pId);
                object.FD.syncFromDatabase();
                var len = 0;

                if (typeof object !== "string") {
                    len = JSON.stringify(object.FD.ref).length;
                } else {
                    this.response(connection, null, object, pId);
                    return;
                }

                var data = {};
                data.len = len;

                if (lastToken === connection.token && equals) {
                    data.info = "listener_up_to_date";
                } else {
                    data.info = "listener_ready_for_refresh_client";
                }

                this.response(connection, data, null, pId);
            } else {
                this.response(connection, null, "path_contains_dots", pId);
            }

        },
        verifyLenght: function (connection, pId) {
            var paths = new FlamebaseDatabase(dbPaths, "/");
            paths.syncFromDatabase();
            var object = this.getReference(connection, pId);
            // var len = JSON.stringify(object.FD.ref).length;
            logger.debug(sha1(JSON.stringify(object.FD.ref)).toUpperCase());
            logger.debug(connection.sha1);

            var hash = sha1(JSON.stringify(object.FD.ref)).toUpperCase();
            return hash === connection.sha1;
        },
        getUpdatesFrom: function (connection, pId) {
            var paths = new FlamebaseDatabase(dbPaths, "/");
            paths.syncFromDatabase();
            logger.debug("getting");
            logger.debug(JSON.stringifyAligned(paths.ref));
            var object = this.getReference(connection, pId);
            if (typeof object === "string") {
                this.response(connection, null, object, pId);
            } else {
                var device = {
                    token: connection.token,
                    os: connection.os
                }
                object.sendUpdateFor(connection.content, device)
                var data = {};
                data.info = "updates_sent";
                data.len = JSON.stringify(object.FD.ref).length;
                this.response(connection, data, null, pId);
            }
        },
        updateData: function (connection, pId) {
            var paths = new FlamebaseDatabase(dbPaths, "/");
            paths.syncFromDatabase();
            logger.debug("getting");
            logger.debug(JSON.stringifyAligned(paths.ref));
            var object = this.getReference(connection, pId);
            if (typeof object === "string") {
                this.response(connection, null, object, pId);
            } else {
                object.FD.syncFromDatabase();

                var differences = connection.differences;

                if (differences !== undefined) {
                    logger.debug(JSON.stringify(differences));
                    apply(object.FD.ref, JSON.parse(differences));

                    if (JSON.stringify(object.FD.ref).length !== connection.len) {
                        object.FD.syncToDatabase();
                        this.response(connection, null, "data_updated_with_differences", pId);
                    } else {
                        object.FD.syncToDatabase();
                        this.response(connection, "data_updated", null, pId);
                    }
                } else {
                    this.response(connection, "no_diff_updated", null, pId);
                }
            }
        },
        getReference: function (connection, pId) {
            var paths = new FlamebaseDatabase(dbPaths, "/");
            paths.syncFromDatabase();
            var error = null;
            if (connection.path !== undefined) {
                if (connection.path.indexOf("\.") === -1) {
                    if (connection.path.indexOf("/") === 0) {
                        var key = connection.path.replaceAll("/", "\.");
                        key = key.substr(1, key.length - 1);
                        if (paths.ref[key] !== undefined) {
                            return new Path(APIKey,paths.ref[key], dbMaster, connection.path, pId);
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
        parseRequest: function (req, res, worker) {
            var response = res;

            try {
                var message = req.body;
                var connection = {};     // connection element

                logger.debug("user-agent: " + req.headers['user-agent']);
                logger.debug("worker: " + worker);


                if (message === undefined || message === null) {
                    logger.error("there vas an error on the connection instance creation: no_params");
                    var result = {status: "KO", data: null, error: "missing_params"};
                    response.contentType('application/json');
                    response.send(JSON.stringify(result));
                    return null
                }

                var keys = Object.keys(message); // keys
                for (var i = 0; i < keys.length; i++) {
                    var key = keys[i];
                    switch (key) {
                        case "method":
                            connection[key] = message[key];
                            logger.debug("method: " + connection[key]);
                            break;

                        case "path":
                            connection[key] = message[key];
                            logger.debug("path: " + connection[key]);
                            break;

                        case "sha1":
                            connection[key] = message[key];
                            logger.debug("sha1: " + connection[key]);
                            break;

                        case "token":
                            connection[key] = message[key];
                            logger.debug("token: " + connection[key]);
                            break;

                        case "differences":
                            connection[key] = message[key];
                            logger.debug("differences: " + connection[key]);
                            break;

                        case "content":
                            connection[key] = message[key];
                            logger.debug("content: " + connection[key]);
                            break;

                        case "len":
                            connection[key] = message[key];
                            logger.debug("len: " + connection[key]);
                            break;

                        case "os":
                            connection[key] = message[key];
                            logger.debug("os: " + connection[key]);
                            break;

                        case "clean":
                            connection[key] = message[key];
                            logger.debug("clean: " + connection[key]);
                            break;

                        default:

                            //
                            break;
                    }
                }

                // super important values
                connection.id = new Date().getTime();
                connection.request = req;
                connection.response = response;

                switch (connection.method) {
                    case "single_listener":
                        try {
                            this.addSingleListener(connection, worker);
                        } catch (e) {
                            logger.error("there was an error parsing request from addSingleListener: " + e.toString());
                            this.response(connection, null, "cluster_" + worker + "_error_adding_single", worker);
                        }
                        break;

                    case "great_listener":
                        try {
                            this.addGreatListener(connection, worker);
                        } catch (e) {
                            logger.error("there was an error parsing request from addGreatListener: " + e.toString());
                            this.response(connection, null, "cluster_" + worker + "_error_adding_great", worker);
                        }
                        break;

                    case "update_data":
                        try {
                            this.updateData(connection, worker);
                        } catch (e) {
                            logger.error("there was an error parsing request from updateData: " + e.toString());
                            this.response(connection, null, "cluster_" + worker + "_error_updating_data", worker);
                        }
                        break;

                    case "get_updates":
                        try {
                            this.getUpdatesFrom(connection, worker);
                        } catch (e) {
                            logger.error("there was an error parsing request from getUpdatesFrom: " + e.toString());
                            this.response(connection, null, "cluster_" + worker + "_error_getting_updates", worker);
                        }
                        break;

                    default:
                        //
                        break;

                }

            } catch (e) {
                logger.error("there was an error parsing request: " + e.toString());

                var result = {status: "KO", data: null, error: "missing_or_wrong_params"};

                res.contentType('application/json');
                res.send(JSON.stringify(result));
            }
        }
    };

    var app = express();

    app.use(bodyParser.urlencoded({
        extended: true
    }));

    app.use(bodyParser.json());

    app.route('/')
        .get(function (req, res) {
            action.parseRequest(req, res, cluster.worker.id)
        })
        .post(function (req, res) {
            action.parseRequest(req, res, cluster.worker.id)
        });

    app.listen(port, function () {
        logger.info("server cluster started on port " + port + " on " + cluster.worker.id + " worker");
    });
}