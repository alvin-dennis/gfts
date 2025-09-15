import fs from "fs/promises";
import inquirer from "inquirer";
import chalk from "chalk";
import { CONFIG_DIR, ENV_FILE } from "./paths";

export async function getApiKey(): Promise<string> {
  let apiKey = process.env.GOOGLE_API_KEY;
  if (apiKey) {
    return apiKey;
  }

  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    const envContent = await fs.readFile(ENV_FILE, "utf-8").catch(() => "");
    const match = envContent.match(/GOOGLE_API_KEY="(.+)"/);
    if (match?.[1]) {
      return match[1];
    }
  } catch (error) {
    console.log(chalk.yellow("No API key found in config file"));
  }

  return setupApiKey();
}

export async function setupApiKey(): Promise<string> {
  const answers = await inquirer.prompt([
    {
      type: "password",
      name: "apiKey",
      message: "Please enter your Google API key",
      mask: "*",
      validate: (input) => input.length > 0 || "API key cannot be empty",
    },
    {
      type: "confirm",
      name: "saveKey",
      message: `Save this key to ${ENV_FILE}?`,
      default: true,
    },
  ]);

  if (answers.saveKey) {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.writeFile(
      ENV_FILE,
      `GOOGLE_API_KEY="${answers.apiKey}"\n`,
      "utf-8"
    );
    console.log(chalk.green("✓ API key saved."));
  }

  return answers.apiKey;
}

