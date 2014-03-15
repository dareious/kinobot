var fs = require('fs'),
    _ = require('underscore')._,
    jsbot = require('./jsbot/jsbot'),
    DatabaseDriver = require('./database').DatabaseDriver;
require('./snippets');

var DBot = function() {
    
    /*** Load the DB ***/

    if(fs.existsSync('db.json')) {
        try {
            this.db = JSON.parse(fs.readFileSync('db.json', 'utf-8'));
        } catch(err) {
            console.log('Error loading db.json. Stopping: ' + err);
            process.exit();
        }
    } else {
        this.db = {};
    }

    if(!_.has(this.db, 'config')) {
        this.db.config = {};
    }

    /*** Load the fancy DB ***/
    this.ddb = new DatabaseDriver();

    /*** Load the Config ***/

    if(!fs.existsSync('config.json')) {
        console.log('Error: config.json file does not exist. Stopping');
        process.exit();
    }
    
    this.config = _.clone(this.db.config);
    try {
        _.defaults(this.config, JSON.parse(fs.readFileSync('config.json', 'utf-8')));
    } catch(err) {
        console.log('Config file is invalid. Stopping: ' + err);
        process.exit();
    }

    try {
        var defaultConfig = JSON.parse(fs.readFileSync('config.json.sample', 'utf-8'));
    } catch(err) {
        console.log('Error loading sample config. Bugger off this should not even be edited. Stopping.');
        process.exit();
    }

    // Load missing config directives from sample file
    _.defaults(this.config, defaultConfig);

    /*** Load main strings ***/

    try {
        this.strings = JSON.parse(fs.readFileSync('strings.json', 'utf-8'));
    } catch(err) {
        console.log('Probably a syntax error in strings.json: ' + err);
        this.strings = {};
    }

    // Initialise run-time resources
    this.usage = {};
    this.status = {};
    this.sessionData = {};

    // Populate bot properties with config data
    // Create JSBot and connect to each server
    this.instance = jsbot.createJSBot(this.config.name);
    _.each(this.config.servers, function(server, name) {
         this.instance.addConnection(name, server.server, server.port,
                this.config.admin, function(event) {
            var server = this.config.servers[event.server];
            for(var i=0;i<server.channels.length;i++) {
                this.instance.join(event, server.channels[i]);
            }
        }.bind(this), server.nickserv, server.password);        
    }, this);

    // Load the modules and connect to the server
    this.reloadModules();
    this.instance.connectAll();
};

// Say something in a channel
DBot.prototype.say = function(server, channel, message) {
    this.instance.say(server, channel, message);
};

// Format given stored string in config language
DBot.prototype.t = function(string, formatData) {
    var formattedString = 'String not found. Something has gone screwy. Maybe.';
    
    if(_.has(this.strings, string)) {
        var lang = this.config.language;
        if(!_.has(this.strings[string], lang)) {
            lang = "en"; 
        }

        if(_.has(this.strings[string], lang)) {
            formattedString = this.strings[string][lang].format(formatData);
        }
    }
    
    return formattedString;
};

/*DBot.prototype.act = function(channel, data) {
    this.instance.send('PRIVMSG', channel, ':\001ACTION ' + data + '\001');
}*/

// Save the database file
DBot.prototype.save = function() {
    fs.writeFileSync('db.json', JSON.stringify(this.db, null, '    '));
};

