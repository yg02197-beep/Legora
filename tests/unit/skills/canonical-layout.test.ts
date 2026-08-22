import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const canonicalRoot = path.join(root, "skills", "legora");

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

test("canonical Legora Skill has required Agent Skills metadata and references", async () => {
  const skill = await fs.readFile(path.join(canonicalRoot, "SKILL.md"), "utf8");

  assert.match(skill, /^---\n[\s\S]*?\n---\n/);
  assert.match(skill, /\nname:\s*legora\s*\n/);
  assert.match(skill, /\ndescription:\s*[^\n]+\n/);
  assert.match(skill, /metadata:\n\s+legora-managed:\s*["']true["']/);
  assert.match(skill, /legora-skill-schema:\s*["']1["']/);

  for (const ref of ["explain.md", "explore.md", "verify.md"]) {
    assert.equal(await exists(path.join(canonicalRoot, "references", ref)), true);
  }
});
