import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = path.join(projectRoot, "tests", "fixtures", "r4-external");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const codexEntrypoint = process.platform === "win32"
  ? path.join(process.env.APPDATA ?? "", "npm", "node_modules", "@openai", "codex", "bin", "codex.js")
  : null;
const home = os.homedir();
const managedSkill = path.join(home, ".agents", "skills", "legora");

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd ?? projectRoot,
    env: options.env ?? process.env,
    encoding: "utf8",
    shell: process.platform === "win32" && /\.(cmd|bat)$/i.test(command),
    timeout: options.timeout ?? 360_000,
    maxBuffer: 20 * 1024 * 1024,
  });
}

function requireSuccess(result, label) {
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} failed (${result.status}): ${(result.stderr || result.stdout || "").slice(0, 4000)}`);
  }
}

function runCodex(args, options = {}) {
  if (process.platform === "win32") {
    if (!codexEntrypoint || !fs.existsSync(codexEntrypoint)) {
      throw new Error(`Codex Node entrypoint is unavailable: ${codexEntrypoint ?? "UNKNOWN"}`);
    }
    return run(process.execPath, [codexEntrypoint, ...args], options);
  }
  return run("codex", args, options);
}

function installPackedLegora() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "legora-r5-codex-tool-"));
  const toolHome = path.join(tempRoot, "tool-home");
  fs.mkdirSync(toolHome, { recursive: true });

  const packed = run(npmCommand, ["pack", "--json"], { cwd: projectRoot, timeout: 180_000 });
  requireSuccess(packed, "npm pack");
  const info = JSON.parse(packed.stdout)[0];
  if (!info?.filename) throw new Error("npm pack returned no filename");
  const tarball = path.join(projectRoot, info.filename);
  try {
    const installed = run(npmCommand, ["install", "--prefix", toolHome, "--no-audit", "--no-fund", tarball], {
      cwd: toolHome,
      timeout: 180_000,
    });
    requireSuccess(installed, "npm install packed Legora");
  } finally {
    fs.rmSync(tarball, { force: true });
  }

  return {
    tempRoot,
    toolHome,
    bin: path.join(toolHome, "node_modules", "legora", "dist", "cli", "bin.mjs"),
    binDir: path.join(toolHome, "node_modules", ".bin"),
  };
}

function runLegora(bin, args, cwd = projectRoot) {
  const result = run(process.execPath, [bin, ...args], { cwd, timeout: 120_000 });
  requireSuccess(result, `legora ${args.join(" ")}`);
  return JSON.parse(result.stdout.trim());
}

function collectCommandStrings(value, into = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectCommandStrings(item, into);
    return into;
  }
  if (!value || typeof value !== "object") return into;
  for (const [key, child] of Object.entries(value)) {
    if (/^(command|cmd|command_line)$/i.test(key) && typeof child === "string") into.push(child);
    else collectCommandStrings(child, into);
  }
  return into;
}

function parseTrace(stdout) {
  const events = [];
  for (const [index, line] of stdout.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      for (const command of collectCommandStrings(event)) {
        if (/\blegora(?:\.cmd)?\s+/i.test(command)) events.push({ index, command });
      }
    } catch {
      // Codex --json should be JSONL; ignore any host warning line without treating it as trace evidence.
    }
  }
  return events;
}

function classifyTrace(commands) {
  const entryIndexes = commands.filter((item) => /\blegora(?:\.cmd)?\s+entry\b/i.test(item.command)).map((item) => item.index);
  const acquireIndexes = commands.filter((item) => /\blegora(?:\.cmd)?\s+knowledge\s+acquire\b/i.test(item.command)).map((item) => item.index);
  const firstEntry = entryIndexes[0] ?? -1;
  const acquire = acquireIndexes.find((index) => index > firstEntry) ?? -1;
  const secondEntry = entryIndexes.find((index) => index > acquire) ?? -1;
  return {
    firstEntryObserved: firstEntry >= 0,
    acquireObserved: acquire >= 0,
    secondEntryObserved: secondEntry >= 0,
    ordered: firstEntry >= 0 && acquire > firstEntry && secondEntry > acquire,
  };
}

function createExternalRepository(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `legora-r5-codex-${label}-`));
  fs.cpSync(fixtureRoot, root, { recursive: true, force: true });
  return root;
}

function runCodexGate(label, prompt, binDir) {
  const repositoryRoot = createExternalRepository(label);
  const finalPath = path.join(repositoryRoot, "codex-final.txt");
  const env = { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}` };
  const result = runCodex([
    "exec",
    "--ephemeral",
    "--json",
    "-s",
    "workspace-write",
    "--skip-git-repo-check",
    "-C",
    repositoryRoot,
    "-o",
    finalPath,
    prompt,
  ], { cwd: repositoryRoot, env, timeout: 360_000 });

  const commands = parseTrace(result.stdout || "");
  const trace = classifyTrace(commands);
  const storePath = path.join(repositoryRoot, ".legora", "repository-knowledge.json");
  let recordCount = null;
  if (fs.existsSync(storePath)) {
    try {
      const records = JSON.parse(fs.readFileSync(storePath, "utf8"));
      recordCount = Array.isArray(records) ? records.length : null;
    } catch {
      recordCount = null;
    }
  }
  const final = fs.existsSync(finalPath) ? fs.readFileSync(finalPath, "utf8").trim() : "";
  const hostBlocked = result.status !== 0 && /auth|authentication|login|network|connect|transport|tls|certificate|timeout|timed out|unauthorized/i.test(`${result.stderr}\n${result.stdout}`);

  return {
    label,
    exitCode: result.status,
    hostBlocked,
    stderrExcerpt: (result.stderr || "").slice(0, 1200),
    trace,
    legoraCommands: commands.map(({ index, command }) => ({ index, command: command.slice(0, 800) })),
    storeExists: fs.existsSync(storePath),
    recordCount,
    finalExcerpt: final.slice(0, 2500),
    repositoryRoot,
  };
}

