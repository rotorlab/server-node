const Redis =                 require('ioredis');
const numCPUs =               require('os').cpus().length;
const JsonDB =                require('node-json-db');
const Interval =              require('Interval');
const setIn =                 require('set-in');
const logger =                new logjs();

JSON.stringifyAligned =     require('json-align');
logger.init({
    level : "DEBUG"
});

const SLASH = "/";
const expectedDBNEnvVar = "DATABASE_NAME";
const expectedRPORTEnvVar = "REDIS_PORT";
const expectedDebugKeyEnvVar = "DEBUG";

let db_name = null;
let server_port = null;
let redis_port = null;
let debug = null;


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

const redis =   new Redis(redis_port);
const dbPath =  new JsonDB("paths", true, true);
const dbData =  new JsonDB(db_name, true, true);

/**
 * instanced objects: data - paths
 */
let paths = dbPath.getData(SLASH);
let data = dbData.getData(SLASH);

/**
 * backup every 5 seconds
 */
let count = 0;
Interval.run(function() {
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

// channels for send and receive data
for (let i = 0; i < numCPUs; i++) {

}

/**
 * Returns an object from a instance for the given type and path (value)
 * @param type
 * @param value
 * @returns {*}
 */
function getObject(type, value) {
    if (value.startsWith(SLASH) && value.length > SLASH.length) {
        let branchs = value.split(SLASH);
        let object = null;
        if (type === "data") {
            object = data
        } else if (type === "paths") {
            object = paths
        } else {
            return
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
        if (type === "data") {
            return data;
        } else if (type === "paths") {
            return paths
        } else {
            return null;
        }
    } else {
        return null
    }
}

/**
 * Stores an object in the instance for the given type and path (value)
 * @param type ->   "data" / "path"
 * @param value ->  "/notifications/998476354
 * @param object -> object to store
 * @returns {*}
 */
function saveObject(type, value, object) {
    if (value.startsWith(SLASH) && value.length > SLASH.length) {
        let branchsVal = value.split(SLASH);
        let branchs = [];
        for (let b in branchsVal) {
            if (branchsVal[b].length > 0) {
                branchs.push(branchsVal[b]);
            }
        }
        if (type === "data") {
            data = setIn(data, branchs, object);
        } else if (type === "paths") {
            paths = setIn(paths, branchs, object);
        }
    } else if (value.startsWith(SLASH) && value.length === SLASH.length) {
        if (type === "data") {
            data = object;
        } else if (type === "paths") {
            paths = object
        }
    }
}

