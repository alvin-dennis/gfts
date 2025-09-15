import chalk from "chalk";
import ora from "ora";
import { GoogleGenAI } from "@google/genai";
import { getApiKey } from "../config/api";
import mcpClient from "../mcp/client";
import { getToolDefinitions } from "../tools/declarations";
import { EMOJI, formatError, printDivider } from "./utils";

export async function runGenerativeGitFlow(
  instruction: string,
  dryRun = false
) {
  printDivider();
  console.log(chalk.bold.cyan(`${EMOJI.ROBOT} AI Assistant`));
  console.log(chalk.greenBright(`Goal: ${instruction}`));
  printDivider();

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
    printDivider();

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
          printDivider();
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

      printDivider();
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
