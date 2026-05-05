# NodeUpdateServer

Some node code to help with updating a project automatically by listening for a post request

## Setup for regular use

Usually, you should add this as a git submodule for your npm project:

`git submodule add git@github.com:SuperDyl/microvisor.git microvisor`

You then need to download any dependencies:

```bash
cd microvisor
npm i
```

Run the project using `npm run serve -- -p <PORT> --buildScript <BUILD_SCRIPT_PATH> --runScript <RUN_SCRIPT_PATH> --secret <SECRET>`. As an example:

```bash
npm run serve -- -p 3029 --buildScript build.sh --runScript run.sh --secret 'SOME_SECRET'
```

By default, the working directory will be just outside the project directory: `../`.
You should include your build and run scripts within your regular project.
These scripts *need* to be executable:

```bash
sudo chmod +x <SCRIPT>
```

## Systemd

You will need to setup some type of cron job or systemd script to cause the project to run at startup.
An example file is provided as `example.service`.
Rename this file, and then move it to `/etc/systemd/system/`.
You will need to adjust the file to fit your service.

Afterwards, change the file to have the correct owner and permissions:

```bash
sudo chown root:root <FILE>
sudo chmod og=r,u=rw <FILE>
```

You then need to reload the configurations in systemd
and enable the new service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable <FILE> --now
```

## Command-line options

* `--port -p <PORT>`: The port number the script listens to.
* `--buildScript <PATH>`: The bash script used for building the project on updates.
* `--runScript <PATH>`: The bash script used for running the project on restart.
* `--workingDirectory -d <PATH>`: The directory the scripts are relative to. Defaults to `./`.
* `--dev`: Sets up the project in development mode. This adds default values for most config options.

## Development

When using the `--dev` flag, development defaults are provided to the program.
This flag is supplied if you use `npm run develop`.
It will give default values of:

* Port: `3000`
* buildScript: `dev-build-script.sh`
* runScript: `dev-run-script.sh`
* workingDirectory: `./`

Any of these can be overridden with the flags,
though using npm you will need to provide `--` twice:

```bash
npm run develop -- -p 4000
```

With the default configuration,
you can use the following command to test it:

```bash
curl -X POST -H 'Content-Type: application/json' http://localhost:3000 -d '{"secret": "password123"}'
```

## TODO

* Simplify code: probably avoid using pm2?
* Include a systemd file as part of regular projects
