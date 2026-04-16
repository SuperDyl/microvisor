import express, { Response } from "express";
import expressQueue from "express-queue";
import { exec } from "child_process";
import fs from "fs";
import path from "path";

import yargs from "yargs";

type Command = {
  command: string;
  directory: string;
  failOnText?: string;
};

type ConfigFile = {
  commands: Command[];
};

type Options = {
  port: number;
  serverName: string;
  configPath: string;
};

const options: Options = yargs
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
  .option("serverName", {
    alias: "l",
    describe: "A name used in logs to represent this service",
    type: "string",
  })
  .option("configPath", {
    alias: "c",
    describe:
      "path to the config file (assumed to be relative to the parent directory of updateHelper)",
    type: "string",
    default: "update-config.json",
  })
  .demandOption(["port", "serverName"]).argv as Options;

const port = options.port;
const serverName = options.serverName;
const configFilePath = options.configPath; //path.join("../", options.configPath);

const app = express();
app.use(express.json());
app.use(expressQueue({ activeLimit: 1, queuedLimit: 2 }));

let config: ConfigFile | null = null;
try {
  const configData = fs.readFileSync(configFilePath, "utf8");
  config = JSON.parse(configData);
  // TODO: Confirm that config is the correct format
} catch (error) {
  console.error(`Error loading config file '${configFilePath}'`, error);
  process.exit(1);
}

if (config === null) {
  console.error(`File was in the wrong format '${configFilePath}'`);
  process.exit(2);
}

// Helper function to execute a command in a directory
async function executeCommand (command: string, directory: string): Promise<{stdout: string, stderr: string}> {
  return new Promise((resolve, reject) => {
    const childProcess = exec(
      command,
      { cwd: directory },
      (error, stdout, stderr) => {
        console.log(`Executing command "${command}" in "${directory}"...`);
        if (!error) {
          resolve({ stdout, stderr });
          return;
        }
        //else
        console.error(
          `Error executing command "${command}" in "${directory}":`,
          error
        );
        reject(error);
      }
    );

    childProcess.on("exit", (code: number) => {
      if (code !== 0) {
        console.error(`Command "${command}" exited with code ${code}`);
        reject(new Error(`Command "${command}" exited with code ${code}`));
      }
    });
  });
};

// Function to process the queue
async function processCommands (commands: Command[]) {
  for (const { command, directory, failOnText } of commands) {
    const { stdout } = await executeCommand(
      command,
      directory // path.join("../", directory)
    );

    console.log(stdout);

    if (failOnText !== undefined && stdout.includes(failOnText)) {
      console.error(`Extra fail case occurred of '${failOnText}' for command '${command}'`);
      throw new Error(`Extra fail case occurred of '${failOnText}' for command '${command}'`);
    }
  }
};

app.post("/", async (req, res, next) => {
  try {
    const { commands } = config as ConfigFile;
    try {
      await processCommands(commands);
    } catch (error: any) {
      res.status(500).json({message: "Got unexpected error!", error});
    }
    res.status(200).json({ message: "Update commands completed successfully" });

    console.log(`Restarting pm2 instance ${serverName}`);
    const { stdout, stderr } = await executeCommand(
      `pm2 restart ${serverName}`,
      "../"
    );
    //should be unreachable!
    console.error(stderr);
  } catch (error: any) {
    console.log("Attempted marked as failing");
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
