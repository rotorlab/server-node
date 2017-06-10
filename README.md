# flamebase-database-server
Main server to hold a realtime database

Create a server cluster to hold all realtime changes.

```javascript
var FlamebaseDatabaseCluster = require('flamebase-database-server-cluster');

var FSC = new FlamebaseDatabaseCluster(null);
FSC.start(null, null);
```

