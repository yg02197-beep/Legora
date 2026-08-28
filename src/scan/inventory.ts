import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function collectRepositoryInventory(repositoryRoot: string): Promise<string[]> {
  const { stdout } = await execFileAsync("git", ["ls-files"], { cwd: repositoryRoot });
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .sort();
}
