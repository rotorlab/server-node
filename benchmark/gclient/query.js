const rp = require('request-promise');
const SN = require('sync-node');
const queue = SN.createQueue();
const logjs = require('logjsx');
const logger = new logjs();
logger.init({
    level: "DEBUG"
});
const url = "http://localhost:3000/graphql";
const numReq = 1000;

/**
 * Returns data from graphql query
 * @param url
 * @param data
 * @returns {Promise<any>}
 */
function ask(url, data) {
    return new Promise(function(resolve, reject) {
        let options = {
            method: 'POST',
            uri: url,
            body: data,
            json: true
        };
        rp(options)
            .then(function (parsedBody) {
                resolve(parsedBody)
            })
            .catch(function (err) {
                reject(err)
            });
    });
}

function randomString() {
    let text = "";
    let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 3; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

let started = new Date().getTime();

queue.pushJob(function(){
    logger.debug("quering " + numReq + " times");
});

for (let i = 0; i < numReq; i++) {
    let id = randomString();
    let data = {};
    data.query = "query UserQueries { userByName(name: \"" + id + "\") { name } }";

    queue.pushJob(function(){
        return new Promise(function (resolve, reject) {
            ask(url, data).then(function(user) {
                resolve()
            })

        })
    });
}


queue.pushJob(function(){
    let duration = new Date().getTime() - started;
    logger.debug("quering " + numReq + " times -> finished in: " + (duration/1000) + " secs");
});