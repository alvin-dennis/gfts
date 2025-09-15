import path from "path";
import os from "os";

export const CONFIG_DIR = path.join(os.homedir(), ".config", "git-flash");
export const ENV_FILE = path.join(CONFIG_DIR, ".env");