#! /usr/bin/env bun

import { Command } from "commander";
import chalk from "chalk";
import { setupApiKey } from "./src/config/api";
import {
  runGenerativeGitFlow,
  runManualCommit,
  runAutoCommit,
} from "./src/commands/git";

function createCli() {
  const cli = new Command();
  
  cli
    .name("gfts")
    .description(
      chalk.bold("Git Flash TypeScript SDK - AI-powered Git Assistant\n\n") +
        chalk.dim(
          "An intuitive CLI tool that helps you manage git operations using natural language and AI assistance.\n\n"
        ) +
        chalk.cyan("Examples:\n") +
        '  $ gfts "commit all my recent changes with a good message"\n' +
        '  $ gfts commit -m "feat: add new authentication system"\n' +
        "  $ gfts auto-commit\n"
    )
    .version("1.0.0", "-v, --version", "Output the current version")
    .option("--dry-run", "Simulate actions without making changes", false)
    .addHelpText(
      "after",
      `
${chalk.cyan("Documentation:")}
  Run ${chalk.bold(
    "gfts <command> --help"
  )} for detailed information about a command.
  Visit ${chalk.underline(
    "https://github.com/alvin-dennis/gfts"
  )} for full documentation.
    `
    );

  cli
    .command("config")
    .description("Configure GFTS settings")
    .option("--show", "Show current configuration")
    .option("--reset", "Reset configuration to defaults")
    .action(async (options) => {
      if (options.show) {
      } else if (options.reset) {
      } else {
        await setupApiKey();
      }
    });

  cli
    .command("commit")
    .description("Create a new commit")
    .option("-m, --message <msg>", "Specific commit message")
    .option("-a, --all", "Stage all changes before committing")
    .option("--no-push", "Skip pushing to remote")
    .allowExcessArguments(false)
    .addHelpText(
      "after",
      `
${chalk.cyan("Examples:")}
  $ gfts commit -m "feat: add user authentication"
  $ gfts commit -am "fix: resolve login bug"
  $ gfts commit --no-push -m "chore: update dependencies"
    `
    )
    .action(async (options) => {
      if (!options.message) {
        console.error(chalk.red("Error: Commit message is required"));
        console.log(chalk.yellow("\nUse one of the following:"));
        console.log(chalk.cyan('  gfts commit -m "your commit message"'));
        console.log(chalk.cyan("  gfts auto-commit"));
        console.log(
          chalk.yellow(
            "\nNote: Make sure to wrap multi-word messages in quotes"
          )
        );
        process.exit(1);
      }
      await runManualCommit(options.message, cli.opts().dryRun, !options.push);
    });

  cli
    .command("auto-commit")
    .alias("ac")
    .description("Automatically generate commit message and create commit")
    .option("--no-push", "Skip pushing to remote")
    .addHelpText(
      "after",
      `
${chalk.cyan("Examples:")}
  $ gfts auto-commit
  $ gfts ac --no-push
    `
    )
    .action(async (options) => {
      await runAutoCommit(cli.opts().dryRun, !options.push);
    });

  cli
    .command("assist [instruction]", { isDefault: true })
    .description("Get AI assistance for git operations")
    .addHelpText(
      "after",
      `
${chalk.cyan("Examples:")}
  $ gfts "stage and commit all my recent changes"
  $ gfts "create a new branch and commit my changes"
  $ gfts "push my changes to origin"
    `
    )
    .action(async (instruction) => {
      if (!instruction) {
        cli.help();
        return;
      }
      await runGenerativeGitFlow(instruction, cli.opts().dryRun);
    });

  return cli;
}

const cli = createCli();
cli.parse(process.argv);
