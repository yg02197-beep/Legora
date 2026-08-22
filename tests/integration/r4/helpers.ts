import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export interface R4Workspace {
  root: string;
  toolHome: string;
  targetRepository: string;
}

export interface InstalledLegora {
  executable: string;
  packageRoot: string;
}

export interface LegoraProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  data: unknown;
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const fixtureRoot = path.join(projectRoot, "tests", "fixtures", "r4-external");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

export async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function createR4Workspace(): Promise<R4Workspace> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "legora-r4-"));
  const toolHome = path.join(root, "tool-home");
  const targetRepository = path.join(root, "target-repository");
  await fs.mkdir(toolHome, { recursive: true });
  await fs.mkdir(targetRepository, { recursive: true });
  return { root, toolHome, targetRepository };
}

export async function copyExternalFixture(targetRepository: string): Promise<void> {
  await fs.cp(fixtureRoot, targetRepository, { recursive: true, force: true });
}

export async function inventoryRepository(root: string): Promise<string[]> {
  const paths: string[] = [];
  async function visit(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      if (entry.isDirectory()) await visit(absolute);
      else paths.push(relative);
    }
  }
  await visit(root);
  return paths.sort();
}

function runProcess(command: string, args: string[], options: {
  cwd: string;
  stdin?: string;
}): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      shell: process.platform === "win32",
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ exitCode: code ?? 1, stdout, stderr }));
    if (options.stdin !== undefined) child.stdin.end(options.stdin);
    else child.stdin.end();
  });
}

export async function installPackedLegora(workspace: R4Workspace): Promise<InstalledLegora> {
  const packed = await runProcess(npmCommand, ["pack", "--json"], { cwd: projectRoot });
  if (packed.exitCode !== 0) {
    throw new Error(`npm pack failed: ${packed.stderr || packed.stdout}`);
  }

  let tarballPath = "";
  try {
    const parsed = JSON.parse(packed.stdout) as Array<{ filename?: string }>;
    const filename = parsed[0]?.filename;
    if (!filename) throw new Error("npm pack returned no filename");
    tarballPath = path.join(projectRoot, filename);

    const installed = await runProcess(
      npmCommand,
      ["install", "--prefix", workspace.toolHome, "--no-audit", "--no-fund", tarballPath],
      { cwd: workspace.toolHome },
    );
    if (installed.exitCode !== 0) {
      throw new Error(`npm install failed: ${installed.stderr || installed.stdout}`);
    }
  } finally {
    if (tarballPath) await fs.rm(tarballPath, { force: true });
  }

  const executable = path.join(
    workspace.toolHome,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "legora.cmd" : "legora",
  );
  return {
    executable,
    packageRoot: path.join(workspace.toolHome, "node_modules", "legora"),
  };
}

export async function runInstalledLegora(
  installed: InstalledLegora,
  targetRepository: string,
  args: string[],
  stdin?: string,
): Promise<LegoraProcessResult> {
  const result = await runProcess(installed.executable, args, { cwd: targetRepository, stdin });
  let data: unknown = undefined;
  const trimmed = result.stdout.trim();
  if (trimmed) {
    try {
      data = JSON.parse(trimmed);
    } catch {
      data = undefined;
    }
  }
  return { ...result, data };
}

export { projectRoot as R4_PROJECT_ROOT };
