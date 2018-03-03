[ ![flamebase/flamebase-server](https://d25lcipzij17d.cloudfront.net/badge.svg?id=js&type=6&v=1.5.0&x2=0)](https://www.npmjs.com/package/flamebase-server)

# :fire: flamebase-database-server-cluster
Server cluster to hold a realtime JSON database.

### What is this?
Flamebase is an open source project that tries to emulate Firebase Database features as much as possible. I like Firebase but it's expensive for what it currently offers.
If you are doing an altruist project with Firebase, pray not to became successful, because the monthly amount will increase considerably.

In this repo you can find the proper package for run a server cluster with node framework.
For now it still developing, so please be patient with errors.

### Setup

Prepare Redis server

OSX:
```bash
// install
brew install redis
 
// run
redis-server

// for testing with physical devices
redis-server --protected-mode no
 
// logs
redis-cli monitor
 
// test channels (sub/pub)
redis-cli PUBLISH d7bec76dac4e holi // redis-cli PUBLISH <Flamebase.id> message
```
Ubuntu:
```bash 
// install
sudo apt-get install redis-server
 
// run
sudo service redis-server status
```

Install Flamebase:
```bash
npm install flamebase-server --save
```

Create a server cluster to hold all realtime changes.

```javascript
var FlamebaseServer = require('flamebase-server');
var server = new FlamebaseServer();
server.initCluster({
    start: function () {
        console.log("flamebase cluster ready")
    },
    config: {
        server_port: 1507,
        redis_port: 6379,
        db_name: "database",
        log_dir: "logs/",
        debug: true
    }
});
```
Alternatively you can start the server cluster by cloning this repo and launch on terminal:
```bash
node launcher.js 
```
Console Output:
```bash
start!!
[2017-07-02 21:05:48.337] [INFO] SERVER CLUSTER - Master 40001 is running
[2017-07-02 21:05:48.836] [INFO] SERVER CLUSTER - server cluster started on port 1507 | worker => 2
[2017-07-02 21:05:48.836] [INFO] SERVER CLUSTER - server cluster started on port 1507 | worker => 5
[2017-07-02 21:05:48.837] [INFO] SERVER CLUSTER - server cluster started on port 1507 | worker => 3
[2017-07-02 21:05:48.836] [INFO] SERVER CLUSTER - server cluster started on port 1507 | worker => 1
[2017-07-02 21:05:48.839] [INFO] SERVER CLUSTER - server cluster started on port 1507 | worker => 4
[2017-07-02 21:05:48.838] [INFO] SERVER CLUSTER - server cluster started on port 1507 | worker => 7
[2017-07-02 21:05:48.839] [INFO] SERVER CLUSTER - server cluster started on port 1507 | worker => 8
[2017-07-02 21:05:48.839] [INFO] SERVER CLUSTER - server cluster started on port 1507 | worker => 6
```

### Libraries and packages
Client options to connect with server cluster.

- [Android](https://github.com/flamebase/flamebase-database-android)
```groovy
// gradle
implementation 'com.flamebase:database:1.5.0'
```

