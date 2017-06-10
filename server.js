var express =             require('express');
var bodyParser =          require('body-parser');
var log4js =              require('log4js');

var TAG                 = "SERVER CLUSTER";
var logger              = log4js.getLogger(TAG);

// express
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
    logger.info("server cluster started on port " + port);
});

