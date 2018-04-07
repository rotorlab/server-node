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

<p align="center"><img width="10%" vspace="20" src="https://github.com/rotorlab/server-node/raw/develop/images/MacBookPro_.png"></p>

Map with 100.000 entries and 90.000 different values (aprox):

### GraphQL x1000
```bash
getting 1000 times
getting 1000 times -> finished in: 37.696 secs
setting 1000 times
setting 1000 times -> finished in: 2.523 secs
quering 1000 times
quering 1000 times -> finished in: 46.932 secs
```

### Turbine x1000
```bash
getting 1000 times
getting 1000 times -> finished in: 2.773 secs
setting 1000 times
setting 1000 times -> finished in: 2.187 secs
querying 1000 times
querying 1000 times -> finished in: 2.101 secs
```

### GraphQL x10000
```bash
getting 10000 times
getting 10000 times -> finished in: 652.858 secs
setting 10000 times
setting 10000 times -> finished in: 52.642 secs
quering 10000 times
quering 10000 times -> finished in: 416.016 secs
```

### Turbine x10000
```bash
getting 10000 times
getting 10000 times -> finished in: 80.863 secs
setting 10000 times
setting 10000 times -> finished in: 54.426 secs
querying 10000 times
querying 10000 times -> finished in: 36.485 secs
```
