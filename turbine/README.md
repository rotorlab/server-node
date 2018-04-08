# Turbine
Turbine is a handler for JSON databases. Works as a service receiving requests and returning, storing or querying data as quick as possible.

### The problem
I have multiple clusters working with the same data. For them it isn't an effort to read from a JSON database and work with data. The problem appears when those clusters **try** to store data on database at the same time.

Multiple processes working with the same file can produce writing errors. Imagine the consequences.

### The solution
Turbine is a single process that manages a JSON database for you. It avoids fatal errors at runtime while manages data so quickly. It has been designed for Rotor framework but can be used as a query engine.

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
```javascript
const Turbine = require('@rotor-server/turbine');
let turbine = new Turbine({
    "turbine_port": 4004,
    "db_name": "database",
    "debug": true
});

// start server (if needed)
turbine.init();

// give some seconds to server
setTimeout(function() {
    // get objects
    turbine.get("/users/usersA").then(function(user) {
        console.log(JSON.stringify(user))
    });

    // update or delete(passing null) objects
    let user = {};
    user.name = "Matt";
    user.age = 24;
    turbine.post("/users/usersA", user).then(function() {
        console.log("stored")
    });

    // query users
    turbine.query("/users/*", { name: "Matt" }).then(function(users) {
        for (let user in users) {
            console.log(JSON.stringify(user))
        }
    });
}, 2000);

// or async/await style
setTimeout(async function() {
    let user = await turbine.get("/users/usersA");
    console.log(JSON.stringify(user));

    user = {};
    user.name = "Matt";
    user.age = 24;
    await turbine.post("/users/usersA", user);
    console.log("stored");

    let users = await turbine.query("/users/*", { name: "Matt" });
    if (users.length === 0) {
        console.log("no items found")
    }
    for (let user in users) {
        console.log("item: " + JSON.stringify(users[user]))
    }
}, 2000);
```


