import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
await fs.rm(dist, { recursive: true, force: true });

const require = createRequire(import.meta.url);
const tsc = require.resolve("typescript/bin/tsc");
const compile = spawnSync(process.execPath, [tsc, "-p", "tsconfig.build.json"], {
  cwd: root,
  stdio: "inherit",
});
if (compile.status !== 0) process.exit(compile.status ?? 1);

const launcher = [
  "#!/usr/bin/env node",
  'const { runCliCommand } = await import("./index.js");',
  "",
  "async function acquisitionStdin(argv) {",
  '  if (argv[0] !== "knowledge" || argv[1] !== "acquire") return undefined;',
  '  if (process.stdin.isTTY) return "";',
  '  let input = "";',
  "  for await (const chunk of process.stdin) input += chunk;",
  "  return input;",
  "}",
  "",
  "async function main() {",
  "  try {",
  "    const argv = process.argv.slice(2);",
  "    const result = await runCliCommand(argv, process.cwd(), { stdin: await acquisitionStdin(argv) });",
  '    if (result.stdout !== undefined) {',
  '      process.stdout.write(result.stdout.endsWith("\\n") ? result.stdout : `${result.stdout}\\n`);',
  '    } else {',
  '      process.stdout.write(`${JSON.stringify(result.data)}\\n`);',
  '    }',
  "    process.exitCode = result.exitCode;",
  "  } catch (error) {",
  "    const message = error instanceof Error ? error.message : String(error);",
  '    process.stdout.write(`${JSON.stringify({ status: "INTERNAL_ERROR", message })}\\n`);',
  "    process.exitCode = 1;",
  "  }",
  "}",
  "",
  "await main();",
  "",
].join("\n");

await fs.mkdir(path.join(dist, "cli"), { recursive: true });
await fs.writeFile(path.join(dist, "cli", "bin.mjs"), launcher, { mode: 0o755 });
