const Redis =                   require('ioredis');
const JsonDB =                  require('node-json-db');
const Interval =                require('Interval');
const setIn =                   require('set-in');
const express =                 require('express');
var bodyParser =                require('body-parser');
var timeout =                   require('connect-timeout');
const SN =                      require('sync-node');
const logjs =                   require('logjsx');
const logger = new logjs();

JSON.stringifyAligned =         require('json-align');
logger.init({
    level: "DEBUG"
});

const SLASH = "/";
const expectedDBNEnvVar = "DATABASE_NAME";
const expectedRPORTEnvVar = "REDIS_PORT";
const expectedDebugKeyEnvVar = "DEBUG";
const CHANNEL = "sentinel";

let db_name = null;
let redis_port = null;
let debug = null;

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

process.argv.forEach(function (val, index, array) {
    if (val.indexOf(expectedDBNEnvVar) > -1) {
        db_name = val.replaceAll(expectedDBNEnvVar + "=", "");
    }
    if (val.indexOf(expectedDebugKeyEnvVar) > -1) {
        debug = val.replaceAll(expectedDebugKeyEnvVar + "=", "") === "true";
    }
    if (val.indexOf(expectedRPORTEnvVar) > -1) {
        redis_port = val.replaceAll(expectedRPORTEnvVar + "=", "");
    }
});

const pubSub = new Redis(redis_port);
const redis = new Redis(redis_port);
const dbPath = new JsonDB("paths", true, true);
const dbData = new JsonDB(db_name, true, true);
const queue = SN.createQueue();

/**
 * instanced objects: data - paths
 */
let paths = dbPath.getData(SLASH);
let data = dbData.getData(SLASH);

/**
 * backup every 5 seconds
 */
let count = 0;
Interval.run(function () {
    ++count;
    try {
        dbPath.push(SLASH, paths);
    } catch (e) {
        logger.error("error on paths backup")
    }
    try {
        dbData.push(SLASH, data);
    } catch (e) {
        logger.error("error on data backup")
    }
    logger.debug("backup times: " + count);
}, 5000);

let action = {
    /**
     * Returns an object from a instance for the given type and path (value)
     * @param type
     * @param value
     * @returns {*}
     */
    getObject: function (type, value) {
        if (value.startsWith(SLASH) && value.length > SLASH.length) {
            let branchs = value.split(SLASH);
            let object = null;
            if (type === "paths") {
                object = paths
            } else {
                object = data
            }

            for (let b in branchs) {
                let branch = branchs[b];
                if (branch.length === 0) {
                    continue;
                }
                if (object[branch] === undefined || object[branch] === null) {
                    object[branch] = {};
                }
                object = object[branch];
            }
            return object
        } else if (value.startsWith(SLASH) && value.length === SLASH.length) {
            if (type === "paths") {
                return paths
            } else {
                return data;
            }
        } else {
            return null
        }
    },

    /**
     * Stores an object in the instance for the given type and path (value)
     * @param type ->   "data" / "path"
     * @param value ->  "/notifications/998476354
     * @param object -> object to store
     * @returns {*}
     */
    saveObject: function (type, value, object) {
        if (object === null) {
        } else if (value.startsWith(SLASH) && value.length > SLASH.length) {
            let branchsVal = value.split(SLASH);
            let branchs = [];
            for (let b in branchsVal) {
                if (branchsVal[b].length > 0) {
                    branchs.push(branchsVal[b]);
                }
            }
            if (type === "paths") {
                paths = setIn(paths, branchs, object);
            } else {
                data = setIn(data, branchs, object);
            }
        } else if (value.startsWith(SLASH) && value.length === SLASH.length) {
            if (type === "paths") {
                paths = object
            } else {
                data = object;
            }
        }
    }
};

let pathKeys = Object.keys(paths);
for (let k in pathKeys) {
    let key = pathKeys[k];
    let object = action.getObject(db_name, key);
    redis.set(key, JSON.stringify(object));
    logger.debug("loading " + key);
}

/*
pubSub.subscribe(CHANNEL, function (err, count) {
    //
});

pubSub.on('message', function (channel, message) {
    if (channel === CHANNEL) {
        let msg = JSON.parse(message);
        if (msg.method !== undefined && msg.path !== undefined && msg.database !== undefined) {
            if (msg.method === "get") {
                let object = action.getObject(msg.database, msg.path);
                redis.set(msg.path, JSON.stringify(object));
            } else if (msg.method === "post" && msg.value !== undefined) {
                //redis.set(msg.path, msg.value);
                action.saveObject(msg.database, msg.path, JSON.parse(msg.value))
            }
        }
    }
});*/

const app = express();
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json({limit: '50mb'}));
app.use(timeout('120s'));
app.post('/', function (req, res) {
    let msg = req;
    if (msg.method !== undefined && msg.path !== undefined && msg.database !== undefined) {
        if (msg.method === "get") {
            let object = action.getObject(msg.database, msg.path);
            // redis.set(msg.path, JSON.stringify(object));
            logger.debug("getting: " + JSON.stringify(object));
            res.send(JSON.stringify(object))
        } else if (msg.method === "post" && msg.value !== undefined) {
            //redis.set(msg.path, msg.value);
            action.saveObject(msg.database, msg.path, JSON.parse(msg.value));
            res.send('{}')
        } else {
            res.send('{}')
        }
    } else {
        res.send('{}')
    }
});

app.listen(3000);

