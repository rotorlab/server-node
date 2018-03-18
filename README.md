[ ![rotorlab/server-node](https://d25lcipzij17d.cloudfront.net/badge.svg?id=js&type=6&v=0.0.1&x2=0)](https://www.npmjs.com/package/rotor-server)
<p align="center"><img width="10%" vspace="20" src="https://github.com/rotorlab/database-kotlin/raw/develop/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png"></p>

# Rotor Server for Node
Server cluster to hold a realtime JSON database.

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
npm install rotor-server --save
```

Create a server cluster to hold all realtime changes.

```javascript
var RotorServer = require('rotor-server');
var server = new RotorServer();
server.initCluster({
    start: function () {
        console.log("rotor server ready")
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
rotor server ready
server cluster started on port 1507 | worker => 7
server cluster started on port 1507 | worker => 6
server cluster started on port 1507 | worker => 5
server cluster started on port 1507 | worker => 3
server cluster started on port 1507 | worker => 2
server cluster started on port 1507 | worker => 4
server cluster started on port 1507 | worker => 8
server cluster started on port 1507 | worker => 1
```

### Libraries and packages
Client to work with Rotor server:

- [Android](https://github.com/rotorlab/database-kotlin)
```groovy
// gradle
implementation 'com.rotor:database:0.1.0'
```

