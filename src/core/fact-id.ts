import { createHash } from "node:crypto";
import type { BehaviorFactCategory } from "./contracts.ts";

export function createBehaviorFactId(
  category: BehaviorFactCategory,
  providerRefs: readonly string[],
): string {
  const canonical = JSON.stringify({ category, providerRefs: [...providerRefs] });
  const digest = createHash("sha256").update(canonical, "utf8").digest("hex");
  return `fact:${category}:${digest}`;
}
