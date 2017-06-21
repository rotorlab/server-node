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


String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

var expectedDBNEnvVar = "DATABASE_NAME";
var expectedPORTNEnvVar = "DATABASE_PORT";
var dbMaster = null;
var port = null;

process.argv.forEach(function (val, index, array) {
    if (val.indexOf(expectedDBNEnvVar) > -1) {
        dbMaster = val.replaceAll(expectedDBNEnvVar + "=", "");
    }
    if (val.indexOf(expectedPORTNEnvVar) > -1) {
        port = val.replaceAll(expectedPORTNEnvVar + "=", "");
    }
});


var TAG =                   "SERVER CLUSTER";
var logger =                log4js.getLogger(TAG);

var dbPaths = "paths";
var paths = new FlamebaseDatabase(dbPaths, "/");

if (cluster.isMaster) {

    var workers = {};

    /**
     * dispatcher for new references
     * @param w
     */
    function initWorker(w) {
        workers[w.pid] = w;

        w.on('message', function(msg) {
            logger.debug('Master ' + process.pid + ' received message from worker ' + this.pid + '.', msg);
            var msg_parts = msg.split("_");
            var method = msg_parts[0];
            var path = msg_parts[1];
            switch (method) {
                case "new_ref":
                    var pids = Object.keys(workers);
                    for (var i = 0; i < pids.length; i++) {
                        var wor = workers[pids[i]];
                        var msg = {};
                        msg.method = method;
                        msg.path = path;
                        wor.send(msg);
                    }
                    break;

                default:

                    // nothing to do here
                    break;
            }
        });
    }

    logger.info("Master " + process.pid + " is running");

    for (var i = 0; i < numCPUs; i++) {
        var worker = cluster.fork();
        initWorker(worker);

    }

    cluster.on('exit', function (worker) {
        console.log('Worker %d died :(', worker.id);
        var w = cluster.fork();
        initWorker(w);
    });

} else {

    var action = {
        response: function (connection, data, error, pId) {
            var result = {status: (data === null || error !== null ? "KO" : "OK"), data: data, error: error};
            logger.info("worker: " + pId);
            logger.info("response: " + JSON.stringify(result));
            connection.response.contentType('application/json');
            connection.response.send(JSON.stringify(result));
        },
        addSingleListener: function (holder, connection, pId) {
            this.addGreatListener(connection, pId);
        },
        addGreatListener: function (holder, connection, pId) {
            paths.syncFromDatabase();

            if (paths.ref === undefined) {
                paths.ref = {}
            }

            var key = connection.path.replaceAll("/", "\.");

            if (paths.ref[key] === undefined) {
                paths.ref[key] = {}
            }

            if (paths.ref[key].tokens === undefined) {
                paths.ref[key].tokens = {};
            }

            if (paths.ref[key].tokens[connection.token] === undefined) {
                paths.ref[key].tokens[connection.token] = {};
            }

            paths.ref[key].tokens[connection.token].time = new Date().getTime();
            paths.ref[key].tokens[connection.token].os = connection.os;
            paths.ref[key].path = connection.path;

            paths.syncToDatabase();

            if (holder[connection.path] === undefined) {
                holder[connection.path] = new Path(paths.ref[key], dbMaster, connection.path);
                this.response(connection, "listener_added", null, pId);
            } else {
                holder[connection.path].start();
                this.response(connection, "listener_already_added", null, pId);
            }
        },
        updateData: function (holder, connection, pId) {

            if (holder[connection.path] !== undefined) {
                logger.debug("test 1");
                holder[connection.path].FD.syncFromDatabase();
                logger.debug("test 2");

                var differences = connection.differences;

                if (differences !== undefined) {
                    logger.debug(JSON.stringify(differences));

                    logger.debug("test 2 1 : " + JSON.stringify(differences));
                    logger.debug("test 2 2 : " + JSON.stringify(holder[connection.path].FD.ref));

                    apply(holder[connection.path].FD.ref, JSON.parse(differences));

                    logger.debug("test 3: " + JSON.stringify(holder[connection.path].FD.ref));

                    holder[connection.path].FD.syncToDatabase();
                    logger.debug("test 4");

                    this.response(connection, "data_updated", null, pId);
                } else {
                    this.response(connection, "no_diff_updated", null, pId);
                }

            } else {
                this.response(connection, null, "holder_not_located", pId);
            }
        },
        getReference: function (holder, connection, pId) {
            if (connection.path !== undefined) {
                if (paths.ref[id] !== undefined) {
                    return new Path(paths.ref[keys[i]], dbMaster, connection.path);
                } else {
                    return "holder_not_found";
                }

            } else {
                return "json_path_not_found";
            }
        },
        parseRequest: function (holder, req, res, worker) {
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

                        case "token":
                            connection[key] = message[key];
                            logger.debug("token: " + connection[key]);
                            break;

                        case "differences":
                            connection[key] = message[key];
                            logger.debug("differences: " + connection[key]);
                            break;

                        case "os":
                            connection[key] = message[key];
                            logger.debug("os: " + connection[key]);
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
                            this.addSingleListener(holder, connection, worker);
                        } catch (e) {
                            logger.error("there was an error parsing request from addSingleListener: " + e.toString());
                            this.response(connection, null, "cluster_" + worker + "_error_adding_single", worker);
                        }
                        break;

                    case "great_listener":
                        try {
                            this.addGreatListener(holder, connection, worker);
                        } catch (e) {
                            logger.error("there was an error parsing request from addGreatListener: " + e.toString());
                            this.response(connection, null, "cluster_" + worker + "_error_adding_great", worker);
                        }
                        break;

                    case "update_data":
                        try {
                            this.updateData(holder, connection, worker);
                        } catch (e) {
                            logger.error("there was an error parsing request from updateData: " + e.toString());
                            this.response(connection, null, "cluster_" + worker + "_error_updating_data", worker);
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
    var holder = {};

    app.use(bodyParser.urlencoded({
        extended: true
    }));

    app.use(bodyParser.json());

    app.route('/')
        .get(function (req, res) {
            action.parseRequest(holder, req, res, cluster.worker.id)
        })
        .post(function (req, res) {
            action.parseRequest(holder, req, res, cluster.worker.id)
        });

    app.listen(port, function () {
        paths.syncFromDatabase();
        logger.info("server cluster started on port " + port + " on " + cluster.worker.id + " worker");
        var keys = Object.keys(paths.ref);
        if (keys.length > 0) {
            for (var i = keys.length - 1; i >= 0; i--) {
                holder[paths.ref[keys[i]].path] = new Path(paths.ref[keys[i]], dbMaster, paths.ref[keys[i]].path);
            }
        }

    });

    process.on('message', function(msg) {
        logger.debug('Worker ' + process.pid + ' received message from master.', msg);

        var method  = msg.method;
        var path    = msg.path;

        switch (method) {

            case "new_ref":
                paths.syncFromDatabase();
                var keys = Object.keys(paths.ref);
                if (keys.length > 0) {
                    for (var i = keys.length - 1; i >= 0; i--) {
                        if (holder[paths.ref[keys[i]].path] === undefined) {
                            holder[paths.ref[keys[i]].path] = new Path(paths.ref[keys[i]], dbMaster, paths.ref[keys[i]].path);
                        }
                    }
                }
                break;


            default:

                // nothing to do here
                break;
        }
    });

}