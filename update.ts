import express from "express";
import expressQueue from "express-queue";
import { exec } from "child_process";
import fs from "fs";

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
  dev: boolean;
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
    describe: "path to the config file (assumed to be relative to the parent directory of updateHelper)",
    type: "string",
    default: "update-config.json",
  })
  .option("dev", {
    describe: "Runs using a default development configPath",
    type: "boolean",
    default: false,
  })
  .demandOption(["port", "serverName"]).argv as Options;

if (options.dev) {
  options.configPath = "dev-update-config.json";
}
//path.join("../", options.configPath);

const app = express();
app.use(express.json());
app.use(expressQueue({ activeLimit: 1, queuedLimit: 2 }));

let config: ConfigFile | null = null;
try {
  const configData = fs.readFileSync(options.configPath, "utf8");
  config = JSON.parse(configData);
  // TODO: Confirm that config is the correct format
} catch (error) {
  console.error(`Error loading config file '${options.configPath}'`, error);
  process.exit(1);
}

if (config === null) {
  console.error(`File was in the wrong format '${options.configPath}'`);
  process.exit(2);
}

// Helper function to execute a command in a directory
async function executeCommand (command: string, directory: string): Promise<{stdout: string, stderr: string}> {
  return new Promise((resolve, reject) => {
    //const childProcess =
    exec(
      command,
      { cwd: directory },
      (error, stdout, stderr) => {
        console.log(`Executing command "${command}" in "${directory}"...`);
        if (!error) {
          resolve({ stdout, stderr });
        } else {
          console.error(
            `Error executing command "${command}" in "${directory}":`,
            error
          );
          console.error(`Command "${command}" exited with error.`, error);
          reject(new Error(`Command "${command}" exited with error code=${error.code} msg=${error.message}`));
        }
      }
    );

    // childProcess.on("exit", (code: number) => {
    //   if (code !== 0) {
    //     console.error(`Command "${command}" exited with code ${code}`);
    //     reject(new Error(`Command "${command}" exited with code ${code}`));
    //   }
    // });
  });
};

// Function to process the queue
async function processCommands (commands: Command[]) {
  console.log(`Executing ${commands.length} commands.`)
  for (const { command, directory, failOnText } of commands) {
    const { stdout } = await executeCommand(
      command,
      directory // path.join("../", directory)
    );

    console.log(`OUTPUT: ${stdout}`);

    if (failOnText !== undefined && stdout.includes(failOnText)) {
      console.error(`Extra fail case occurred of '${failOnText}' for command '${command}'`);
      throw new Error(`Extra fail case occurred of '${failOnText}' for command '${command}'`);
    }
  }
};

app.post("/", async (req, res, next) => {
  console.log("Updating!");
  try {
    const { commands } = config as ConfigFile;
    console.log("Got commands", commands);
    try {
      await processCommands(commands);
    } catch (error: any) {
      res.status(500).json({message: "Got unexpected error!", error});
      return;
    }
    res.status(200).json({ message: "Update commands completed successfully" });

    // console.log(`Restarting pm2 instance ${options.serverName}`);
    // const { stdout, stderr } = await executeCommand(
    //   `pm2 restart ${options.serverName}`,
    //   "../"
    // );
    //should be unreachable!
    // console.error(stderr);
  } catch (error: any) {
    console.log("Attempted marked as failing");
    res.status(500).json({ error: error.message });
  }
});

app.listen(options.port, () => {
  console.log(`Server is listening on port ${options.port}`);
});
