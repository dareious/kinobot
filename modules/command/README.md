## Command

Handles the command execution logic for DBot.

### Description

Command flow:

1. Does the input match a command key in the loaded commands?
    * If command not found and quotes is loaded, attempt to print quote of given
      command name
2. Is the user banned from running the given command?
3. Is the user ignoring the command?
4. Is the channel ignoring the command?
5. Does the use have the access level to run the command?
6. Is the command set as disabled?
7. Apply regex to the command, pass into event object.
    * If regex does not apply, show usage info.
8. Run the command.

This is the only module which is force loaded, even if it's not specified in
the configuration file.

### Commands

#### ~usage [command]
Show usage information for a given command.

#### ~help [command|module]
Link module help for a module given either the module name or the name of a
command belonging to a module.

### API

#### isBanned(user, command)
Return whether a user is currently banned from a given commands.

#### hasAccess(user, command)
Return whether a user has the access level (moderator, admin) to run a given
command.

#### isIgnoring(user, command)
Return whether a user is currently marked as ignoring a given command.

#### addHook(command, callback)
This API function allows you to hook functions into DBot commands. For example,
you may add a hook to post on Identica when a new quote is added to the database
with the ~qadd command. As a less useful example, here is how you might add a
hook to log to the console every time someone uses the reload command:

    dbot.api.command.addHook('reload', function() {
        console.log('Reload run!');    
    });

Hook arguments are populated by the return values of the functions they are
hooked into, and command hooks are not run if the command explicitly returns
'false.' For example, the ~qadd command returns *[ key, quote ]*, and the hook
function will be called with these variables given in the order they were
returned, so you would retrieve the key and the quote from a hook to ~qadd like
this:

    dbot.api.command.addHook('~qadd', function(key, quote) { ...

The best place to add hooks to commands is in the 'onLoad' function of your
module, as this ensures it will be run while all other modules are loaded. If
the target command does not exist (for example if its module was not loaded),
the hook will not be added and no errors will be thrown.
