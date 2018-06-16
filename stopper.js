const forever = require('forever-monitor');

if (process.platform === "win32") {
    forever.start([ 'taskkill', '/f', '/im', 'node.exe'], {
        max : 1,
        silent : true
    });
} else {
    forever.start([ 'killall', 'node'], {
        max : 1,
        silent : true
    });
}

