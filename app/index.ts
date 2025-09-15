#! /usr/bin/env bun

import path from "path";
import os from "os";
import fs from "fs/promises";
import inquirer from "inquirer";
import chalk from "chalk";
import { Command } from "commander";
import { execSync } from "child_process";
import { Client as MCPClient } from "@modelcontextprotocol/sdk/client/index.js";
import gftsserver from "./src/server";
import { GoogleGenAI } from "@google/genai";

const cli = new Command();
const CONFIG_DIR = path.join(os.homedir(), ".config", "git-flash");
const ENV_FILE = path.join(CONFIG_DIR, ".env");

// --- API Key Handling ---
async function getApiKey(): Promise<string> {
  let apiKey = process.env.GOOGLE_API_KEY;
  if (apiKey) return apiKey;

  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    const envContent = await fs.readFile(ENV_FILE, "utf-8").catch(() => "");
    const match = envContent.match(/GOOGLE_API_KEY="(.+)"/);
    if (match?.[1]) return match[1];
  } catch {}

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

  apiKey = answers.apiKey;
  if (answers.saveKey) {
    await fs.writeFile(ENV_FILE, `GOOGLE_API_KEY="${apiKey}"\n`, "utf-8");
    console.log(chalk.green("✓ API key saved."));
  }

  if (!apiKey) {
    throw new Error("Failed to get API key");
  }
  return apiKey;
}

// --- Generative AI + MCP Flow ---
async function runGenerativeGitFlow(instruction: string, dryRun = false) {
  console.log(chalk.cyanBright(`▶️ User Goal: ${instruction}`));

  const apiKey = await getApiKey();
  const genai = new GoogleGenAI({ apiKey });

  const initialPrompt = `You are Git Flash, an AI assistant for git and file system operations.
Operating in directory: ${process.cwd()}.
User's goal: ${instruction}`;

  const model = genai.models;
  let response = await model.generateContent({
    model: "gemini-2.0-flash",
    contents: [
      {
        role: "user",
        parts: [{ text: initialPrompt }],
      },
    ],
  });

  if (!response?.candidates?.[0]?.content?.parts) {
    throw new Error("Failed to generate valid content");
  }

  // --- Connect to MCP TS SDK client ---
  const client = new MCPClient({
    server: gftsserver,
    name: "git-flash",
    version: "1.0.0",
  });
  await client.connect({
    send: async (msg) => {
      /* No-op for now */
    },
    onmessage: () => {
      /* No-op for now */
    },
    start: async () => {
      /* No-op for now */
    },
    close: async () => {
      /* No-op for now */
    },
  });

  while (response?.candidates?.[0]?.content?.parts?.[0]?.functionCall) {
    const funcCall = response.candidates[0].content.parts[0].functionCall;
    const toolName = funcCall.name;
    const toolArgs = { ...funcCall.args, working_directory: process.cwd() };

    console.log(
      chalk.yellowBright(
        `🤖 Agent wants to run: ${toolName}(${JSON.stringify(toolArgs)})`
      )
    );

    let toolOutput: any;
    if (dryRun) {
      console.log(chalk.magenta("-- DRY RUN: Skipping command --"));
      toolOutput = "Dry run mode, command not executed.";
    } else {
      if (!toolName) {
        throw new Error("Invalid tool name");
      }
      const result = await client.callTool({
        name: toolName,
        arguments: toolArgs,
      });
      toolOutput =
        typeof result === "object" && result !== null
          ? JSON.stringify(result)
          : "Tool returned no output";
    }

    console.log(chalk.gray(`Result:\n${toolOutput}`));

    response = await genai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          parts: [{ text: initialPrompt }],
          role: "user",
        },
      ],
    });
  }

  console.log(chalk.greenBright(`✅ Final Response:\n${response.text}`));
}

// --- Manual / Auto Commit ---
async function runManualCommit(commitMessage: string, dryRun = false) {
  console.log(chalk.greenBright(`Commit Message:\n${commitMessage}`));

  if (dryRun) {
    console.log(
      chalk.magenta(
        "-- DRY RUN: Staging changes but not committing or pushing --"
      )
    );
    execSync("git add .", { cwd: process.cwd() });
    return;
  }

  try {
    execSync("git add .", { cwd: process.cwd() });
    execSync(`git commit -m "${commitMessage}"`, { cwd: process.cwd() });
    console.log(chalk.green("✓ Commit successful."));

    const currentBranch = execSync("git branch --show-current", {
      encoding: "utf-8",
      cwd: process.cwd(),
    }).trim();
    console.log(`Pushing to origin/${currentBranch}...`);
    execSync(`git push origin ${currentBranch}`, { cwd: process.cwd() });
    console.log(chalk.green("✓ Push successful."));
  } catch (e: any) {
    console.error(chalk.red(`Error during git operation:\n${e.message}`));
  }
}

async function runAutoCommit(dryRun = false) {
  execSync("git add .", { cwd: process.cwd() });
  const diff = execSync("git diff --staged", {
    encoding: "utf-8",
    cwd: process.cwd(),
  });
  if (!diff.trim()) return console.log("No staged changes to commit.");

  const apiKey = await getApiKey();
  const genai = new GoogleGenAI({ apiKey });

  const prompt = `Based on the following git diff, generate a concise commit message following Conventional Commits:\n\n${diff}`;
  const response = await genai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [
      {
        parts: [{ text: prompt }],
        role: "user",
      },
    ],
  });
  if (!response?.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error("Failed to generate commit message");
  }
  const commitMessage = response.candidates[0].content.parts[0].text
    .replace(/^```|```$/g, "")
    .trim();
  await runManualCommit(commitMessage, dryRun);
}

// --- CLI ---
cli
  .name("git-flash")
  .description(
    "AI assistant for git and file system operations using Google GenAI + MCP TS SDK"
  )
  .option("-m, --message <msg>", "Specific commit message")
  .option("--dry-run", "Simulate actions without making changes", false)
  .argument("[instruction]", "Natural language instruction for the git agent")
  .action(async (instruction: string | undefined, options) => {
    if (instruction) {
      await runGenerativeGitFlow(instruction, options.dryRun);
    } else if (options.message) {
      await runManualCommit(options.message, options.dryRun);
    } else {
      await runAutoCommit(options.dryRun);
    }
  });

cli.parse(process.argv);
