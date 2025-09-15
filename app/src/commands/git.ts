import { execSync } from "child_process";
import chalk from "chalk";
import { GoogleGenAI } from "@google/genai";
import { getApiKey } from "../config/api";
import mcpClient from "../mcp/client";

export async function runManualCommit(commitMessage: string, dryRun = false) {
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

export async function runAutoCommit(dryRun = false) {
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

export async function runGenerativeGitFlow(instruction: string, dryRun = false) {
  console.log(chalk.cyanBright(`▶️ User Goal: ${instruction}`));

  const apiKey = await getApiKey();
  const genai = new GoogleGenAI({ apiKey });

  const initialPrompt = `You are Git Flash, an AI assistant for git and file system operations.
Operating in directory: ${process.cwd()}.
User's goal: ${instruction}`;

  let response = await genai.models.generateContent({
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

  // Initialize MCP client
  await mcpClient.initializeClient(process.cwd());

  try {
    while (response?.candidates?.[0]?.content?.parts?.[0]?.functionCall) {
    const funcCall = response.candidates[0].content.parts[0].functionCall;
    if (!funcCall?.name) {
      throw new Error("Invalid function call from model");
    }

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
        try {
          toolOutput = await mcpClient.executeTool(toolName, toolArgs);
          toolOutput = typeof toolOutput === "object" && toolOutput !== null
            ? JSON.stringify(toolOutput)
            : String(toolOutput);
        } catch (error) {
          console.error(chalk.red("Tool execution error:"), error);
          toolOutput = `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
        }
      }    console.log(chalk.gray(`Result:\n${toolOutput}`));

    response = await genai.models.generateContent({
      model: "gemini-pro",
      contents: [
        {
          parts: [{ text: initialPrompt }],
          role: "user",
        },
      ],
    });
  }

    console.log(chalk.greenBright(`✅ Final Response:\n${response.text}`));
  } finally {
    // Always close the client when done
    await mcpClient.closeClient();
  }
}