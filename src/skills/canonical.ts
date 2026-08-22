import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface CanonicalSkillFile {
  relativePath: string;
  bytes: Uint8Array;
  sha256: string;
}

export interface CanonicalSkillSnapshot {
  root: string;
  name: "legora";
  description: string;
  files: readonly CanonicalSkillFile[];
  payloadDigest: string;
}

export interface CanonicalSkillValidationIssue {
  code:
    | "SKILL_FILE_MISSING"
    | "FRONTMATTER_MISSING"
    | "SKILL_NAME_INVALID"
    | "SKILL_DESCRIPTION_INVALID"
    | "SKILL_METADATA_INVALID"
    | "SKILL_REFERENCE_MISSING";
  message: string;
}

interface ParsedFrontmatter {
  name: string | null;
  description: string | null;
  managed: string | null;
  schema: string | null;
  duplicateName: boolean;
  duplicateDescription: boolean;
  duplicateManaged: boolean;
  duplicateSchema: boolean;
}

const REQUIRED_REFERENCES = [
  "references/explain.md",
  "references/explore.md",
  "references/verify.md",
] as const;

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function scalarValue(raw: string): string {
  const value = raw.trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function parseFrontmatter(text: string): ParsedFrontmatter | null {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;

  const lines = match[1].split(/\r?\n/);
  const topLevel = new Map<string, string[]>();
  const metadata = new Map<string, string[]>();
  let inMetadata = false;

  for (const line of lines) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const top = line.match(/^([a-zA-Z0-9-]+):\s*(.*)$/);
    if (top) {
      const [, key, rawValue] = top;
      inMetadata = key === "metadata";
      if (key !== "metadata") {
        const values = topLevel.get(key) ?? [];
        values.push(scalarValue(rawValue));
        topLevel.set(key, values);
      }
      continue;
    }
    if (inMetadata) {
      const child = line.match(/^\s+([a-zA-Z0-9-]+):\s*(.*)$/);
      if (child) {
        const [, key, rawValue] = child;
        const values = metadata.get(key) ?? [];
        values.push(scalarValue(rawValue));
        metadata.set(key, values);
      }
    }
  }

  const names = topLevel.get("name") ?? [];
  const descriptions = topLevel.get("description") ?? [];
  const managedValues = metadata.get("legora-managed") ?? [];
  const schemaValues = metadata.get("legora-skill-schema") ?? [];
  return {
    name: names[0] ?? null,
    description: descriptions[0] ?? null,
    managed: managedValues[0] ?? null,
    schema: schemaValues[0] ?? null,
    duplicateName: names.length !== 1,
    duplicateDescription: descriptions.length !== 1,
    duplicateManaged: managedValues.length !== 1,
    duplicateSchema: schemaValues.length !== 1,
  };
}

async function existsRegularFile(filePath: string): Promise<boolean> {
  try {
    return (await fs.lstat(filePath)).isFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function enumerateCanonicalFiles(root: string, current = root): Promise<CanonicalSkillFile[]> {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files: CanonicalSkillFile[] = [];
  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    const relativePath = path.relative(root, fullPath).split(path.sep).join("/");
    if (entry.isSymbolicLink()) {
      throw new Error(`Canonical Skill may not contain symlink entries: ${relativePath}`);
    }
    if (entry.isDirectory()) {
      files.push(...await enumerateCanonicalFiles(root, fullPath));
      continue;
    }
    if (!entry.isFile()) {
      throw new Error(`Canonical Skill may contain only regular files and directories: ${relativePath}`);
    }
    if (relativePath === ".legora-install.json") continue;
    const bytes = await fs.readFile(fullPath);
    files.push({ relativePath, bytes, sha256: sha256(bytes) });
  }
  return files;
}

export function resolveLegoraPackageRoot(moduleUrl: string = import.meta.url): string {
  const moduleFile = fileURLToPath(moduleUrl);
  const moduleDirectory = path.dirname(moduleFile);
  return path.dirname(path.dirname(moduleDirectory));
}

export function resolveCanonicalSkillRoot(packageRoot = resolveLegoraPackageRoot()): string {
  return path.join(packageRoot, "skills", "legora");
}

export async function validateCanonicalSkill(
  skillRoot = resolveCanonicalSkillRoot(),
): Promise<readonly CanonicalSkillValidationIssue[]> {
  const skillPath = path.join(skillRoot, "SKILL.md");
  let skillText: string;
  try {
    skillText = await fs.readFile(skillPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [{ code: "SKILL_FILE_MISSING", message: `Missing canonical Skill file: ${skillPath}` }];
    }
    throw error;
  }

  const frontmatter = parseFrontmatter(skillText);
  if (!frontmatter) {
    return [{ code: "FRONTMATTER_MISSING", message: "Canonical SKILL.md must begin with YAML frontmatter." }];
  }

  const issues: CanonicalSkillValidationIssue[] = [];
  if (frontmatter.duplicateName || frontmatter.name !== "legora") {
    issues.push({ code: "SKILL_NAME_INVALID", message: "Canonical Skill name must appear exactly once and equal legora." });
  }
  if (frontmatter.duplicateDescription || !frontmatter.description?.trim()) {
    issues.push({ code: "SKILL_DESCRIPTION_INVALID", message: "Canonical Skill description must appear exactly once and be non-empty." });
  }
  if (
    frontmatter.duplicateManaged
    || frontmatter.duplicateSchema
    || frontmatter.managed !== "true"
    || frontmatter.schema !== "1"
  ) {
    issues.push({ code: "SKILL_METADATA_INVALID", message: "Canonical Skill metadata must mark the Legora-managed schema exactly once." });
  }

  for (const relativePath of REQUIRED_REFERENCES) {
    if (!await existsRegularFile(path.join(skillRoot, relativePath))) {
      issues.push({ code: "SKILL_REFERENCE_MISSING", message: `Missing canonical Skill reference: ${relativePath}` });
    }
  }
  return issues;
}

export async function loadCanonicalSkillSnapshot(
  skillRoot = resolveCanonicalSkillRoot(),
): Promise<CanonicalSkillSnapshot> {
  const issues = await validateCanonicalSkill(skillRoot);
  if (issues.length > 0) {
    throw new Error(`Canonical Skill validation failed: ${issues.map((issue) => issue.code).join(", ")}`);
  }

  const skillText = await fs.readFile(path.join(skillRoot, "SKILL.md"), "utf8");
  const frontmatter = parseFrontmatter(skillText);
  if (!frontmatter?.description) throw new Error("Canonical Skill frontmatter disappeared after validation.");

  const files = (await enumerateCanonicalFiles(skillRoot))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  const payload = files.map((file) => `${file.relativePath}\0${file.sha256}\n`).join("");
  return {
    root: skillRoot,
    name: "legora",
    description: frontmatter.description,
    files,
    payloadDigest: sha256(payload),
  };
}
