import express from "express";
import expressQueue from "express-queue";
import { ChildProcess, execFile, spawn } from "child_process";

import yargs from "yargs";

type Options = {
  port: number;
  secret: string;
  buildScript: string;
  runScript: string;
  workingDirectory: string;
  dev: boolean;
};

let _options: Options | null = null;

console.log(process.argv);

function getCommandLineOptions(): Options {
  if (_options !== null) {
    return _options;
  }

  const options: Options = yargs(process.argv.slice(2))
    .option("port", {
      alias: "p",
      describe: "The port the server listens on",
      type: "number",
      check: (port: number) => {
        if (port < 1 || port > 65535) {
          throw new Error("Port must be between 1 and 65535");
        }
        return true;
      },
    })
    .option("secret", {
      describe: "Secret value used within requests",
      type: "string",
    })
    .option("buildScript", {
      describe: "Path to the file used for building the software",
      type: "string",
    })
    .option("runScript", {
      describe: "Path to the file used for running the software",
      type: "string",
    })
    .option("dev", {
      describe: "Runs using a default development configPath",
      type: "boolean",
      default: false,
    })
    .option("workingDirectory", {
      alias: "d",
      describe: "Working directory for the scripts to be ran in. Defaults to '../'",
      type: "string",
    })
    .parse() as Options;

  if (options.dev) {
    options.port ??= 3000;
    options.buildScript ??= "dev-build-script.sh";
    options.runScript ??= "dev-run-script.sh";
    options.secret ??= "password123";
    options.workingDirectory ??= "./";
  } else if (!options.buildScript || !options.runScript || !options.secret) {
    throw new Error("Missing one or both of 'buildScript' or 'runScript'. You must provide them if not --dev.");
  }

  options.workingDirectory ??= "../";

  _options = options;
  return _options as Options;
}

const options = getCommandLineOptions();

const app = express();
app.use(express.json());
app.use(expressQueue({ activeLimit: 1, queuedLimit: 2 }));

// Helper function to execute a command in a directory
async function executeCommand(file: string, directory: string): Promise<{ stdout: string, stderr: string }> {
  const adjustedFile = /.?\//.test(file) ? file : `./${file}`;

  return new Promise((resolve, reject) => {
    execFile(
      adjustedFile,
      [],
      { cwd: directory, shell: true },
      (error, stdout, stderr) => {
        console.log(`Executing file "${adjustedFile}" in "${directory}"...`);
        if (!error) {
          resolve({ stdout, stderr });
        } else {
          console.error(
            `Error executing file "${adjustedFile}" in "${directory}":`,
            error
          );
          reject(new Error(`File "${adjustedFile}" exited with error code=${error.code} msg=${error.message}`));
        }
      }
    );
  });
};

async function killProcess(process: ChildProcess) {
  return new Promise<void>((resolve, reject) => {
    process.on('close', () => {
      console.log("The process was stopped!");
      resolve();
    })

    if (process.kill()) {
      console.log("Sent kill signal!");
    } else {
      console.log("Process was already stopped!");
      resolve();
    }
  });
}

let child_process: ChildProcess | null = null;

// Function to process the queue
async function runScripts() {
  console.log(`Executing build script.`);
  const {stdout, stderr} = await executeCommand(options.buildScript, options.workingDirectory);

  if (stdout) {
    console.log(`BUILD OUTPUT:\n${stdout}`);
  }

  if (stderr) {
    console.log(`BUILD ERROR OUTPUT:\n${stderr}`);
  }

  if (child_process) {
    console.log("Found running process, sending the kill signal");
    await killProcess(child_process);
  } else {
    console.log("Process wasn't running, continuing");
  }

  child_process = spawn(
    "bash",
    [options.runScript],
    {
      cwd: options.workingDirectory,
      stdio: 'inherit',
    })
};

type RequestBody = {
  secret?: string;
};

app.post("/", async (req, res, next) => {
  console.log("Got request!");

  const body: RequestBody = req.body;

  if (!body || !body.secret) {
    console.log("Request rejected for missing 'secret' field.");
    res.status(400).json({ message: "Missing required JSON body with 'secret' field." });
    return;
  }

  if (body.secret !== options.secret) {
    console.log("Request rejected for incorrect secret.");
    res.status(403).json({ message: "Secret doesn't match the server secret." });
    return;
  }

  try {
    console.log("Running script!\nRUN OUTPUT:")
    await runScripts();
  }
  catch (error: any) {
    console.log("Error bubbled up", error);
    res.status(500).json({ message: "Got unexpected error!", error });
    return;
  }
  res.status(200).json({ message: "Update commands completed successfully" });
});

app.listen(options.port, () => {
  console.log(`Server is listening on port ${options.port}`);
});
