# Turbine
Turbine is a handler for JSON databases. Works as a service receiving requests and returning, storing or querying data as quick as possible.

### The problem
I have multiple clusters working with the same data. For them it isn't an effort to read from a JSON database and work with data. The problem appears when those clusters **try** to store data on database at the same time.

Multiple processes working with the same file can produce writing errors. Imagine the consequences.

### The solution
Turbine is a single process that manages a JSON database for you. It allows to work with the same data on different clusters or processes avoiding fatal errors writing on database. It has been designed for Rotor framework but can be used as a query engine.

### Benchmark
For check how fast is Turbine, there is a performance comparision with GrahpQL engine. Both are used as servers that receive requests and do some process.
Additionally, both servers work with pre-loaded data.

|Action  |GrapqhQL  |Turbine| Times |
|---|---|---|---|
| GET  | 37.6 s. | 2.7 s. | x1000
| POST  | 2.5 s. | 2.1 s. | x1000
| QUERY  | 46.9 s. | 2.1 s. | x1000

For more details, check [Benchmark](https://github.com/rotorlab/server-node/tree/master/benchmark) section.

### Installation
```bash
npm install @rotor-server/turbine --save
```

### Usage

#### prepare Turbine
```javascript
const Turbine = require('@rotor-server/turbine');
let turbine = new Turbine({
    "turbine_port": 4004,
    "turbine_ip": "http://localhost",
    "db_name": "database",
    "debug": true
});
```

#### server
```javascript
turbine.init();
```
#### get
Looks for an object on the given path.
```javascript
turbine.get("/users/usersA").then(function(user) {
    console.log(JSON.stringify(user))
}
```
#### post
Updates or removes an object on the given path passing another object or null.
```javascript
turbine.post("/users/usersB", newUser).then(function() {
    console.log("stored")
}
```
#### query
```javascript
Looks for an object on the given path for the conditions passed.
turbine.query("/users/*", { name: "Matt" }).then(function(users) {
    for (let user in users) {
        console.log(JSON.stringify(users[user]))
    }
});
```

### Usage on clusters
```node
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const express = require('express');
const bodyParser = require('body-parser');
const timeout = require('connect-timeout');
const Turbine = require('@rotor-server/turbine');

let turbine = new Turbine({
    "turbine_port": 4004,
    "turbine_ip": "http://localhost",
    "db_name": "database",
    "debug": true
});

let port = 3003;

if (cluster.isMaster) {
    // start server
    turbine.init();

    let workers = [];
    let spawn = function (i) {
        workers[i] = cluster.fork();
        workers[i].on('exit', function (code, signal) {
            console.log('respawning worker ' + i);
            spawn(i);
        });
    };
    for (let i = 0; i < numCPUs; i++) {
        spawn(i);
    }
} else {
    var app = express();
    app.use(bodyParser.urlencoded({extended: true}));
    app.use(bodyParser.json({limit: '50mb'}));
    app.use(timeout('120s'));
    app.route('/')
        // turbine server has been started, start managing data
        .get(async function (req, res) {
            if (req.body.query !== undefined) {
                let object = await turbine.query(req.body.path, req.body.query);
                res.json(object);
            } else {
                let object = await turbine.get(req.body.path);
                res.json(object);
            }
        })
        .post(async function (req, res) {
            await turbine.post(req.body.path, req.body.content);
            res.json({});
        });
    app.listen(port, function () {
        console.log("cluster started on port " + port + " | worker => " + cluster.worker.id);
    });
}

```