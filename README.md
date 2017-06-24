# flamebase-database-server
Main server to hold a realtime database

Create a server cluster to hold all realtime changes.

```javascript
var FlamebaseDatabaseCluster = require('flamebase-database-server-cluster');

var FSC = new FlamebaseDatabaseCluster("draco", 1507);
FSC.initCluster({
    start: function () {
        console.log("start!!")
    }
}, null);
```


#### Long life listener for token

Returns JSON differences every time path's object changes.
```json
{
    "method": "long_life_listener",
    "path":   ".varA",
    "token":  "jhdfskdjfgSDFgdFfFdfgDFgasfdGsdfbf",
    "os":     "android"
}
```

#### Simple listener for token

Returns JSON differences only once and dies.
```json
{
    "method": "simple_listener",
    "path":   ".varA",
    "token":  "jhdfskdjfgSDFgdFfFdfgDFgasfdGsdfbf",
    "os":     "android"
}
```

#### Update data

Updates data.
```json
{
    "method": "update_data",
    "path":   ".varA.varB",
    "differences":  {
        "$set": {
            "varC": {},
            "varC.varD": "hello",
            "varC.varDA":"world"
        },
        "$unset": {
            "varD": true
        }
    }
}
```
_____

#### Responses

`missing_params` Some param is missing in the request.

`listener_not_found` No listeners were found for the given path. Create new one.

`no_diff_updated` No differences were found in the request.

`json_path_not_found` Path is missing in the request.

`data_updated`

`listener_already_added`

`listener_added`
