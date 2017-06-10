var express =               require('express');
var bodyParser =            require('body-parser');
var log4js =                require('log4js');
var cluster =               require('cluster');
var http =                  require('http');
var numCPUs =               require('os').cpus().length;
var FlamebaseDatabase =     require("flamebase-database-node");

var TAG =                   "SERVER CLUSTER";
var logger =                log4js.getLogger(TAG);

//
var chats = new FlamebaseDatabase("paths", "/");

var action = {
    response: function (connection, data, error, pId) {
        var result = {status: (data === null || error !== null ? "KO" : "OK"), data: data, error: error};
        logger.info("worker: " + pId);
        logger.info("response: " + JSON.stringify(result));
        connection.response.contentType('application/json');
        connection.response.send(JSON.stringify(result));
    },
    addSingleListener: function (connection, pId) {
        this.addGreatListener(connection, pId);
    },
    addGreatListener: function (connection, pId) {
        chats.syncFromDatabase();

        if (chats.ref === undefined) {
            chats.ref = {}
        }

        if (chats.ref[connection.path] === undefined) {
            chats.ref[connection.path] = {}
        }

        if (chats.ref[connection.path].tokens === undefined) {
            chats.ref[connection.path].tokens = {};
        }

        if (chats.ref[connection.path].tokens[connection.token] === undefined) {
            chats.ref[connection.path].tokens[connection.token] = {};
        }

        chats.ref[connection.path].tokens[connection.token].time = new Date().getTime();

        chats.syncToDatabase();

        this.response(connection, "listener_added", null, pId);
    }
};

if (cluster.isMaster) {
    logger.info("Master " + process.pid + " is running");

    for (var i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', function (worker) {
        console.log('Worker %d died :(', worker.id);
        cluster.fork();
    });

} else {

    var app = express();
    var port = 1507;

    app.use(bodyParser.urlencoded({
        extended: true
    }));

    app.use(bodyParser.json());

    app.route('/')
        .get(function (req, res) {
            parseRequest(req, res, cluster.worker.id)
        })
        .post(function (req, res) {
            parseRequest(req, res, cluster.worker.id)
        });

    app.listen(port, function () {
        logger.info("server cluster started on port " + port + " on " + cluster.worker.id + " worker");
    });

}

function parseRequest(req, res, worker) {
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
                    action.addSingleListener(connection, worker);
                } catch (e) {
                    logger.error("there was an error parsing request from addSingleListener: " + e.toString());
                    action.response(connection, null, "error_adding_single", worker);
                }
                break;

            case "great_listener":
                try {
                    action.addGreatListener(connection, worker);
                } catch (e) {
                    logger.error("there was an error parsing request from addGreatListener: " + e.toString());
                    action.response(connection, null, "error_adding_great", worker);
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




