# Turbine
Turbine is a handler for JSON databases. Works as a service receiving requests and returning, storing or querying data as quick as possible.

### Why Turbine?
The reason of built Turbine is I have multiple clusters working with the same data. For them it isn't an effort to read from a JSON database and work with data. The problem appears when those clusters **tries** to store data on database at the same time.

Multiple process working with the same file can produce writing errors. Imagine the consequences.

### What is Turbine
Turbine is a single process that manages a JSON database for you. It avoids fatal errors at runtime managing data so quickly. It has been designed for Rotor framework but can be used as a query engine.