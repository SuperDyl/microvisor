# NodeUpdateServer

Some node code to help with updating a project automatically by listening for a post request

## Setup

```bash
npm i
pm2 start ./updateHelper/update.js --name SOME_NAME -- --port PORT --serverName SOME_NAME --config CONFIG_PATH
```

**SOME_NAME**: *OPTIONAL* A name for pm2 to call this service

**PORT**: The port the server listens on (DEFAULT: 3000)

**SOME_NAME**: Must match the name given to pm2

**CONFIG_PATH**: *OPTIONAL* Location of the config file (DEFAULT: ROOT/update-config.json)

Optionally, you can include CONFIG_PATH as the final argument.
It's Path should be from project ROOT

## Root (Server working directory)


## Config file

This server will run the commands given to it in an update-config.json file stored one directory above it
(this is assumed to be the root folder).

Example:

```json
{
  "commands": [
    {
      "command": "git pull",
      "directory": "./",
      "failOnText": "Already up to date."
    },
    {
      "command": "npm install",
      "directory": "back-end"
    },
    {
      "command": "npm install",
      "directory": "front-end"
    },
    {
      "command": "npm run build",
      "directory": "front-end"
    }
  ]
}
```

**command**: the bash to run

**directory**: the directory (from the parent of NodeUpdateServer) to run the script from as the current working directory

**failOnText**: *OPTIONAL*. If present, the stdout is checked for this line and the command treated as failing if it is present.

If any command fails, the server stops there and returns a 500 level error

## TODO

* Add a password to config
* Use typescript
* Simplify code: probably avoid using pm2?
* Include a systemd file as part of regular projects
