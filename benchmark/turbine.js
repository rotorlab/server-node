const JsonDB = require('node-json-db');
const express = require('express');
const Interval = require('Interval');
const setIn = require('set-in');
const unset = require('unset');
const bodyParser = require('body-parser');
const timeout = require('connect-timeout');
const SN = require('sync-node');
const logjs = require('logjsx');
const logger = new logjs();
logger.init({
    level: "DEBUG"
});

const SLASH = "/";
const router = express.Router();
const queue = SN.createQueue();

const database = new JsonDB("database", true, true);
let data = database.getData(SLASH);

let action = {
    /**
     * Returns an object from a instance for the given path (value)
     * @param value
     * @returns {*}
     */
    getObject: function (value) {
        if (value.startsWith(SLASH) && value.length > SLASH.length) {
            let branchs = value.split(SLASH);
            let object = data;
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
            return data;
        } else {
            return null
        }
    },

    reindex: function(object) {
        let temp = {};
        let keys = Object.keys(object);
        for (let k in keys) {
            let key = keys[k];
            let t = object[key];
            if (Object.keys(t) > 0) {
                temp[key] = this.reindex(object[key]);
            } else {
                temp[key] = object[key];
            }
        }
        return temp;
    },

    /**
     * Returns an object from a instance for the given query and path (value)
     * @param value
     * @returns {*}
     */
    getObjectFromQuery: function (value, query) {
        if (query === undefined || query === null || JSON.stringify(query) === "{}" || value.indexOf("*") === -1) {
            return null
        } else if (value.startsWith(SLASH) && value.length > SLASH.length) {
            let result = [];
            let branchs = value.split(SLASH);
            let object = data;
            for (let b in branchs) {
                let branch = branchs[b];
                if (branch.length === 0) {
                    continue;
                }
                if (branch === "*") {
                    let found = false;
                    let keys = Object.keys(object);
                    for (let k in keys) {
                        let key = keys[k];
                        let temp = object[key];
                        if (this.validateObject(temp, query)) {
                            result.push(temp);
                            found = true;
                        }
                    }
                    // * should be the last char
                    break;
                } else {
                    if (object[branch] === undefined || object[branch] === null) {
                        object[branch] = {};
                    }
                    object = object[branch];
                }
            }
            return result
        } else if (value.startsWith(SLASH) && value.length === SLASH.length) {
            return data;
        } else {
            return null
        }
    },

    /**
     * Stores an object in the instance for the given type and path (value)
     * @param value ->  "/notifications/998476354
     * @param object -> object to store
     * @returns {*}
     */
    saveObject: function (value, object) {
        if (object == null || JSON.stringify(object) === "{}") {
            data = unset(data, [value])
        } else if (value.startsWith(SLASH) && value.length > SLASH.length) {
            let branchsVal = value.split(SLASH);
            let branchs = [];
            for (let b in branchsVal) {
                if (branchsVal[b].length > 0) {
                    branchs.push(branchsVal[b]);
                }
            }
            data = setIn(data, branchs, object);
        } else if (value.startsWith(SLASH) && value.length === SLASH.length) {
            data = object;
        }
    },

    validateObject: function(object, query) {
        if (object === undefined) {
            return false
        }
        let fields = Object.keys(query);
        let valid = true;
        for (let f in fields) {
            let field = fields[f];
            if (object[field] === undefined || object[field] !== query[field]) {
                valid = false;
                break;
            }
        }
        return valid
    }
};

/**
 * backup every 5 seconds
 */
let count = 0;
Interval.run(function () {
    queue.pushJob(function () {
        count++;
        data = action.reindex(data);
        try {
            database.push(SLASH, data);
        } catch (e) {
            logger.error("error on data backup: " + e)
        }
        logger.debug("backup times: " + count);
    })
}, 5000);


const app = express();

app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(bodyParser.json({limit: '50mb'}));
app.use(timeout('120s'));

router.post('/', function (req, res) {
    queue.pushJob(function () {
        let msg = req.body;
        if (msg.method !== undefined && msg.path !== undefined) {
            if (msg.method === "get") {
                let object = action.getObject(msg.path);
                res.json(object)
            } else if (msg.method === "post" && msg.value !== undefined) {
                action.saveObject(msg.path, msg.value === null ? null : msg.value);
                res.json({})
            } else if (msg.method === "query" && msg.query !== undefined) {
                let object = action.getObjectFromQuery(msg.path, msg.query);
                res.json(object)
            } else {
                res.json({})
            }
        } else {
            res.json({})
        }
    });
});

app.use('/', router);
app.listen(3000);