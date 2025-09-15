// Tool declarations for Gemini AI internal use
const toolDeclarations = [
  {
    name: "run_git_command",
    description:
      "Executes a git command. Do not include 'git' in the command string.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string" },
      },
      required: ["command"],
    },
  },
  {
    name: "list_files",
    description:
      "Lists files and directories in a specified path. Use '.' for the current directory.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
      },
      required: ["path"],
    },
  },
  {
    name: "read_file",
    description: "Reads and returns the content of a specified file.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description:
      "Writes or overwrites content to a specified file. Creates the file if it does not exist.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "move_file",
    description: "Moves or renames a file or directory.",
    parameters: {
      type: "object",
      properties: {
        source: { type: "string" },
        destination: { type: "string" },
      },
      required: ["source", "destination"],
    },
  },
  {
    name: "delete_file",
    description: "Deletes a specified file.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
      },
      required: ["path"],
    },
  },
  {
    name: "create_directory",
    description:
      "Creates a new directory, including any necessary parent directories.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
      },
      required: ["path"],
    },
  },
  {
    name: "delete_directory",
    description: "Deletes a directory and all of its contents recursively.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
      },
      required: ["path"],
    },
  },
  {
    name: "list_directory_tree",
    description:
      "Recursively lists the directory tree structure starting at a given path.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
      },
      required: ["path"],
    },
  },
  {
    name: "read_directory_files",
    description:
      "Reads the contents of all files in the given directory (non-recursive).",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
      },
      required: ["path"],
    },
  },
  {
    name: "get_current_directory",
    description: "Returns the current working directory path.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
];

// This is only used internally by the AI integration
export function getToolDefinitions() {
  return toolDeclarations;
}
