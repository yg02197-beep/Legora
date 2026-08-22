import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  loadCanonicalSkillSnapshot,
  resolveCanonicalSkillRoot,
  resolveLegoraPackageRoot,
  validateCanonicalSkill,
} from "../../../src/skills/canonical.ts";

const VALID_SKILL = `---\nname: legora\ndescription: Understand repository behavior from current source evidence. Use for code-flow questions.\nmetadata:\n  legora-managed: "true"\n  legora-skill-schema: "1"\n---\n# Legora\n\nRead references/explain.md, references/explore.md, or references/verify.md.\n`;

const REFERENCE_CONTENT: Record<string, string> = {
  "references/explain.md": "# Explain\n",
  "references/explore.md": "# Explore\n",
  "references/verify.md": "# Verify\n",
};

async function makeFixture(order: readonly string[] = [
  "SKILL.md",
  "references/explain.md",
  "references/explore.md",
  "references/verify.md",
]): Promise<string> {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "legora-skill-"));
  const root = path.join(parent, "legora");
  await fs.mkdir(root, { recursive: true });
  for (const relativePath of order) {
    const fullPath = path.join(root, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, relativePath === "SKILL.md" ? VALID_SKILL : REFERENCE_CONTENT[relativePath]);
  }
  return root;
}

async function issueCodes(root: string): Promise<string[]> {
  return (await validateCanonicalSkill(root)).map((issue) => issue.code);
}

test("valid canonical Skill has zero validation issues", async () => {
  const root = await makeFixture();
  try {
    assert.deepEqual(await validateCanonicalSkill(root), []);
  } finally {
    await fs.rm(path.dirname(root), { recursive: true, force: true });
  }
});

test("canonical validation rejects missing frontmatter", async () => {
  const root = await makeFixture();
  try {
    await fs.writeFile(path.join(root, "SKILL.md"), "# Legora\n");
    assert.deepEqual(await issueCodes(root), ["FRONTMATTER_MISSING"]);
  } finally {
    await fs.rm(path.dirname(root), { recursive: true, force: true });
  }
});

test("canonical validation rejects a non-legora name", async () => {
  const root = await makeFixture();
  try {
    await fs.writeFile(path.join(root, "SKILL.md"), VALID_SKILL.replace("name: legora", "name: other"));
    assert.deepEqual(await issueCodes(root), ["SKILL_NAME_INVALID"]);
  } finally {
    await fs.rm(path.dirname(root), { recursive: true, force: true });
  }
});

test("canonical validation rejects an empty description", async () => {
  const root = await makeFixture();
  try {
    await fs.writeFile(path.join(root, "SKILL.md"), VALID_SKILL.replace(/description:[^\n]+/, "description:"));
    assert.deepEqual(await issueCodes(root), ["SKILL_DESCRIPTION_INVALID"]);
  } finally {
    await fs.rm(path.dirname(root), { recursive: true, force: true });
  }
});

test("canonical validation requires all three references", async () => {
  const root = await makeFixture();
  try {
    await fs.rm(path.join(root, "references", "explain.md"));
    assert.deepEqual(await issueCodes(root), ["SKILL_REFERENCE_MISSING"]);
  } finally {
    await fs.rm(path.dirname(root), { recursive: true, force: true });
  }
});

test("canonical payload digest is independent of filesystem creation order", async () => {
  const first = await makeFixture();
  const second = await makeFixture([
    "references/verify.md",
    "references/explore.md",
    "SKILL.md",
    "references/explain.md",
  ]);
  try {
    const a = await loadCanonicalSkillSnapshot(first);
    const b = await loadCanonicalSkillSnapshot(second);
    assert.equal(a.payloadDigest, b.payloadDigest);
    assert.deepEqual(a.files.map((file) => file.relativePath), b.files.map((file) => file.relativePath));
  } finally {
    await fs.rm(path.dirname(first), { recursive: true, force: true });
    await fs.rm(path.dirname(second), { recursive: true, force: true });
  }
});

test("one byte change changes the file digest and payload digest", async () => {
  const root = await makeFixture();
  try {
    const before = await loadCanonicalSkillSnapshot(root);
    await fs.appendFile(path.join(root, "SKILL.md"), "x");
    const after = await loadCanonicalSkillSnapshot(root);
    const beforeSkill = before.files.find((file) => file.relativePath === "SKILL.md");
    const afterSkill = after.files.find((file) => file.relativePath === "SKILL.md");
    assert.notEqual(beforeSkill?.sha256, afterSkill?.sha256);
    assert.notEqual(before.payloadDigest, after.payloadDigest);
  } finally {
    await fs.rm(path.dirname(root), { recursive: true, force: true });
  }
});

test("install manifest is excluded from the canonical payload digest", async () => {
  const root = await makeFixture();
  try {
    const before = await loadCanonicalSkillSnapshot(root);
    await fs.writeFile(path.join(root, ".legora-install.json"), "{\"managed\":true}\n");
    const after = await loadCanonicalSkillSnapshot(root);
    assert.equal(before.payloadDigest, after.payloadDigest);
    assert.equal(after.files.some((file) => file.relativePath === ".legora-install.json"), false);
  } finally {
    await fs.rm(path.dirname(root), { recursive: true, force: true });
  }
});

test("canonical snapshot rejects symlink entries instead of following them", async (t) => {
  const root = await makeFixture();
  try {
    const outside = path.join(path.dirname(root), "outside.txt");
    await fs.writeFile(outside, "outside\n");
    try {
      await fs.symlink(outside, path.join(root, "linked.txt"), "file");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EPERM" || code === "EACCES") {
        t.skip(`symlink creation unavailable: ${code}`);
        return;
      }
      throw error;
    }
    await assert.rejects(() => loadCanonicalSkillSnapshot(root), /symlink/i);
  } finally {
    await fs.rm(path.dirname(root), { recursive: true, force: true });
  }
});

test("package and canonical Skill roots resolve from source and compiled module URLs", () => {
  const packageRoot = path.resolve("D:/example/legora");
  const sourceUrl = pathToFileURL(path.join(packageRoot, "src", "skills", "canonical.ts")).href;
  const compiledUrl = pathToFileURL(path.join(packageRoot, "dist", "skills", "canonical.js")).href;

  assert.equal(resolveLegoraPackageRoot(sourceUrl), packageRoot);
  assert.equal(resolveLegoraPackageRoot(compiledUrl), packageRoot);
  assert.equal(resolveCanonicalSkillRoot(packageRoot), path.join(packageRoot, "skills", "legora"));
});
