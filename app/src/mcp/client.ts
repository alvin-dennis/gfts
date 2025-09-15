import { Client as MCPClient } from "@modelcontextprotocol/sdk/client/index.js";
import { GftsServer } from "../server";
import chalk from "chalk";

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

  public async initializeClient(
    workingDirectory: string = process.cwd()
  ): Promise<MCPClient> {
    if (this.client) {
      return this.client;
    }

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

    console.log(chalk.green("✓ MCP Client initialized"));
    return this.client;
  }

  public getClient(): MCPClient {
    if (!this.client) {
      throw new Error(
        "MCP Client not initialized. Call initializeClient first."
      );
    }
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

  public async listFiles(dirPath: string): Promise<string> {
    return this.executeTool("listFiles", { dirPath });
  }

  public async readFile(filePath: string): Promise<string> {
    return this.executeTool("readFile", { filePath });
  }

  public async writeFile(filePath: string, content: string): Promise<string> {
    return this.executeTool("writeFile", { filePath, content });
  }

  public async moveFile(source: string, destination: string): Promise<string> {
    return this.executeTool("moveFile", { source, destination });
  }

  public async deleteFile(filePath: string): Promise<string> {
    return this.executeTool("deleteFile", { filePath });
  }

  public async createDirectory(dirPath: string): Promise<string> {
    return this.executeTool("createDirectory", { dirPath });
  }

  public async deleteDirectory(dirPath: string): Promise<string> {
    return this.executeTool("deleteDirectory", { dirPath });
  }

  public async listDirectoryTree(dirPath: string): Promise<string> {
    return this.executeTool("listDirectoryTree", { dirPath });
  }

  public async readDirectoryFiles(
    dirPath: string
  ): Promise<Record<string, any>> {
    return this.executeTool("readDirectoryFiles", { dirPath });
  }

  public async executeTool(
    toolName: string,
    toolArgs: Record<string, any>
  ): Promise<any> {
    if (!this.client) {
      throw new Error("MCP Client not initialized");
    }

    try {
      const result = await this.client.callTool({
        name: toolName,
        arguments: {
          ...toolArgs,
          working_directory: toolArgs.working_directory || process.cwd(),
        },
      });

      // Handle error responses from the server
      if (typeof result === "string" && result.includes("Error:")) {
        throw new Error(result.substring(7));
      }

      return result;
    } catch (error: any) {
      if (error.code === -32001) {
        throw new Error(
          `Tool execution timed out after ${GftsServer.DEFAULT_TIMEOUT}ms`
        );
      }
      // Add more specific error handling for common file operations
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

  private handleSend = async (msg: any): Promise<void> => {
    // Handle message sending if needed
    // console.log("Sending message:", msg);
  };

  private handleMessage = (): void => {
    // Handle incoming messages if needed
    // console.log("Received message:", msg);
  };

  private handleStart = async (): Promise<void> => {
    console.log(chalk.blue("MCP Client starting..."));
  };

  private handleClose = async (): Promise<void> => {
    console.log(chalk.yellow("MCP Client connection closed"));
    this.client = null;
    this.server = null;
  };
}

// Export a singleton instance
export default McpManager.getInstance();
