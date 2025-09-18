import { Client as MCPClient } from "@modelcontextprotocol/sdk/client/index.js";
import GftsServer from "../server"; // default import
import chalk from "chalk";

// Define types for server commands (based on your GftsServer methods)
type GftsCommand =
  | "listFiles"
  | "readFile"
  | "writeFile"
  | "appendFile"
  | "moveFile"
  | "copyFile"
  | "deleteFile"
  | "createDirectory"
  | "deleteDirectory"
  | "copyDirectory"
  | "listDirectoryTree"
  | "readDirectoryFiles"
  | "runGitCommand"
  | "existsPath";

type GftsCommandArgs = Record<string, any>;

/** Helper to call a GftsServer method dynamically */
async function executeCommand(
  server: GftsServer,
  command: GftsCommand,
  args: GftsCommandArgs = {},
  workingDir?: string
): Promise<any> {
  switch (command) {
    case "listFiles":
      return server.listFiles(args.dirPath);
    case "readFile":
      return server.readFile(args.filePath);
    case "writeFile":
      return server.writeFile(args.filePath, args.content);
    case "appendFile":
      return server.appendFile(args.filePath, args.content);
    case "moveFile":
      return server.moveFile(args.source, args.destination);
    case "copyFile":
      // implement copy using read + write
      const content = await server.readFile(args.source);
      return server.writeFile(args.destination, content);
    case "deleteFile":
      return server.deleteFile(args.filePath);
    case "createDirectory":
      return server.createDirectory(args.dirPath);
    case "deleteDirectory":
      return server.deleteDirectory(args.dirPath);
    case "copyDirectory":
      // implement recursively if needed
      throw new Error("copyDirectory not implemented yet");
    case "listDirectoryTree":
      return server.listDirectoryTree(args.dirPath);
    case "readDirectoryFiles":
      return server.readDirectoryFiles(args.dirPath);
    case "runGitCommand":
      return server.runGitCommand(args.command);
    case "existsPath":
      // simple check
      return !!args.filePath;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

export class McpManager {
  private static instance: McpManager;
  private client: MCPClient | null = null;
  private server: GftsServer | null = null;

  private constructor() {}

  public static getInstance(): McpManager {
    if (!McpManager.instance) {
      McpManager.instance = new McpManager();
    }
    return McpManager.instance;
  }

  /** Initialize MCP client and attach GftsServer */
  public async initializeClient(
    workingDirectory: string = process.cwd()
  ): Promise<MCPClient> {
    if (this.client) return this.client;

    this.server = new GftsServer(workingDirectory);

    this.client = new MCPClient({
      server: this.server,
      name: "gfts",
      version: "1.0.0",
      timeout: GftsServer.DEFAULT_TIMEOUT,
    });

    await this.client.connect({
      send: this.handleSend,
      onmessage: this.handleMessage,
      start: this.handleStart,
      close: this.handleClose,
    });

    console.log(chalk.green("✓ MCP Client initialized with GftsServer"));
    return this.client;
  }

  public getClient(): MCPClient {
    if (!this.client)
      throw new Error(
        "MCP Client not initialized. Call initializeClient first."
      );
    return this.client;
  }

  public async closeClient(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.server = null;
      console.log(chalk.yellow("MCP Client closed"));
    }
  }

  /** Execute any server command dynamically via MCP */
  public async executeTool(
    toolName: GftsCommand,
    toolArgs: GftsCommandArgs = {},
    workingDir?: string
  ): Promise<any> {
    if (!this.client || !this.server) {
      throw new Error("MCP Client or GftsServer not initialized");
    }

    try {
      const result = await executeCommand(
        this.server,
        toolName,
        toolArgs,
        workingDir
      );

      if (typeof result === "string" && result.includes("Error:")) {
        throw new Error(result.substring(7));
      }

      return result;
    } catch (error: any) {
      if (error.message.includes("Path access denied")) {
        throw new Error(`Security Error: ${error.message}`);
      }
      if (error.message.includes("ENOENT")) {
        throw new Error(`File not found: ${error.message}`);
      }
      if (error.message.includes("EEXIST")) {
        throw new Error(`File already exists: ${error.message}`);
      }
      if (error.message.includes("EPERM")) {
        throw new Error(`Permission denied: ${error.message}`);
      }
      throw error;
    }
  }

  // ---------------------- Convenience wrapper methods ----------------------
  public listFiles(dirPath: string) {
    return this.executeTool("listFiles", { dirPath });
  }
  public readFile(filePath: string) {
    return this.executeTool("readFile", { filePath });
  }
  public writeFile(filePath: string, content: string) {
    return this.executeTool("writeFile", { filePath, content });
  }
  public appendFile(filePath: string, content: string) {
    return this.executeTool("appendFile", { filePath, content });
  }
  public moveFile(source: string, destination: string) {
    return this.executeTool("moveFile", { source, destination });
  }
  public copyFile(source: string, destination: string) {
    return this.executeTool("copyFile", { source, destination });
  }
  public deleteFile(filePath: string) {
    return this.executeTool("deleteFile", { filePath });
  }
  public createDirectory(dirPath: string) {
    return this.executeTool("createDirectory", { dirPath });
  }
  public deleteDirectory(dirPath: string) {
    return this.executeTool("deleteDirectory", { dirPath });
  }
  public listDirectoryTree(dirPath: string) {
    return this.executeTool("listDirectoryTree", { dirPath });
  }
  public readDirectoryFiles(dirPath: string) {
    return this.executeTool("readDirectoryFiles", { dirPath });
  }
  public runGitCommand(command: string) {
    return this.executeTool("runGitCommand", { command });
  }

  // ---------------------- MCP Event Handlers ----------------------
  private handleSend = async (msg: any): Promise<void> => {};
  private handleMessage = (): void => {};
  private handleStart = async (): Promise<void> => {
    console.log(chalk.blue("MCP Client starting..."));
  };
  private handleClose = async (): Promise<void> => {
    console.log(chalk.yellow("MCP Client connection closed"));
    this.client = null;
    this.server = null;
  };
}

// Export singleton
export default McpManager.getInstance();
