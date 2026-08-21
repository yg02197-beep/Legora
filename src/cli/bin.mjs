#!/usr/bin/env node
import { register } from "tsx/esm/api";

register();
const { runCliCommand } = await import("./index.ts");

async function main() {
  try {
    const result = await runCliCommand(process.argv.slice(2), process.cwd());
    process.stdout.write(`${JSON.stringify(result.data)}\n`);
    process.exitCode = result.exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(`${JSON.stringify({ status: "INTERNAL_ERROR", message })}\n`);
    process.exitCode = 1;
  }
}

await main();