// Hot-reload module files.
DBot.prototype.reloadModules = function() {
    if(this.modules) { // Run 'onDestroy' code for each module if it exists.
        _.each(this.modules, function(module) {
            if(module.onDestroy) {
                module.onDestroy();
            }
        });
    }

    this.rawModules = [];
    this.pages = {};
    this.status = {};
    this.modules = {};
    this.commands = {};
    this.api = {};
    this.usage = {};
    
    try {
        this.strings = JSON.parse(fs.readFileSync('strings.json', 'utf-8'));
    } catch(err) {
        this.strings = {};
    }

    var moduleNames = this.config.moduleNames;

    // Enforce having command. it can still be reloaded, but dbot _will not_ 
    //  function without it, so not having it should be impossible
    if(!moduleNames.include("command")) {
        moduleNames.push("command");
    }

    // Reload Javascript snippets
    var path = require.resolve('./snippets');
    delete require.cache[path];
    require('./snippets');

    this.instance.removeListeners();

    var name, moduleDir, config;
    for(i=0;i<moduleNames.length;i++) {
        name = moduleNames[i];
        this.status[name] = true;
        moduleDir = './modules/' + name + '/';
        try {
            var cacheKey = require.resolve(moduleDir + name);
            delete require.cache[cacheKey];
        } catch(err) {
            this.status[name] = 'Error loading module: ' + err + ' ' + err.stack.split('\n')[2].trim();
            continue;
        }

        // Load the module config data
        config = {};
        
        if(_.has(this.db.config, name)) {
            config = _.clone(this.db.config[name]); 
        }

        try {
            var defaultConfig = fs.readFileSync(moduleDir + 'config.json', 'utf-8');
            try {
                defaultConfig = JSON.parse(defaultConfig);
            } catch(err) { // syntax error
                this.status[name] = 'Error parsing config: ' + err + ' ' + err.stack.split('\n')[2].trim();
                return;
            }
            config = _.defaults(config, defaultConfig);
        } catch(err) {
            // Invalid or no config data
        }

        // Don't shit out if dependencies not met
        if(_.has(config, 'dependencies')) {
            _.each(config.dependencies, function(dependency) {
                if(!_.include(moduleNames, dependency)) {
                    console.log('Warning: Automatically loading ' + dependency);
                    moduleNames.push(dependency);
                }
            }, this);
        }
        this.config[name] = config;

        // Groovy funky database shit
        if(!_.has(config, 'dbType') || config.dbType == 'olde') {
            // Generate missing DB keys
            _.each(config.dbKeys, function(dbKey) {
                if(!_.has(this.db, dbKey)) {
                    this.db[dbKey] = {};
                }
            }, this);
        } else {
            // Just use the name of the module for now, add dbKey iteration later
            this.ddb.createDB(name, config.dbType, {}, function(db) {});
        }
    }

    process.nextTick(function() {
        _.each(moduleNames, function(name) {
            try {
                var moduleDir = './modules/' + name + '/';
                var rawModule = require(moduleDir + name);
                var module = rawModule.fetch(this);
                this.rawModules.push(rawModule);
            } catch(err) {
                var stack = err.stack.split('\n')[2].trim();
                this.status[name] = 'Error loading module: ' + err + ' ' + stack;
                console.log('Error loading module: ' + err + ' ' + stack);
                return;
            }

            module.name = name;
            module.db = this.ddb.databanks[name];
            module.config = this.config[name];

            // Load the module data
            _.each([ 'commands', 'pages', 'api' ], function(property) {
                var propertyObj = {};

                if(fs.existsSync(moduleDir + property + '.js')) {
                    try {
                        var propertyKey = require.resolve(moduleDir + property);
                        if(propertyKey) delete require.cache[propertyKey];
                        propertyObj = require(moduleDir + property).fetch(this);
                    } catch(err) {
                        this.status[name] = 'Error loading ' + propertyKey + 
                            ': ' + err + ' - ' + err.stack.split('\n')[1].trim();
                        console.log('Module error (' + module.name + ') in ' + 
                            property + ': ' + err);
                    } 
                }

                if(!_.has(module, property)) module[property] = {};
                _.extend(module[property], propertyObj);
                _.each(module[property], function(item, itemName) {
                    item.module = name; 
                    if(_.has(module.config, property) && _.has(module.config[property], itemName)) {
                        _.extend(item, module.config[property][itemName]);
                    }
                    module[property][itemName] = _.bind(item, module);
                    _.extend(module[property][itemName], item);
                }, this);

                if(property == 'api') {
                    this[property][name] = module[property];
                } else {
                    _.extend(this[property], module[property]);
                }
            }, this);

            // Load the module listener
            if(module.listener) {
                if(!_.isArray(module.on)) {
                    module.on = [ module.on ];
                }
                _.each(module.on, function(on) {
                    this.instance.addListener(on, module.name, module.listener);
                }, this);
            }

            // Load string data for the module
            _.each([ 'usage', 'strings' ], function(property) {
                var propertyData = {};
                try {
                    propertyData = JSON.parse(fs.readFileSync(moduleDir + property + '.json', 'utf-8'));
                } catch(err) {};
                _.extend(this[property], propertyData);
            }, this);

            // Provide toString for module name
            module.toString = function() {
                return this.name;
            }

            this.modules[module.name] = module;
        }.bind(this));
    }.bind(this));

    process.nextTick(function() {
        if(_.has(this.modules, 'web')) this.modules.web.reloadPages();
        _.each(this.modules, function(module, name) {
            if(module.onLoad) {
                try {
                    module.onLoad();
                } catch(err) {
                    this.status[name] = 'Error in onLoad: ' + err + ' ' + err.stack.split('\n')[1].trim();
                    console.log('MODULE ONLOAD ERROR (' + name + '): ' + err );
                }
            }
        }, this);
    }.bind(this));

    this.save();
};

new DBot();
