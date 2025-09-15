import { execSync } from "child_process";
import chalk from "chalk";
import ora from "ora";
import { GoogleGenAI } from "@google/genai";
import { getApiKey } from "../config/api";
import mcpClient from "../mcp/client";
import { getToolDefinitions } from "../tools/declarations";

const EMOJI = {
  COMMIT: "📝",
  PUSH: "🚀",
  SUCCESS: "✓",
  ERROR: "❌",
  THINKING: "🤔",
  ROBOT: "🤖",
  CONFIG: "⚙️",
};

const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

export async function runManualCommit(
  commitMessage: string,
  dryRun = false,
  skipPush = false
) {
  if (!commitMessage || typeof commitMessage !== "string") {
    throw new Error("Commit message is required and must be a string");
  }

  console.log(chalk.dim("─".repeat(process.stdout.columns || 80)));
  console.log(chalk.bold.cyan(`${EMOJI.COMMIT} Commit Details`));
  console.log(chalk.greenBright(`Message: ${commitMessage}`));
  console.log(chalk.dim("─".repeat(process.stdout.columns || 80)));

  if (dryRun) {
    const dryRunSpinner = ora({
      text: chalk.magenta("Simulating git operations (dry run)"),
      color: "yellow",
    }).start();

    try {
      execSync("git add .", { cwd: process.cwd() });
      dryRunSpinner.succeed(
        chalk.magenta("Dry run completed - no changes were committed")
      );
    } catch (error) {
      dryRunSpinner.fail(chalk.red(`Dry run failed: ${formatError(error)}`));
      throw error;
    }
    return;
  }

  const stageSpinner = ora({
    text: "Staging changes",
    color: "blue",
  }).start();

  try {
    execSync("git add .", { cwd: process.cwd() });
    stageSpinner.succeed(
      chalk.green(`${EMOJI.SUCCESS} Changes staged successfully`)
    );

    const commitSpinner = ora({
      text: "Creating commit",
      color: "blue",
    }).start();

    execSync(`git commit -m "${commitMessage}"`, { cwd: process.cwd() });
    commitSpinner.succeed(
      chalk.green(`${EMOJI.SUCCESS} Commit created successfully`)
    );

    if (!skipPush) {
      const currentBranch = execSync("git branch --show-current", {
        encoding: "utf-8",
        cwd: process.cwd(),
      }).trim();

      const pushSpinner = ora({
        text: `Pushing to origin/${currentBranch}`,
        color: "blue",
      }).start();

      execSync(`git push origin ${currentBranch}`, { cwd: process.cwd() });
      pushSpinner.succeed(
        chalk.green(
          `${EMOJI.SUCCESS} Changes pushed to origin/${currentBranch}`
        )
      );
    }

    console.log(chalk.dim("─".repeat(process.stdout.columns || 80)));
    console.log(chalk.bold.green("All operations completed successfully! 🎉"));
  } catch (error) {
    const errorMessage = formatError(error);
    console.error(chalk.red(`\n${EMOJI.ERROR} Git operation failed:`));
    console.error(chalk.red(errorMessage));

    if (errorMessage.includes("not a git repository")) {
      console.log(
        chalk.yellow("\nSuggestion: Initialize a git repository first:")
      );
      console.log(chalk.cyan("  git init"));
    } else if (errorMessage.includes("remote origin already exists")) {
      console.log(chalk.yellow("\nSuggestion: Update your remote origin:"));
      console.log(chalk.cyan("  git remote set-url origin <repository-url>"));
    }

    throw error;
  }
}

export async function runAutoCommit(dryRun = false, skipPush = false) {
  console.log(chalk.dim("─".repeat(process.stdout.columns || 80)));
  console.log(chalk.bold.cyan(`${EMOJI.ROBOT} Auto-Commit`));

  const stageSpinner = ora({
    text: "Checking for changes",
    color: "blue",
  }).start();

  try {
    execSync("git add .", { cwd: process.cwd() });
    const diff = execSync("git diff --staged", {
      encoding: "utf-8",
      cwd: process.cwd(),
    });

    if (!diff.trim()) {
      stageSpinner.info(chalk.yellow("No changes to commit"));
      return;
    }

    stageSpinner.succeed(chalk.green(`${EMOJI.SUCCESS} Changes detected`));

    const genSpinner = ora({
      text: `${EMOJI.THINKING} Analyzing changes and generating commit message`,
      color: "blue",
    }).start();

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
      genSpinner.fail(chalk.red("Failed to generate commit message"));
      throw new Error("Failed to generate commit message");
    }

    const commitMessage = response.candidates[0].content.parts[0].text
      .replace(/^```|```$/g, "")
      .trim();

    genSpinner.succeed(
      chalk.green(`${EMOJI.SUCCESS} Commit message generated`)
    );

    await runManualCommit(commitMessage, dryRun, skipPush);
  } catch (error) {
    const errorMessage = formatError(error);
    console.error(chalk.red(`\n${EMOJI.ERROR} Auto-commit failed:`));
    console.error(chalk.red(errorMessage));
    throw error;
  }
}

