# Benchmarks -> Turbine vs GraphQL

Results of 3 common actions on Turbine and GraphQL with a JSON database.

`get` actions looks for an object on the given path.
```bash
/users/userA
```

`set` actions updates an object on the given path passing another object.
```bash
/users/userA

{
    name: "Mark",
    age 30
}
```
`query` actions looks for an object on the given path for the conditions passed:
```bash
/users/*

{
    name: "Mark"
}
```
It will return all users named "Mark".

## Environtment
<img width="30%" vspace="20" src="https://github.com/rotorlab/server-node/raw/develop/images/MacBookPro_.png">

Map with 100.000 entries and 90.000 different values (aprox):

|Action|GrapqhQL|Turbine|
|---|
|   x1000 times  |
|---|---|---|
| GET  | 56 | 56 |
### GraphQL x1000
```bash
getting x1000 times
getting x1000 times -> finished in: 37.696 secs
setting x1000 times
setting x1000 times -> finished in: 2.523 secs
querying x1000 times
querying x1000 times -> finished in: 46.932 secs
```

### Turbine x1000
```bash
getting x1000 times
getting x1000 times -> finished in: 2.773 secs
setting x1000 times
setting x1000 times -> finished in: 2.187 secs
querying x1000 times
querying x1000 times -> finished in: 2.101 secs
```

### GraphQL x10000
```bash
getting x10000 times
getting x10000 times -> finished in: 652.858 secs
setting x10000 times
setting x10000 times -> finished in: 52.642 secs
querying x10000 times
querying x10000 times -> finished in: 416.016 secs
```

### Turbine x10000
```bash
getting x10000 times
getting x10000 times -> finished in: 80.863 secs
setting x10000 times
setting x10000 times -> finished in: 54.426 secs
querying x10000 times
querying x10000 times -> finished in: 36.485 secs
```

## Run tests
Run this test on your PC by cloning this repo and running on `/benchmark` folder:
```bash
node --stack_size=1200 turbine.js
node turbine_puncher.js
```
```bash
node graphql.js
node graphql_puncher.js
```