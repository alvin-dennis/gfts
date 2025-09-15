import chalk from "chalk";

export const EMOJI = {
  COMMIT: "📝",
  PUSH: "🚀",
  SUCCESS: "✓",
  ERROR: "❌",
  THINKING: "🤔",
  ROBOT: "🤖",
  CONFIG: "⚙️",
};

export const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

export const printDivider = () => {
  console.log(chalk.dim("─".repeat(process.stdout.columns || 80)));
};
