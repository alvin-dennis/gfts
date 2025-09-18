// src/mcp/client.ts
import chalk from "chalk";
import { GftsServer } from "../server";
import { getToolDefinitions } from "../tools/declarations";
import { execSync } from "child_process";

export default class MCPClient {
  private server: GftsServer;
  private cwd: string;

  constructor(workingDirectory: string = process.cwd()) {
    this.cwd = workingDirectory;
    this.server = new GftsServer(this.cwd);
  }

  async connect() {
    console.log(chalk.green("✅ MCP Client initialized (serverless mode)"));
  }

  /**
   * Executes a structured instruction from AI (JSON or natural language)
   * Handles Git commands and file operations.
   */
  async callTool(instruction: string, dryRun: boolean = true): Promise<string> {
    console.log(chalk.blueBright("\n💡 Processing instruction:"));
    console.log(chalk.gray(instruction));

    try {
      // 1️⃣ Try JSON instruction
      let parsed: any;
      try {
        parsed = JSON.parse(instruction);
      } catch {
        parsed = null;
      }

      if (parsed?.tool && parsed?.parameters) {
        const tools = getToolDefinitions();
        const toolDef = tools.find((t) => t.name === parsed.tool);
        if (!toolDef) return `❌ Unknown tool: ${parsed.tool}`;

        if (dryRun) return `Dry-run: simulated ${parsed.tool} execution.`;

        switch (parsed.tool) {
          case "run_git_command":
            return (await this.server.runGitCommand(parsed.parameters.command))
              .stdout;
          case "write_file":
            return this.server.writeFile(
              parsed.parameters.path,
              parsed.parameters.content
            );
          case "append_file":
            return this.server.appendFile(
              parsed.parameters.path,
              parsed.parameters.content
            );
          case "move_file":
            return this.server.moveFile(
              parsed.parameters.source,
              parsed.parameters.destination
            );
          case "delete_file":
            return this.server.deleteFile(parsed.parameters.path);
          case "create_directory":
            return this.server.createDirectory(parsed.parameters.path);
          case "delete_directory":
            return this.server.deleteDirectory(parsed.parameters.path);
          case "list_files":
            return this.server.listFiles(parsed.parameters.path);
          case "list_directory_tree":
            return this.server.listDirectoryTree(parsed.parameters.path);
          case "read_directory_files":
            return this.server.readDirectoryFiles(parsed.parameters.path);
          case "get_current_directory":
            return this.server.getCurrentDirectory();
        }
      }

      // 2️⃣ Fallback: regex for natural language
      const normalized = instruction.toLowerCase();

      if (/^git\s/i.test(normalized)) {
        if (dryRun)
          return `Dry-run: git command not executed.\nCommand: ${instruction}`;
        return (
          await this.server.runGitCommand(instruction.replace(/^git\s/i, ""))
        ).stdout;
      }

      const tools = getToolDefinitions();
      for (const tool of tools) {
        if (normalized.includes(tool.name.replaceAll("_", " "))) {
          if (dryRun) return `Dry-run: simulated ${tool.name} execution.`;

          // Regex mapping for simple commands
          switch (tool.name) {
            case "write_file": {
              const m = instruction.match(
                /write\s+(.+?)\s+with\s+content\s+["']([\s\S]+)["']/i
              );
              if (m) return this.server.writeFile(m[1], m[2]);
              break;
            }
            case "append_file": {
              const m = instruction.match(
                /append\s+to\s+(.+?)\s+content\s+["']([\s\S]+)["']/i
              );
              if (m) return this.server.appendFile(m[1], m[2]);
              break;
            }
            case "move_file": {
              const m = instruction.match(/move\s+(.+?)\s+to\s+(.+)/i);
              if (m) return this.server.moveFile(m[1], m[2]);
              break;
            }
            case "delete_file": {
              const m = instruction.match(/delete\s+file\s+(.+)/i);
              if (m) return this.server.deleteFile(m[1]);
              break;
            }
            case "create_directory": {
              const m = instruction.match(/create\s+directory\s+(.+)/i);
              if (m) return this.server.createDirectory(m[1]);
              break;
            }
            case "delete_directory": {
              const m = instruction.match(/delete\s+directory\s+(.+)/i);
              if (m) return this.server.deleteDirectory(m[1]);
              break;
            }
            case "list_files": {
              const m = instruction.match(/list\s+files\s+in\s+(.+)/i);
              if (m) return this.server.listFiles(m[1]);
              break;
            }
          }
        }
      }

      // 3️⃣ Fallback: execute as shell command
      if (dryRun)
        return `Dry-run: command not executed.\nCommand: ${instruction}`;
      return execSync(instruction, { cwd: this.cwd, encoding: "utf-8" });
    } catch (err: any) {
      return `❌ Error executing instruction:\n${err.message}`;
    }
  }

  async cleanup() {
    console.log(chalk.yellow("🧹 MCP Client cleanup done"));
  }
}
