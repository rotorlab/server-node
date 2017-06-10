var express =               require('express');
var bodyParser =            require('body-parser');
var log4js =                require('log4js');
var cluster =               require('cluster');
var http =                  require('http');
var numCPUs =               require('os').cpus().length;

var TAG =                   "SERVER CLUSTER";
var logger =                log4js.getLogger(TAG);

if (cluster.isMaster) {
    logger.info("Master " + process.pid + " is running");

    // Fork workers.
    for (var i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    // Listen for dying workers
    cluster.on('exit', function (worker) {

        // Replace the dead worker,
        // we're not sentimental
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
            parseRequest(req, res)
        })
        .post(function (req, res) {
            parseRequest(req, res)
        });

    app.listen(port, function () {
        logger.info("server cluster started on port " + port + " on " + cluster.worker.id + " worker");
    });

}

function parseRequest(req, res) {
    var response = res;

    try {
        var message = req.body.message;
        var connection = {};     // connection element

        logger.debug("user-agent: " + req.headers['user-agent']);


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

        console.log("* connection: " + connection.id);

        switch (connection.method) {
            case "single_listener":
                try {
                    addSingleListener(connection);
                } catch (e) {
                    response(connection, null, "error_adding_single");
                }
                break;

            case "great_listener":
                try {
                    addGreatListener(connection);
                } catch (e) {
                    response(connection, null, "error_adding_great");
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

function response(connection, data, error) {
    var result = {status: (data === null || error !== null ? "KO" : "OK"), data: data, error: error};
    connection.response.contentType('application/json');
    connection.response.send(JSON.stringify(result));
}



