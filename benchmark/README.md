# Benchmarks -> Turbine vs GraphQL

Results of 3 different type actions:

Map with 200.000 entries:

```bash
graphql test

getting 1000 times
getting 1000 times -> finished in: 23.615 secs
setting 1000 times
setting 1000 times -> finished in: 2.625 secs
quering 1000 times
quering 1000 times -> finished in: 25.508 secs
```

```bash
getting 1000 times
getting 1000 times -> finished in: 2.507 secs
setting 1000 times
setting 1000 times -> finished in: 2.485 secs
quering 1000 times
quering 1000 times -> finished in: 2.072 secs
```
