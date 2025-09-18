import chalk from "chalk";
import ora from "ora";
import mcpClient from "../mcp/client";
import { EMOJI, formatError, printDivider } from "./utils";

export async function runGenerativeGitFlow(
  toolName: string,
  toolArgs: Record<string, any> = {},
  dryRun = false
) {
  printDivider();
  console.log(chalk.bold.cyan(`${EMOJI.ROBOT} AI Assistant`));
  console.log(chalk.greenBright(`Goal: Execute tool '${toolName}'`));
  printDivider();

  const initSpinner = ora({
    text: `${EMOJI.THINKING} Initializing MCP client`,
    color: "blue",
  }).start();

  try {
    // Initialize MCP client with GftsServer
    await mcpClient.initializeClient(process.cwd());
    initSpinner.succeed(chalk.green(`${EMOJI.SUCCESS} MCP Client ready`));
    printDivider();

    const actionSpinner = ora({
      text: chalk.cyan(`${EMOJI.ROBOT} Executing tool: ${toolName}`),
      color: "blue",
    }).start();

    let toolOutput: any;
    if (dryRun) {
      actionSpinner.warn(chalk.magenta("Dry run - skipping execution"));
      toolOutput = "Dry run mode, command not executed.";
    } else {
      try {
        console.log("Calling executeTool:", toolName, toolArgs);
        toolOutput = await mcpClient.executeTool(
          toolName as any,
          toolArgs
        );
        console.log("Finished executeTool");
        toolOutput = await mcpClient.executeTool(toolName as any, toolArgs);
        toolOutput =
          typeof toolOutput === "object" && toolOutput !== null
            ? JSON.stringify(toolOutput, null, 2)
            : String(toolOutput);
        actionSpinner.succeed(chalk.green(`${EMOJI.SUCCESS} Tool executed`));
      } catch (error) {
        actionSpinner.fail(chalk.red(`${EMOJI.ERROR} Tool execution failed`));
        console.error(chalk.red(formatError(error)));
        toolOutput = `Error: ${formatError(error)}`;
      }
    }

    if (toolOutput) {
      console.log(chalk.dim("Output:"));
      console.log(chalk.gray(toolOutput));
      printDivider();
    }

    console.log(chalk.bold.green("🎉 Task completed!"));
  } catch (error) {
    console.error(chalk.red(`\n${EMOJI.ERROR} Operation failed:`));
    console.error(chalk.red(formatError(error)));
    throw error;
  } finally {
    await mcpClient.closeClient();
  }
}
