const logjs = require('logjsx');
const logger = new logjs();
logger.init({
    level: "DEBUG"
});
const numReq = 1;
const EMPTY_OBJECT = "{}";

const Turbine = require('../turbine_index.js');
let turbine = new Turbine({
    "turbine_port": 1510,
    "turbine_ip": "http://localhost",
    "debug": true
});

function randomString() {
    let text = "";
    let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 3; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}

function randomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}

async function get(i = 0) {
    if (i < numReq) {
        let notifications = await turbine.get("notifications", "/notifications/1526231920496");
        if (notifications && JSON.stringify(notifications) !== EMPTY_OBJECT) console.log(JSON.stringify(notifications));
        await get(i + 1)
    }
}

async function post(i = 0) {
    if (i < numReq) {
        await turbine.post("database", "/users/" + randomString(), {
            name: randomString(),
            age: randomInt(100)
        });
        await post(i + 1)
    }
}

async function query(i = 0) {
    if (i < numReq) {
        let q = {};
        let pp = "42e9c151fa3ba850";
        // logger.debug("id: " + pp);
        q.receivers = {};
        q.receivers[pp] = {};
        q.receivers[pp].id = pp;
        let notifications = await turbine.query("database", "/chats/*", {
            members: {
                UB9D5Lx8AqTO4EoyLcx4y6GB19w2: {
                    uid: "UB9D5Lx8AqTO4EoyLcx4y6GB19w2"
                }
            }
        });
      if (notifications && JSON.stringify(notifications) !== EMPTY_OBJECT) console.log(JSON.stringify(notifications));
      await query(i + 1)
    }
}

async function test() {

    let started = new Date();
    await get();
    let duration = new Date() - started;
    logger.info("get " + numReq + " times [" + (duration/1000) + " secs]");

    started = new Date();
    await query();
    duration = new Date() - started;
    logger.info("query " + numReq + " times [" + (duration/1000) + " secs]");

    //started = new Date();
    //await post();
    //duration = new Date() - started;
    //logger.info("set " + numReq + " times [" + (duration/1000) + " secs]");
}

test().then(function() {
    logger.info("finish!");
});
