var databank = require('databank'),
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

/**
 * Multiplex databank objects
 */
var DatabaseDriver = function() {
    this.databanks = {};
};

/**
 * Connect to or create a new DataBank
 */
DatabaseDriver.prototype.createDB = function(name, driver, schema, callback) {
    var host = process.env.REDISTOGO_URL || 'redis://localhost:6379/';
    var rtg   = require("url").parse(host);
    var params = { 'schema': schema, 'host': rtg.hostname, 'port': rtg.port, 'auth': rtg.auth };

    if(driver == 'disk') params.dir = 'db';

    this.databanks[name] = Databank.get(driver, params);
    this.databanks[name].connect({}, function(err) {
        if(err) {
            console.log('Didn\'t manage to connect to the data source - ' + err);
        } else {
            callback(this.databanks[name]);
        }
    }.bind(this));
};

exports.DatabaseDriver = DatabaseDriver;
