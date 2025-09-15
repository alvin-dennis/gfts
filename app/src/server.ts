// FILE: src/git_flash/server.ts
import fs from "fs";
import path from "path";
import { execSync, exec } from "child_process";

type ToolResult =
  | { stdout?: string; stderr?: string; return_code?: number }
  | string
  | Record<string, any>;

class gftsserver {
  workingDirectory: string;

  constructor(workingDirectory: string) {
    this.workingDirectory = path.resolve(workingDirectory);
  }

  private getSafePath(targetPathStr: string): string {
    const targetPath = path.resolve(this.workingDirectory, targetPathStr);

    if (!targetPath.startsWith(this.workingDirectory)) {
      throw new Error(
        `Path access denied: '${targetPathStr}' is outside the project directory.`
      );
    }

    return targetPath;
  }

  runGitCommand(command: string): ToolResult {
    try {
      const fullCommand = `git ${command}`;
      const stdout = execSync(fullCommand, {
        cwd: this.workingDirectory,
        encoding: "utf-8",
      });
      return { stdout: stdout.trim(), stderr: "", return_code: 0 };
    } catch (err: any) {
      return { stdout: "", stderr: err.message, return_code: err.status ?? 1 };
    }
  }

  listFiles(dirPath: string): string {
    try {
      const safePath = this.getSafePath(dirPath);
      if (!fs.existsSync(safePath))
        return `Error: Path does not exist: '${dirPath}'`;
      if (!fs.statSync(safePath).isDirectory())
        return `Error: Path is not a directory: '${dirPath}'`;

      const files = fs.readdirSync(safePath);
      return files.length ? files.join("\n") : "Directory is empty.";
    } catch (err: any) {
      return `Error listing files at '${dirPath}': ${err.message}`;
    }
  }

  readFile(filePath: string): string {
    try {
      const safePath = this.getSafePath(filePath);
      if (!fs.existsSync(safePath) || !fs.statSync(safePath).isFile())
        return `Error: Path is not a file or does not exist: '${filePath}'`;

      return fs.readFileSync(safePath, "utf-8");
    } catch (err: any) {
      return `Error reading file '${filePath}': ${err.message}`;
    }
  }

  writeFile(filePath: string, content: string): string {
    try {
      const safePath = this.getSafePath(filePath);
      fs.mkdirSync(path.dirname(safePath), { recursive: true });
      fs.writeFileSync(safePath, content, "utf-8");
      return `Successfully wrote to '${filePath}'.`;
    } catch (err: any) {
      return `Error writing to file '${filePath}': ${err.message}`;
    }
  }

  moveFile(source: string, destination: string): string {
    try {
      const safeSource = this.getSafePath(source);
      const safeDestParent = this.getSafePath(path.dirname(destination));
      const safeDestination = path.join(
        safeDestParent,
        path.basename(destination)
      );

      fs.renameSync(safeSource, safeDestination);
      return `Successfully moved '${source}' to '${destination}'.`;
    } catch (err: any) {
      return `Error moving '${source}' to '${destination}': ${err.message}`;
    }
  }

  deleteFile(filePath: string): string {
    try {
      const safePath = this.getSafePath(filePath);
      if (!fs.existsSync(safePath) || !fs.statSync(safePath).isFile())
        return `Error: Path is not a file or does not exist: '${filePath}'`;

      fs.unlinkSync(safePath);
      return `Successfully deleted file '${filePath}'.`;
    } catch (err: any) {
      return `Error deleting file '${filePath}': ${err.message}`;
    }
  }

  createDirectory(dirPath: string): string {
    try {
      const safePath = this.getSafePath(dirPath);
      fs.mkdirSync(safePath, { recursive: true });
      return `Successfully created directory '${dirPath}'.`;
    } catch (err: any) {
      return `Error creating directory '${dirPath}': ${err.message}`;
    }
  }

  deleteDirectory(dirPath: string): string {
    try {
      const safePath = this.getSafePath(dirPath);
      if (!fs.existsSync(safePath) || !fs.statSync(safePath).isDirectory())
        return `Error: Path is not a directory or does not exist: '${dirPath}'`;

      fs.rmSync(safePath, { recursive: true, force: true });
      return `Successfully deleted directory '${dirPath}' and all its contents.`;
    } catch (err: any) {
      return `Error deleting directory '${dirPath}': ${err.message}`;
    }
  }

  listDirectoryTree(dirPath: string): string {
    try {
      const safePath = this.getSafePath(dirPath);
      if (!fs.existsSync(safePath))
        return `Error: Path does not exist: '${dirPath}'`;

      const buildTree = (currentPath: string, indent = ""): string[] => {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });
        let result: string[] = [`${indent}${path.basename(currentPath)}/`];
        for (const entry of entries) {
          const entryPath = path.join(currentPath, entry.name);
          if (entry.isDirectory())
            result.push(...buildTree(entryPath, indent + "    "));
          else result.push(`${indent}    ${entry.name}`);
        }
        return result;
      };

      return buildTree(safePath).join("\n");
    } catch (err: any) {
      return `Error listing directory tree at '${dirPath}': ${err.message}`;
    }
  }

  readDirectoryFiles(dirPath: string): Record<string, any> {
    try {
      const safePath = this.getSafePath(dirPath);
      if (!fs.existsSync(safePath) || !fs.statSync(safePath).isDirectory())
        return { error: `Path is not a directory: '${dirPath}'` };

      const fileContents: Record<string, string> = {};
      for (const entry of fs.readdirSync(safePath)) {
        const entryPath = path.join(safePath, entry);
        if (fs.statSync(entryPath).isFile())
          fileContents[entry] = fs.readFileSync(entryPath, "utf-8");
      }

      return Object.keys(fileContents).length
        ? fileContents
        : { info: "No readable files found in directory." };
    } catch (err: any) {
      return {
        error: `Error reading files in directory '${dirPath}': ${err.message}`,
      };
    }
  }

  getCurrentDirectory(): string {
    return process.cwd();
  }
}

// Example usage:
// const server = new GitFlashServer(process.cwd());
// console.log(server.listFiles("."));

export default gftsserver ;