export async function runGenerativeGitFlow(
  instruction: string,
  dryRun = false
) {
  console.log(chalk.dim("─".repeat(process.stdout.columns || 80)));
  console.log(chalk.bold.cyan(`${EMOJI.ROBOT} AI Assistant`));
  console.log(chalk.greenBright(`Goal: ${instruction}`));
  console.log(chalk.dim("─".repeat(process.stdout.columns || 80)));

  const initSpinner = ora({
    text: `${EMOJI.THINKING} Initializing AI assistant`,
    color: "blue",
  }).start();

  try {
    const apiKey = await getApiKey();
    const genai = new GoogleGenAI({ apiKey });

    const initialPrompt = `You are Git Flash, an AI assistant for git and file system operations.
Operating in directory: ${process.cwd()}.
User's goal: ${instruction}`;

    const tools = getToolDefinitions();

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
      initSpinner.fail(chalk.red("Failed to initialize AI assistant"));
      throw new Error("Failed to generate valid content");
    }

    initSpinner.succeed(chalk.green(`${EMOJI.SUCCESS} AI assistant ready`));

    await mcpClient.initializeClient(process.cwd());
    console.log(chalk.dim("─".repeat(process.stdout.columns || 80)));

    try {
      while (response?.candidates?.[0]?.content?.parts?.[0]?.functionCall) {
        const funcCall = response.candidates[0].content.parts[0].functionCall;
        if (!funcCall?.name) {
          throw new Error("Invalid function call from model");
        }

        const toolName = funcCall.name;
        const toolArgs = { ...funcCall.args, working_directory: process.cwd() };

        const actionSpinner = ora({
          text: chalk.cyan(`${EMOJI.ROBOT} Planning action: ${toolName}`),
          color: "blue",
        }).start();

        console.log(chalk.dim(JSON.stringify(toolArgs, null, 2)));

        let toolOutput: any;
        if (dryRun) {
          actionSpinner.warn(chalk.magenta("Dry run - skipping execution"));
          toolOutput = "Dry run mode, command not executed.";
        } else {
          try {
            toolOutput = await mcpClient.executeTool(toolName, toolArgs);
            toolOutput =
              typeof toolOutput === "object" && toolOutput !== null
                ? JSON.stringify(toolOutput, null, 2)
                : String(toolOutput);
            actionSpinner.succeed(
              chalk.green(`${EMOJI.SUCCESS} Action completed`)
            );
          } catch (error) {
            actionSpinner.fail(chalk.red(`${EMOJI.ERROR} Action failed`));
            console.error(chalk.red(formatError(error)));
            toolOutput = `Error: ${formatError(error)}`;
          }
        }

        if (toolOutput) {
          console.log(chalk.dim("Output:"));
          console.log(chalk.gray(toolOutput));
          console.log(chalk.dim("─".repeat(process.stdout.columns || 80)));
        }

        const thinkSpinner = ora({
          text: `${EMOJI.THINKING} Processing result`,
          color: "blue",
        }).start();

        response = await genai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: [
            {
              parts: [{ text: initialPrompt }],
              role: "user",
            },
          ],
        });

        thinkSpinner.succeed(chalk.green(`${EMOJI.SUCCESS} Next action ready`));
      }

      console.log(chalk.dim("─".repeat(process.stdout.columns || 80)));
      console.log(chalk.bold.green("🎉 Task completed!"));
      if (response.text) {
        console.log(chalk.cyan("\nFinal Response:"));
        console.log(chalk.white(response.text));
      }
    } finally {
      await mcpClient.closeClient();
    }
  } catch (error) {
    console.error(chalk.red(`\n${EMOJI.ERROR} Operation failed:`));
    console.error(chalk.red(formatError(error)));
    throw error;
  }
}
