import type { CartographerProjectionResult } from "../../core/contracts.ts";
import { decodeCartographerModel } from "./decoder.ts";
import { projectCartographerSlice } from "./projector.ts";
import { readCartographerModelDocument } from "./source.ts";

export interface CartographerProjectionInput {
  repositoryRoot: string;
  sliceId: string;
}

export async function projectCartographerRepositorySlice(
  input: CartographerProjectionInput,
): Promise<CartographerProjectionResult> {
  const document = await readCartographerModelDocument(input.repositoryRoot);
  const model = decodeCartographerModel(document, input.repositoryRoot);
  return projectCartographerSlice(model, input.sliceId);
}
