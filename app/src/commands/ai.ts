import chalk from "chalk";
import ora from "ora";
import MCPClient from "../mcp/client";
import { EMOJI, formatError, printDivider } from "./utils";
import { GoogleGenAI } from "@google/genai";
import { getApiKey } from "../config/api";

const apiKey = await getApiKey();
const genai = new GoogleGenAI({ apiKey });

async function processWithGemini(
  query: string,
  dryRun = false
): Promise<string> {
  const genSpinner = ora({
    text: `🔹 Processing instruction with Gemini...`,
    color: "blue",
  }).start();

  const instruction = `You are GFTS, an AI assistant for git and file system operations in a Node/Bun project.
You are operating in the directory: ${process.cwd()}.
User instruction: ${query}.

Rules:
- Execute the task directly; no explanations or reasoning.
- Generate instructions using Node.js/Bun-compatible commands (fs, path, child_process) or git commands.
- Handle file operations: create, read, write, append, move, delete.
- Handle directory operations: create, delete, list, tree.
- For git: create branches, commit, push, stash, or list branches.
- Respect dry-run mode: ${
    dryRun
      ? "simulate changes; do not modify any files or git state."
      : "apply all changes directly."
  }`;

  try {
    const response = await genai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          parts: [{ text: instruction }],
          role: "user",
        },
      ],
    });

    const generatedText = response?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      genSpinner.fail(chalk.red("Failed to generate structured instruction"));
      throw new Error("Gemini did not return any content");
    }

    genSpinner.succeed(chalk.green("✅ Gemini processed instruction"));
    return generatedText.trim();
  } catch (err) {
    genSpinner.fail(chalk.red("Gemini processing failed"));
    throw err;
  }
}

export async function runGenerativeGitFlow(
  naturalInstruction: string,
  dryRun = false
) {
  printDivider();
  console.log(chalk.bold.cyan(`${EMOJI.ROBOT} AI Assistant`));
  console.log(chalk.greenBright(`Goal: Execute instruction`));
  printDivider();

  const initSpinner = ora({
    text: `${EMOJI.THINKING} Initializing MCP client`,
    color: "blue",
  }).start();

  const mcpClient = new MCPClient();

  try {
    await mcpClient.connect();
    initSpinner.succeed(chalk.green(`${EMOJI.SUCCESS} MCP Client ready`));
    printDivider();

    const structuredInstruction = await processWithGemini(
      naturalInstruction,
      dryRun
    );

    const executeSpinner = ora({
      text: chalk.cyan(`${EMOJI.ROBOT} Executing instruction`),
      color: "blue",
    }).start();

    let toolOutput: any = await mcpClient.callTool(
      structuredInstruction,
      dryRun
    );

    executeSpinner.succeed(
      chalk.green(`${EMOJI.SUCCESS} Instruction processed`)
    );

    console.log(chalk.dim("\nOutput:"));
    console.log(chalk.gray(toolOutput));
    printDivider();

    console.log(chalk.bold.green("🎉 Task completed!"));
  } catch (error) {
    console.error(chalk.red(`\n${EMOJI.ERROR} Operation failed:`));
    console.error(chalk.red(formatError(error)));
    throw error;
  } finally {
    await mcpClient.cleanup();
  }
}
