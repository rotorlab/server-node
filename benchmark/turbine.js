const JsonDB = require('node-json-db');
const express = require('express');
const Interval = require('Interval');
const setIn = require('set-in');
const unset = require('unset');
const bodyParser = require('body-parser');
const timeout = require('connect-timeout');
const SN = require('sync-node');
const createIterator = require('iterall').createIterator;
const isCollection = require('iterall').isCollection;
const RecursiveIterator = require('recursive-iterator');
const logjs = require('logjsx');
const logger = new logjs();
logger.init({
    level: "DEBUG"
});

String.prototype.replaceAll = function (search, replacement) {
    let target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

const SLASH = "/";
const router = express.Router();
const queue = SN.createQueue();

const database = new JsonDB("database", true, true);
let data = database.getData(SLASH);
let dataVal = {};

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

    reindexVal: function(object, path) {
        for(let {parent, node, key, path, deep} of new RecursiveIterator(object)) {
            if (typeof node !== "object") {
                if (dataVal[node] === undefined) {
                    dataVal[node] = [];
                }
                dataVal[node].push("/" + path.join("/"));
            }
        }
    },

    updateValDB: function(value, object) {
        // remove previous values
        let obj = action.getObject(value);
        action.recursiveUnset(obj, value);

        // store new values
        action.recursiveSet(object, value);
    },

    recursiveUnset: function(object, pa) {
        for(let {parent, node, key, path, deep} of new RecursiveIterator(object)) {
            if (typeof node !== "object") {
                if (dataVal[node] === undefined) {
                    dataVal[node] = [];
                }
                let toRemove = pa + "/" + path.join("/");
                if (dataVal[node].indexOf(toRemove) > -1) {
                    logger.debug("removing: " + node);
                    dataVal[node].slice(dataVal[node].indexOf(toRemove), 1)
                }
            }
        }
    },

    recursiveSet: function(object, pa) {
        for(let {parent, node, key, path, deep} of new RecursiveIterator(object)) {
            if (typeof node !== "object") {
                if (dataVal[node] === undefined) {
                    dataVal[node] = [];
                }
                let toAdd = pa + "/" + path.join("/");
                if (dataVal[node].indexOf(toAdd) === -1) {
                    logger.debug("adding: " + node);
                    dataVal[node].push(toAdd)
                }
            }
        }
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
                    let keys = Object.keys(query);
                    for (let k in keys) {
                        let key = keys[k];
                        if (dataVal[query[key]] !== undefined) {
                            for (let p in dataVal[query[key]]) {
                                if (dataVal[query[key]][p].indexOf(value.replace(/\*/g, '')) > -1) {
                                    let valid = dataVal[query[key]][p].replaceAll("/" + key, "");
                                    result.push(action.getObject(valid));
                                }
                            }
                        }
                    }
                    break;
                } else {
                    if (object[branch] === undefined || object[branch] === null) {
                        object[branch] = {};
                    }
                    object = object[branch];
                }
            }
            let res = [];
            for (let obj in result) {
                if (action.validateObject(result[obj], query)) {
                    if (!action.containsObject(res, result[obj])) {
                        res.push(result[obj])
                    }
                }
            }
            return res
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
        action.updateValDB(value, object);
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
    },

    containsObject: function(array, toCheck) {
        if (array === null || array.length === 0) {
            return false
        } else if (toCheck === undefined) {
            return false
        }
        let isContained = true;
        for (let index in array) {
            let item = array[index];
            let fields = Object.keys(toCheck);
            for (let f in fields) {
                let field = fields[f];
                if (item[field] === undefined || item[field] !== toCheck[field]) {
                    isContained = false;
                    break;
                }
            }
        }
        return isContained
    }
};


action.reindexVal(data, "");
logger.debug("databases ready: " + Object.keys(dataVal).length + " entries");


/**
 * backup every 5 seconds
 */
let count = 0;
Interval.run(function () {
    queue.pushJob(function () {
        count++;
        // data = action.reindex(data);
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