var _ = require('underscore')._;

var api = function(dbot) {
    return {
        /**
         * Does the user have the correct access level to use the command?
         */
        'hasAccess': function(server, user, command, callback) {
            var accessNeeded = dbot.commands[command].access;

            if(accessNeeded == 'admin' || accessNeeded == 'moderator') {
                var allowedNicks = dbot.config.admins;
                if(accessNeeded == 'moderator') allowedNicks = _.union(allowedNicks, dbot.config.moderators); 

                if(!_.include(allowedNicks, user)) {
                    callback(false);
                } else {
                    if(_.has(dbot.modules, 'nickserv') && this.config.useNickserv == true) {
                        dbot.api.nickserv.auth(server, user, function(result) {
                            callback(result);
                        });
                    } else {
                        callback(true);
                    }
                }
            } else {
                callback(true);
            }
        },

        /**
         * Apply Regex to event message, store result. Return false if it doesn't
         * apply.
         */
        'applyRegex': function(commandName, event) {
            var applies = false;
            if(_.has(dbot.commands[commandName], 'regex')) {
                var cRegex = dbot.commands[commandName].regex;
                if(_.isArray(cRegex) && cRegex.length == 2) {
                    var q = event.message.valMatch(cRegex[0], cRegex[1]);
                    if(q) {
                        applies = true;
                        event.input = q;
                    }
                } else {
                    var q = event.message.match(cRegex);
                    if(q) {
                        applies = true;
                        event.input = q;
                    }
                }
            } else {
                applies = true;
            }
            return applies;
        },

        'addHook': function(command, callback) {
            console.log('adding hook');
            if(_.has(dbot.commands, command)) {
                if(!_.has(dbot.commands[command], 'hooks')) {
                    dbot.commands[command].hooks = [];
                }
                dbot.commands[command].hooks.push(callback);
            }
        }
    };
};

exports.fetch = function(dbot) {
    return api(dbot);
};
