import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function read(relativePath: string): Promise<string> {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

test("canonical SKILL.md encodes the R2 Entry-first acquire-refresh handshake", async () => {
  const skill = await read("skills/legora/SKILL.md");

  assert.match(skill, /legora entry/i);
  assert.match(skill, /KNOWLEDGE_NOT_FOUND/);
  assert.match(skill, /KNOWLEDGE_CANDIDATES/);
  assert.match(skill, /REVIEW_KNOWLEDGE_CANDIDATES/);
  assert.match(skill, /ACQUIRE_KNOWLEDGE/);
  assert.match(skill, /KNOWLEDGE_STALE/);
  assert.match(skill, /KNOWLEDGE_UNKNOWN/);
  assert.match(skill, /REFRESH_KNOWLEDGE/);
  assert.match(skill, /legora knowledge acquire/i);
  assert.match(skill, /READY/);
  assert.match(skill, /entry.*again|re-run.*entry|rerun.*entry/i);
  assert.match(skill, /candidate.*before.*repository|before.*repository.*candidate/i);
  assert.match(skill, /--candidate/);
  assert.match(skill, /--reject-candidates/);
  assert.match(skill, /candidate.*metadata|metadata.*candidate/i);
  assert.match(skill, /knowledge acquire --example/i);
  assert.match(skill, /simple acquisition/i);
  assert.match(skill, /without.*internal.*id|do not.*internal.*id/i);
  assert.match(skill, /EXISTING_KNOWLEDGE/);
});

test("canonical Skill description advertises Entry-first repository understanding before direct source search", async () => {
  const skill = await read("skills/legora/SKILL.md");

  assert.match(skill, /description:.*Legora.*first/i);
  assert.match(skill, /description:.*repository-understanding/i);
  assert.match(skill, /description:.*Entry.*before.*Grep\/Read/i);
});

test("canonical SKILL.md gates authoritative capability output on READY", async () => {
  const skill = await read("skills/legora/SKILL.md");

  assert.match(skill, /before READY|until READY|READY.*before/i);
  assert.match(skill, /Explain/);
  assert.match(skill, /Explore/);
  assert.match(skill, /Verify/);
});

test("canonical SKILL.md points to the three capability references", async () => {
  const skill = await read("skills/legora/SKILL.md");

  assert.match(skill, /references\/explain\.md/);
  assert.match(skill, /references\/explore\.md/);
  assert.match(skill, /references\/verify\.md/);
});

test("Explain reference builds a simple mental model while preserving repository evidence boundaries", async () => {
  const explain = await read("skills/legora/references/explain.md");

  assert.match(explain, /mental model/i);
  assert.match(explain, /terminology bridge/i);
  assert.match(explain, /plain|easy/i);
  assert.match(explain, /technical term|canonical term/i);
  assert.match(explain, /Behavior Slice/);
  assert.match(explain, /evidence/i);
  assert.match(explain, /general programming|analogy|general concept/i);
  assert.match(explain, /unsupported|unknown|do not invent|must not invent/i);
});

test("Explore reference distinguishes inspection from executable Microworld behavior", async () => {
  const explore = await read("skills/legora/references/explore.md");

  assert.match(explore, /Explore.*Microworld|Microworld.*Explore/is);
  assert.match(explore, /not every|not all|broader than/i);
  assert.match(explore, /code navigation|state inspection|timeline|scenario comparison/i);
  assert.match(explore, /executable evidence|evidence gate|evidence-bounded/i);
  assert.match(explore, /Prediction/);
  assert.match(explore, /Microworld/);
  assert.match(explore, /do not invent|must not invent|never invent/i);
  assert.match(explore, /fallback|degrade|inspection|explanation/i);
});

test("Verify reference evaluates observable understanding without permanent or binary-only claims", async () => {
  const verify = await read("skills/legora/references/verify.md");

  assert.match(verify, /observable/i);
  assert.match(verify, /explain-back/i);
  assert.match(verify, /Prediction/);
  assert.match(verify, /transfer/i);
  assert.match(verify, /confirmed/);
  assert.match(verify, /partial/);
  assert.match(verify, /uncertain/);
  assert.match(verify, /misconception/);
  assert.match(verify, /insufficient_evidence/);
  assert.match(verify, /PASS.*FAIL|binary/is);
  assert.match(verify, /mastery|permanent ability|permanent/i);
});

test("public Skill surface stays provider- and coding-agent-neutral", async () => {
  const files = [
    "skills/legora/SKILL.md",
    "skills/legora/references/explain.md",
    "skills/legora/references/explore.md",
    "skills/legora/references/verify.md",
  ];

  const publicText = (await Promise.all(files.map(read))).join("\n");
  const forbidden = [
    /Cartographer/i,
    /sliceId/,
    /refreshCartographer/,
    /\bMCP\b/,
    /codex\s+(exec|cli|app)/i,
    /claude\s+(code|cli)/i,
    /gemini\s+cli/i,
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(publicText, pattern);
  }
});

test("canonical SKILL.md keeps authoritative evidence fields out of agent-authored acquisition proposals", async () => {
  const skill = await read("skills/legora/SKILL.md");

  assert.match(skill, /do not author/i);
  assert.match(skill, /snippet/i);
  assert.match(skill, /history/i);
  assert.match(skill, /timestamps?/i);
  assert.match(skill, /CONFIRMED/i);
  assert.match(skill, /do not write.*repository-knowledge\.json/i);
});

test("root SKILL.md is a compatibility pointer rather than a second workflow copy", async () => {
  const rootSkill = await read("SKILL.md");

  assert.match(rootSkill, /skills\/legora\/SKILL\.md/);
  assert.doesNotMatch(rootSkill, /## Mandatory procedure/);
  assert.equal(rootSkill.length < 800, true);
});

test("README points coding agents to the canonical Skill surface", async () => {
  const readme = await read("README.md");

  assert.match(readme, /SKILL\.md/);
  assert.match(readme, /legora entry/i);
  assert.match(readme, /Explain/);
  assert.match(readme, /Explore/);
  assert.match(readme, /Verify/);
});
