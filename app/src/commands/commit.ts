import { execSync } from "child_process";
import chalk from "chalk";
import ora from "ora";
import { GoogleGenAI } from "@google/genai";
import { getApiKey } from "../config/api";
import { EMOJI, formatError, printDivider } from "./utils";

export async function runManualCommit(
  commitMessage: string,
  dryRun = false,
  skipPush = false
) {
  if (!commitMessage || typeof commitMessage !== "string") {
    throw new Error("Commit message is required and must be a string");
  }

  printDivider();
  console.log(chalk.bold.cyan(`${EMOJI.COMMIT} Commit Details`));
  console.log(chalk.greenBright(`Message: ${commitMessage}`));
  printDivider();

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

    printDivider();
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
  printDivider();
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
