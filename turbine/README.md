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


