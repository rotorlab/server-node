[ ![rotorlab/server-node](https://d25lcipzij17d.cloudfront.net/badge.svg?id=js&type=6&v=0.0.1&x2=0)](https://www.npmjs.com/package/rotor-server)
<p align="center"><img width="10%" vspace="20" src="https://github.com/rotorlab/database-kotlin/raw/develop/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png"></p>

# Rotor Server for Node
Server cluster to hold a realtime JSON database.

### [Wiki ->](https://github.com/rotorlab/server-node/wiki)

[1. Redis](https://github.com/rotorlab/server-node/wiki/Redis)

[2. Implementation](https://github.com/rotorlab/server-node/wiki/Implementation)

[3. Start](https://github.com/rotorlab/server-node/wiki/Start)

[4. Paths and models](https://github.com/rotorlab/server-node/wiki/Paths-and-models)

Install Rotor server:
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
rotor cluster started on port 1507 | worker => 3
rotor cluster started on port 1507 | worker => 6
rotor cluster started on port 1507 | worker => 2
rotor cluster started on port 1507 | worker => 1
rotor cluster started on port 1507 | worker => 5
rotor cluster started on port 1507 | worker => 7
rotor cluster started on port 1507 | worker => 4
rotor cluster started on port 1507 | worker => 8

```
### Workflow
![schema](https://github.com/rotorlab/server-node/raw/feature/mongodb/schema.png)

### Libraries and packages
Client to work with Rotor server:

- [Android](https://github.com/rotorlab/database-kotlin)
```groovy
// gradle
def rotor_version =  "0.1.0"
dependencies {
    implementation ("com.rotor:core:$rotor_version@aar") {
        transitive = true
    }
    implementation ("com.rotor:database:$rotor_version@aar") {
        transitive = true
    }
}
```

