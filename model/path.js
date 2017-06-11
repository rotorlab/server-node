
function Path(databasePath, database, path) {

    // object reference
    var object = this;

    this.path = path;
    this.database = database;
    this.databasePath = databasePath;
    this.chats = new FlamebaseDatabase(this.database, this.path);
    var config = {};

    /**
     * server API key for firebase cloud messaging
     */
    config.APIKey = function() {
        return "AAAAgVIM4t0:APA91bHz-S5ZvTSJGDcNPePnDGwcpPsnC2QAzHGrZTKu2AkbChb8DTgQJxF3gd7UXcwB4C2DXR5K89v3oc7uwYyONjmRLIfjqaYQFgkWAQyWXZ-D7AmX8sOJUrV5Hjk9eSPKUShQqp9K"; // server key - FCM
    };

    /**
     * all device objects must have token and os info in order
     * to slice big JSON changes for android or ios push notifications
     */
    config.devices = function() {
        var devices = [];
        var keys = Object.keys(object.databasePath.tokens);
        for (var i = 0; i < keys.length; i++) {
            var devic = object.databasePath.tokens[keys[i]];

            var device = {};
            device.token = keys[i];
            device.os = devic.os;

            devices.push(device);
        }
        return devices;
    };

    /**
     * tag that informs android/ios client which action is being called
     */
    config.tag = function() {
        return path + "_sync"; // groupA_sync
    };

    /**
     * custom id for client database (used as primary key)
     */
    config.referenceId = function() {
        return object.path;
    };

    /**
     * custom notification to send when database reference changes.
     * return null if not needed
     */
    config.notification = function() {
        return null;
    };

    this.chats.setSyncConfig(config);


    this.start = function () {

    }

}

module.exports = Path;