if (!fs.existsSync(managedSkill)) {
  throw new Error(`Codex managed Skill is absent: ${managedSkill}`);
}

const codexVersion = runCodex(["--version"], { timeout: 30_000 });
requireSuccess(codexVersion, "codex --version");

const packed = installPackedLegora();
const doctor = runLegora(packed.bin, ["doctor", "--agent", "codex", "--json"]);
if (doctor.status !== "READY") throw new Error(`Codex doctor is not READY: ${JSON.stringify(doctor)}`);

const question = "How does request routing work in this repository, and what makes the routing decision?";
const requestedModes = new Set(process.argv.slice(2));
for (const mode of requestedModes) {
  if (mode !== "--explicit" && mode !== "--implicit") throw new Error(`Unsupported live gate mode: ${mode}`);
}
const runExplicit = requestedModes.size === 0 || requestedModes.has("--explicit");
const runImplicit = requestedModes.size === 0 || requestedModes.has("--implicit");
const explicit = runExplicit
  ? runCodexGate(
      "explicit",
      `Use $legora explicitly. ${question} Follow the Legora Skill procedure exactly and ground repository-specific claims only after READY.`,
      packed.binDir,
    )
  : null;
const implicit = runImplicit ? runCodexGate("implicit", question, packed.binDir) : null;

const selectedResults = [explicit, implicit].filter((item) => item !== null);
const gatePass = selectedResults.length > 0 && selectedResults.every((item) =>
  item.exitCode === 0
  && item.trace.ordered
  && item.storeExists
  && typeof item.recordCount === "number"
  && item.recordCount > 0
  && item.finalExcerpt.length > 0,
);
const hostBlocked = selectedResults.some((item) => item.hostBlocked);

console.log(JSON.stringify({
  codexVersion: codexVersion.stdout.trim(),
  managedSkill,
  doctor,
  explicit,
  implicit,
  gate: gatePass ? "PASS" : (hostBlocked ? "BLOCKED_BY_HOST_AUTH_OR_NETWORK" : "FAIL"),
}, null, 2));

process.exitCode = gatePass ? 0 : 7;
