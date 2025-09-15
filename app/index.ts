#! /usr/bin/env bun

import { Command } from "commander";
import chalk from "chalk";
import { setupApiKey } from "./src/config/api";
import {
  runGenerativeGitFlow,
  runManualCommit,
  runAutoCommit,
} from "./src/commands/git";

const cli = new Command();

cli
  .name("gfts")
  .description(
    "AI assistant for git and file system operations using Google GenAI + MCP TS SDK"
  )
  .option("-m, --message <msg>", "Specific commit message")
  .option("--dry-run", "Simulate actions without making changes", false)
  .option("--setup", "Configure API key and settings")
  .argument("[instruction]", "Natural language instruction for the git agent")
  .action(async (instruction: string | undefined, options) => {
    try {
      if (options.setup) {
        await setupApiKey();
        return;
      }

      if (instruction) {
        await runGenerativeGitFlow(instruction, options.dryRun);
      } else if (options.message) {
        await runManualCommit(options.message, options.dryRun);
      } else {
        await runAutoCommit(options.dryRun);
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("API key not found")
      ) {
        console.log(chalk.yellow("No API key found. Running setup..."));
        await setupApiKey();
        if (instruction) {
          await runGenerativeGitFlow(instruction, options.dryRun);
        } else if (options.message) {
          await runManualCommit(options.message, options.dryRun);
        } else {
          await runAutoCommit(options.dryRun);
        }
      } else {
        console.error(
          chalk.red(
            `Error: ${error instanceof Error ? error.message : "Unknown error"}`
          )
        );
        process.exit(1);
      }
    }
  });

cli.parse(process.argv);
