#!/usr/bin/env node
import { register } from "tsx/esm/api";

register();
const { runCliCommand } = await import("./index.ts");

async function acquisitionStdin(argv) {
  if (argv[0] !== "knowledge" || argv[1] !== "acquire") return undefined;
  if (process.stdin.isTTY) return "";
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  return input;
}

async function main() {
  try {
    const argv = process.argv.slice(2);
    const result = await runCliCommand(argv, process.cwd(), { stdin: await acquisitionStdin(argv) });
    process.stdout.write(`${JSON.stringify(result.data)}\n`);
    process.exitCode = result.exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(`${JSON.stringify({ status: "INTERNAL_ERROR", message })}\n`);
    process.exitCode = 1;
  }
}

await main();
