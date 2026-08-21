import fs from "node:fs/promises";
import path from "node:path";
import { CartographerAdapterError } from "./errors.ts";

export async function readCartographerModelDocument(repositoryRoot: string): Promise<unknown> {
  const modelPath = path.join(repositoryRoot, ".cartographer", "model.json");
  let raw: string;

  try {
    raw = await fs.readFile(modelPath, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new CartographerAdapterError(
        "CARTOGRAPHER_MODEL_NOT_FOUND",
        `Cartographer model not found at ${modelPath}`,
        { cause: error },
      );
    }
    throw new CartographerAdapterError(
      "CARTOGRAPHER_MODEL_UNREADABLE",
      `Cartographer model could not be read at ${modelPath}`,
      { cause: error },
    );
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new CartographerAdapterError(
      "CARTOGRAPHER_MODEL_INVALID_JSON",
      `Cartographer model is not valid JSON at ${modelPath}`,
      { cause: error },
    );
  }
}
