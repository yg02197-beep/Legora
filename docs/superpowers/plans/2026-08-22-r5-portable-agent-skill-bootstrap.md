# R5 Portable Agent Skill & Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Do not dispatch subagents for this project. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the R4 standalone Legora package into one standards-valid Agent Skill that can be bootstrapped safely into Codex, Claude Code, and Gemini CLI user scope without modifying target repositories, then prove all three agents preserve the same Entry/acquire/READY authority contract.

**Architecture:** R5 keeps one canonical `skills/legora/` payload and separates it from host-specific placement. Deterministic production modules validate/hash that payload, resolve at most two physical user-scope targets, manage only manifest-proven copies through rollback-capable publication, expose read-only diagnostics, and connect those services to the existing CLI without changing R2-R4 Repository Knowledge semantics. Live model/agent compatibility is a final validation layer only and is not part of the normal deterministic test suite.

**Tech Stack:** Node.js ESM, TypeScript 5.7+, Node test runner, SHA-256 via `node:crypto`, filesystem/process APIs, npm pack/install tooling, existing Legora CLI and R2-R4 runtime, installed Codex/Claude Code/Gemini CLI for final live gates.

**Spec:** `docs/superpowers/specs/2026-08-22-r5-portable-agent-skill-bootstrap-design.md`

## Global Constraints

- `skills/legora/` is the only authoritative Agent Skill source.
- Canonical `SKILL.md` must contain standards-valid YAML frontmatter with `name: legora` and a provider-neutral `description` that states capability and trigger conditions.
- Root `SKILL.md` becomes a compatibility pointer only; root `references/` is removed after all callers/tests migrate.
- The npm package contains `dist/`, `skills/legora/`, `README.md`, and `package.json`; it does not require `tsx` or TypeScript at runtime.
- Codex and Gemini share `$HOME/.agents/skills/legora`; Claude uses `$HOME/.claude/skills/legora`.
- Bootstrap writes only after an explicit `legora bootstrap` invocation and performs no network access.
- Bare bootstrap detects supported executables and targets only detected agents; explicit `--agent <name>` may pre-provision even when the executable is absent.
- An existing target without a valid Legora ownership manifest is always `CONFLICT`, even when its bytes match the canonical Skill.
- A managed target with local modifications is `CONFLICT` and must never be silently overwritten.
- Updates use a complete sibling staged candidate and rollback-capable replacement; interruption must not silently destroy the prior managed installation.
- `legora doctor` is read-only. `NATIVE_DISCOVERY=NOT_PROBED` must remain distinct from failure or confirmation.
- Gemini native discovery may be confirmed only by bounded `gemini skills list --all` output that lists `legora` as enabled. Authentication warnings on stderr do not by themselves invalidate the local listing when the command returns a usable list.
- Codex and Claude filesystem placement is not called native discovery proof; actual activation is proven only by live gates.
- Bootstrap/doctor never write `.agents/`, `.claude/`, `.gemini/`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, manifests, lockfiles, or source inside the current repository.
- Existing Entry/acquire/refresh/READY, Repository Knowledge, Behavior Slice, Explain/Explore/Verify, fail-closed, and Cartographer compatibility contracts remain unchanged.
- No MCP server, built-in LLM, background daemon, whole-repository pre-indexer, remote repository service, editor extension, vendor-specific semantic copy, npm publication, or Codex plugin publication is added in R5.
- No subagents or parallel agents.
- Do not commit or push unless the user explicitly approves after final integrated review.

## File / Responsibility Map

```text
skills/legora/SKILL.md
  Canonical standards-valid Agent Skill instructions.

skills/legora/references/{explain,explore,verify}.md
  Canonical Human Understanding capability references.

SKILL.md
  Small compatibility pointer to skills/legora/SKILL.md; not a second workflow copy.

src/skills/canonical.ts
  Resolve package root/canonical Skill root, validate required metadata/references,
  enumerate canonical files, hash individual files, compute canonical payload digest.

src/bootstrap/contracts.ts
  Supported-agent, target, manifest, state, plan, result, and injected file-op types.

src/bootstrap/targets.ts
  Resolve supported executables and deduplicated user-scope physical targets.

src/bootstrap/managed-copy.ts
  Read/validate ownership manifest, inspect ABSENT/NO_CHANGE/MANAGED_UPDATE/CONFLICT,
  build staged candidate, publish/rollback a managed Skill installation.

src/bootstrap/service.ts
  Parse requested agents into a deterministic bootstrap plan; dry-run or execute targets.

src/doctor/contracts.ts
  Doctor layer/result types.

src/doctor/service.ts
  Read-only CLI/skill/agent/install/digest/native-discovery diagnostics.

src/cli/render.ts
  Human rendering only for bootstrap/doctor while preserving JSON output for existing commands.

src/cli/index.ts
  Public argument parsing and dispatch to bootstrap/doctor services.

src/cli/bin.mjs + scripts/build.mjs
  Emit result.stdout when supplied; otherwise preserve current JSON serialization.

package.json
  Package canonical skills/ instead of root Skill/reference copies; add deterministic R5 test script.

README.md
  Document install -> bootstrap -> doctor -> normal coding-agent question flow after deterministic gates pass.

tests/unit/skills/*
  Agent Skills standard/canonical snapshot tests.

tests/unit/bootstrap/*
  Target resolution, ownership state machine, publication rollback, service tests.

tests/unit/doctor/*
  Read-only layer/native discovery tests.

tests/unit/cli/*
  Bootstrap/doctor CLI and output-format contracts.

tests/integration/r5/*
  Packed-package, isolated fake-home bootstrap, repository-isolation deterministic gates.

docs/validation/r5-agent-compatibility.md
  Separate observable Codex/Claude/Gemini live-gate evidence and final Gate C-D-E-F verdicts.
```

## Spec-to-Task Coverage

| Gate / requirement | Task(s) |
| --- | --- |
| Gate 0 Agent Skills Standard | 1-2 |
| Gate A Distribution | 1, 7 |
| Gate B Bootstrap Safety | 3-5 |
| Gate C Codex Discovery & Compatibility | 9 |
| Gate D Claude Discovery & Compatibility | 9 |
| Gate E Gemini Discovery & Compatibility | 6, 9 |
| Gate F Cross-Agent Semantic Parity | 9 |
| Gate G Repository Isolation | 5, 8 |
| Gate H R1-R4 Regression | 8 |
| managed-copy interruption safety | 4 |
| doctor read-only / NOT_PROBED distinction | 6 |
| no network / no repository bootstrap writes | 5, 8 |

---

### Task 1: Migrate to one standards-valid canonical Agent Skill

**Files:**
- Create: `skills/legora/SKILL.md`
- Create: `skills/legora/references/explain.md`
- Create: `skills/legora/references/explore.md`
- Create: `skills/legora/references/verify.md`
- Modify: `SKILL.md`
- Delete: `references/explain.md`
- Delete: `references/explore.md`
- Delete: `references/verify.md`
- Modify: `tests/unit/skill-contract.test.ts`
- Create: `tests/unit/skills/canonical-layout.test.ts`

**Interfaces:**
- Produces canonical directory `skills/legora/` used by every later task.
- Produces root compatibility pointer whose only semantic authority is the canonical path.
- Does not yet add production bootstrap code.

- [ ] **Step 1: Write failing canonical-layout tests**

Add tests that read `skills/legora/SKILL.md` and assert all of the following exact invariants:

```ts
assert.match(skill, /^---\n[\s\S]*?\n---\n/);
assert.match(skill, /\nname:\s*legora\s*\n/);
assert.match(skill, /\ndescription:\s*[^\n]+\n/);
assert.match(skill, /metadata:\n\s+legora-managed:\s*["']true["']/);
assert.match(skill, /legora-skill-schema:\s*["']1["']/);
for (const ref of ["explain.md", "explore.md", "verify.md"]) {
  assert.equal(await exists(path.join(canonicalRoot, "references", ref)), true);
}
```

Update the existing Skill contract tests to read the canonical Skill and canonical references. Add a root-pointer test that asserts root `SKILL.md` is short, mentions `skills/legora/SKILL.md`, and does **not** duplicate `## Mandatory procedure`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```text
node --import tsx --test tests/unit/skill-contract.test.ts tests/unit/skills/canonical-layout.test.ts
```

Expected: FAIL because `skills/legora/` does not yet exist and the root Skill is still authoritative.

- [ ] **Step 3: Move the existing R3 workflow into the canonical Skill**

Create `skills/legora/SKILL.md` with this frontmatter followed by the existing R3 Skill body:

```yaml
---
name: legora
description: Understand how a repository behaves using current source evidence. Use for questions about code flow, responsibilities, states, causality, failures, interactions, or when a user wants to understand why repository behavior occurs.
metadata:
  legora-managed: "true"
  legora-skill-schema: "1"
---
```

Move the three current reference files byte-for-byte into `skills/legora/references/` except for relative-link adjustments required by the new root. Replace root `SKILL.md` with a compatibility pointer that directs manual/pre-R5 consumers to `skills/legora/SKILL.md` and does not restate the workflow. Remove root `references/` after tests point only to the canonical directory.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the same focused command. Expected: PASS.

- [ ] **Step 5: Run public neutrality search**

Search canonical public Skill files for forbidden provider/runtime terms from the R3 neutrality contract: `Cartographer`, `MCP`, `codex exec`, `claude`, `gemini`, `sliceId`, provider refresh controls. Expected: zero forbidden public-surface matches except explanatory text in non-Skill docs.

---

### Task 2: Add canonical Skill validation and deterministic snapshot hashing

**Files:**
- Create: `src/skills/canonical.ts`
- Create: `tests/unit/skills/canonical.test.ts`

**Interfaces:**

Produce:

```ts
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

export function resolveLegoraPackageRoot(moduleUrl?: string): string;
export function resolveCanonicalSkillRoot(packageRoot?: string): string;
export async function loadCanonicalSkillSnapshot(skillRoot?: string): Promise<CanonicalSkillSnapshot>;
export async function validateCanonicalSkill(skillRoot?: string): Promise<readonly CanonicalSkillValidationIssue[]>;
```

Digest contract:

```text
files = every regular file under canonical Skill root, excluding .legora-install.json
sort by POSIX relativePath
fileSha = SHA256(raw bytes)
payloadDigest = SHA256(each `${relativePath}\0${fileSha}\n` in sorted order)
```

No YAML dependency is added. Parse only the bounded frontmatter fields Legora owns; reject missing/duplicate required fields and require the three canonical reference files.

- [ ] **Step 1: Write RED tests for format and digest stability**

Tests must prove:

```text
valid canonical Skill -> zero issues
missing frontmatter -> FRONTMATTER_MISSING
name != legora -> SKILL_NAME_INVALID
empty description -> SKILL_DESCRIPTION_INVALID
missing references/explain.md -> SKILL_REFERENCE_MISSING
same files in different filesystem enumeration order -> same payloadDigest
one byte change -> different file digest and payloadDigest
.legora-install.json present in a fixture -> excluded from canonical digest
```

Use temporary Skill fixtures, not edits to the real canonical Skill, for negative cases.

- [ ] **Step 2: Run focused tests and verify RED**

```text
node --import tsx --test tests/unit/skills/canonical.test.ts
```

Expected: module/function missing.

- [ ] **Step 3: Implement the minimal validator/snapshot module**

Use `fs.readdir(..., { withFileTypes: true })`, regular files only, sorted POSIX paths, `createHash("sha256")`, and raw-byte reads. Reject symlink entries inside the canonical Skill payload rather than following them.

`resolveLegoraPackageRoot()` must work from both source execution (`src/skills/canonical.ts`) and compiled execution (`dist/skills/canonical.js`) by resolving two directories above the module directory. `resolveCanonicalSkillRoot()` returns `<packageRoot>/skills/legora`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Expected: all canonical tests PASS.

---

### Task 3: Define supported-agent detection and deduplicated bootstrap targets

**Files:**
- Create: `src/bootstrap/contracts.ts`
- Create: `src/bootstrap/targets.ts`
- Create: `tests/unit/bootstrap/targets.test.ts`

**Interfaces:**

```ts
export type SupportedAgent = "codex" | "claude" | "gemini";
export type PhysicalTargetKind = "agents-shared" | "claude";

export interface AgentAvailability {
  agent: SupportedAgent;
  executable: string | null;
}

export interface BootstrapTarget {
  kind: PhysicalTargetKind;
  path: string;
  agents: readonly SupportedAgent[];
}

export interface HostEnvironment {
  homeDir: string;
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
}

export async function detectSupportedAgents(host: HostEnvironment): Promise<readonly AgentAvailability[]>;
export function resolveBootstrapTargets(homeDir: string, agents: readonly SupportedAgent[]): readonly BootstrapTarget[];
export function parseSupportedAgent(value: string): SupportedAgent | "all" | null;
```

Path contract:

```text
codex  -> <home>/.agents/skills/legora
gemini -> <home>/.agents/skills/legora
claude -> <home>/.claude/skills/legora
```

Detection is local-only. Search `PATH` directly; on Windows honor `PATHEXT` and common `.cmd/.exe/.bat` forms. Do not spawn the agent and do not use network access merely to decide whether it exists.

- [ ] **Step 1: Write RED tests**

Tests cover:

```text
codex + gemini -> one agents-shared target with agents [codex, gemini]
claude -> one claude target
all three -> exactly two physical targets
duplicate requested agents -> deduplicated
unsupported string -> null
empty home -> target resolution rejects
Windows PATH finds codex.cmd / claude.cmd / gemini.cmd
POSIX PATH requires executable file access
```

- [ ] **Step 2: Verify RED**

Run the focused target test and confirm missing module/functions.

- [ ] **Step 3: Implement target resolution and PATH probing**

Keep all host-specific differences in this module. No semantic behavior branches by agent may be introduced elsewhere.

- [ ] **Step 4: Verify GREEN**

Run focused test; expected PASS.

---

### Task 4: Implement manifest-proven managed-copy state and rollback-capable publication

**Files:**
- Modify: `src/bootstrap/contracts.ts`
- Create: `src/bootstrap/managed-copy.ts`
- Create: `tests/unit/bootstrap/managed-copy.test.ts`

**Interfaces:**

```ts
export interface LegoraInstallManifest {
  schemaVersion: 1;
  packageVersion: string;
  payloadDigest: string;
  files: ReadonlyArray<{ relativePath: string; sha256: string }>;
}

export type ManagedCopyState = "ABSENT" | "NO_CHANGE" | "MANAGED_UPDATE" | "CONFLICT";

export interface ManagedCopyInspection {
  state: ManagedCopyState;
  reason:
    | "TARGET_ABSENT"
    | "CURRENT_MANAGED_COPY"
    | "PACKAGED_PAYLOAD_CHANGED"
    | "UNOWNED_TARGET"
    | "MANIFEST_INVALID"
    | "MANAGED_FILE_MODIFIED"
    | "MANAGED_FILE_MISSING"
    | "TARGET_NOT_DIRECTORY";
}

export interface BootstrapFileOps {
  lstat(path: string): Promise<import("node:fs").Stats>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<unknown>;
  readFile(path: string): Promise<Buffer>;
  writeFile(path: string, data: string | Uint8Array): Promise<void>;
  readdir(path: string, options: { withFileTypes: true }): Promise<import("node:fs").Dirent[]>;
  rename(from: string, to: string): Promise<void>;
  rm(path: string, options: { recursive: boolean; force: boolean }): Promise<void>;
}

export interface ManagedCopyPublication {
  changed: boolean;
  target: string;
  rollback(): Promise<void>;
  finalize(): Promise<void>;
}

export async function inspectManagedCopy(target: string, snapshot: CanonicalSkillSnapshot): Promise<ManagedCopyInspection>;
export async function publishManagedCopy(input: {
  target: string;
  snapshot: CanonicalSkillSnapshot;
  packageVersion: string;
  fileOps?: BootstrapFileOps;
}): Promise<ManagedCopyPublication>;
```

Publication protocol:

```text
1. create unique sibling <target>.legora-stage-<token>
2. materialize canonical files + manifest in stage
3. reload/validate staged files and digest == packaged payloadDigest
4. ABSENT: rename stage -> target
5. MANAGED_UPDATE:
   a. rename target -> sibling backup
   b. rename stage -> target
   c. validate new target
6. return a publication receipt while any rollback backup is still retained
7. receipt.rollback():
   - ABSENT install -> remove the just-published managed target
   - MANAGED_UPDATE -> remove the just-published managed target and restore backup -> target
8. receipt.finalize(): delete retained backup/stage transaction residue only after the caller has committed the larger bootstrap transaction
9. if failure after 5a and before a receipt can be returned:
   - remove partial new target when present and proven to be this staged payload
   - rename backup -> target
   - propagate original failure
10. best-effort remove owned stage residue after rollback/finalize
```

Never adopt an unmanifested directory. Reject a target that is a symlink/non-directory. Manifest itself is not part of `payloadDigest`.

- [ ] **Step 1: Write RED state-machine tests**

Cover ABSENT, exact current managed copy, changed packaged canonical payload, unowned identical-looking directory, malformed manifest, locally modified managed file, missing managed file, and symlink/non-directory target.

- [ ] **Step 2: Write RED interruption tests before implementation**

Inject a `BootstrapFileOps` wrapper whose `rename` throws:

```text
case A: stage -> target on fresh install
  expected: no partial target claimed as managed

case B: after old target -> backup, before stage -> target
  expected: old target restored byte-for-byte

case C: after stage -> target validation fails
  expected: old target restored byte-for-byte
```

The test records prior bytes/digests and compares after failure.

- [ ] **Step 3: Run focused tests and verify RED**

Expected: missing implementation.

- [ ] **Step 4: Implement inspection, manifest validation, stage publication, rollback receipts**

Use random sibling tokens from `crypto.randomUUID()`. Every file copied from the canonical snapshot must use its captured bytes, not be re-read by path during publication. Validate every managed relative path is normalized, non-absolute, and contains no `..` traversal segment before writing. Do not delete a managed-update backup until `finalize()`; this retained receipt is what allows Task 5 to roll back an earlier physical target if a later target fails.

- [ ] **Step 5: Run focused tests and verify GREEN**

All state and interruption tests PASS. A receipt that is finalized leaves no stage/backup residue; a receipt that is rolled back restores the exact prior state.

---

### Task 5: Implement bootstrap planning/execution and repository-isolation behavior

**Files:**
- Create: `src/bootstrap/service.ts`
- Create: `tests/unit/bootstrap/service.test.ts`
- Create: `tests/integration/r5/bootstrap-isolation.test.ts`

**Interfaces:**

```ts
export type BootstrapAction = "INSTALL" | "NO_CHANGE" | "MANAGED_UPDATE" | "CONFLICT";

export interface BootstrapAgentResult {
  agent: SupportedAgent;
  executable: "FOUND" | "NOT_FOUND";
  targetKind: PhysicalTargetKind;
  targetPath: string;
  action: BootstrapAction;
}

export interface BootstrapResult {
  status: "BOOTSTRAP_READY" | "BOOTSTRAP_CONFLICT" | "BOOTSTRAP_FAILED";
  dryRun: boolean;
  physicalWrites: number;
  agents: readonly BootstrapAgentResult[];
}

export async function bootstrapLegora(input: {
  requested: readonly SupportedAgent[] | "detected";
  dryRun: boolean;
  host: HostEnvironment;
  packageVersion: string;
  canonicalSkillRoot?: string;
}): Promise<BootstrapResult>;
```

Behavior:

```text
requested="detected" -> detect PATH agents, target only FOUND agents
explicit agent         -> target it even when NOT_FOUND
all three explicit     -> at most two physical target operations
CONFLICT on any required physical target -> do not mutate any target in that invocation
```

To preserve multi-target fail-closed behavior, bootstrap must inspect **all** required targets first. If any is conflict/invalid, return before any target publication. Only after the complete preflight is publishable may writes begin. Keep every `ManagedCopyPublication` receipt returned by Task 4. If a later physical target fails, call earlier receipts' `rollback()` in reverse order and fail. Only after every physical target publishes successfully may bootstrap call every receipt's `finalize()`. These receipts/backups live only in sibling user-scope paths, never in target repositories.

- [ ] **Step 1: Write RED service tests**

Cover detected-only behavior, explicit pre-provisioning, all-three/two-target dedupe, dry-run zero writes, conflict preflight zero writes, and agent missing reported separately from Skill installation.

- [ ] **Step 2: Write RED cross-target rollback test**

Arrange managed shared target + managed Claude target needing update. Inject failure publishing the second target. Assert both targets equal their pre-bootstrap bytes after the failed command.

- [ ] **Step 3: Implement bootstrap service**

No network commands, package managers, Git, agent executions, or repository path writes. Package version comes from the installed Legora package metadata supplied by the CLI layer. Publication order must be deterministic by `PhysicalTargetKind`; collect receipts, roll them back in reverse order on any later failure, and finalize them only after the full physical-target set succeeds.

- [ ] **Step 4: Verify focused GREEN**

Run bootstrap service tests.

- [ ] **Step 5: Add packed/external repository isolation integration**

Use a temporary fake home and the existing R4 external target fixture. Pack/install Legora into a separate tool home, run installed `legora bootstrap` with fake HOME/USERPROFILE, then compare target-repository inventory and bytes before/after. Expected changes are only under the fake home; target repository is byte-for-byte unchanged.

Also run `bootstrap --dry-run` and prove fake home is unchanged.

---

### Task 6: Implement read-only Doctor with bounded Gemini native discovery probe

**Files:**
- Create: `src/doctor/contracts.ts`
- Create: `src/doctor/service.ts`
- Create: `tests/unit/doctor/service.test.ts`
- Create: `tests/fixtures/r5-doctor/gemini-skills-list.txt`

**Interfaces:**

```ts
export type DiagnosticState = "PASS" | "FAIL" | "NOT_FOUND" | "NOT_PROBED" | "CONFIRMED" | "TIMEOUT";

export interface AgentDoctorResult {
  agent: SupportedAgent;
  executable: DiagnosticState;
  installTarget: DiagnosticState;
  managedDigest: DiagnosticState;
  nativeDiscovery: DiagnosticState;
}

export interface DoctorResult {
  status: "READY" | "NOT_READY";
  cliRuntime: "PASS";
  canonicalSkillFormat: DiagnosticState;
  agents: readonly AgentDoctorResult[];
}

export interface LocalCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export type LocalCommandRunner = (command: string, args: readonly string[], timeoutMs: number) => Promise<LocalCommandResult>;

export async function doctorLegora(input: {
  requested: readonly SupportedAgent[] | "all";
  host: HostEnvironment;
  canonicalSkillRoot?: string;
  runLocalCommand?: LocalCommandRunner;
}): Promise<DoctorResult>;
```

Gemini parser contract is based on locally observed `gemini skills list --all` output:

```text
Discovered Agent Skills:

legora [Enabled]
  Description: ...
  Location:    C:\Users\...\.agents\skills\legora\SKILL.md
```

The command may emit host-auth warnings on stderr before this local listing. Native discovery is `CONFIRMED` only when stdout contains a top-level `legora [Enabled]` entry and its Location resolves to the managed target. `legora [Disabled]`, absent entry, wrong location, malformed output, or timeout is not confirmation.

For Codex and Claude, `nativeDiscovery = NOT_PROBED` in deterministic Doctor.

- [ ] **Step 1: Save a sanitized Gemini listing fixture and write parser/service RED tests**

The fixture must contain only the structural format needed for parsing, no user secrets. Tests cover enabled/disabled, wrong location, absent Skill, stderr auth warning with valid stdout list, timeout, missing agent executable, current managed target, and conflict target.

- [ ] **Step 2: Add strict read-only test**

Snapshot fake-home inventory and bytes before Doctor. Run Doctor for all agents with injected command runner. Assert exact equality after.

- [ ] **Step 3: Implement Doctor**

Default Gemini runner uses `spawn`/`spawnSync` with a 10-second timeout, no shell interpolation, and arguments `skills`, `list`, `--all`. Doctor does not invoke Codex or Claude model sessions.

Bare Doctor may report missing unsupported/not-installed agents without making them fatal if at least one detected supported agent has a current managed Skill and no detected agent is broken. `doctor --agent <name>` is `NOT_READY` when that explicit agent executable is missing or its target is not current. Document this exact aggregate rule in tests.

- [ ] **Step 4: Verify focused GREEN**

Run doctor tests; expected PASS and no fake-home mutation.

---

### Task 7: Wire bootstrap/doctor into the CLI and R5 package boundary

**Files:**
- Create: `src/cli/render.ts`
- Modify: `src/cli/index.ts`
- Modify: `src/cli/bin.mjs`
- Modify: `scripts/build.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tests/unit/cli/bin.test.ts`
- Modify: `tests/unit/cli/package-lock.test.ts`
- Create: `tests/unit/cli/bootstrap-doctor.test.ts`
- Modify: `tests/integration/r4/standalone-package.test.ts`
- Create: `tests/integration/r5/package-bootstrap.test.ts`

**Interfaces:**

Extend without breaking existing callers:

```ts
export interface CliCommandResult {
  exitCode: number;
  data: Record<string, any>;
  stdout?: string;
}
```

Launcher contract:

```ts
if (result.stdout !== undefined) process.stdout.write(result.stdout.endsWith("\n") ? result.stdout : `${result.stdout}\n`);
else process.stdout.write(`${JSON.stringify(result.data)}\n`);
```

Existing `entry` and `knowledge` commands continue to emit JSON exactly as before.

Bootstrap/Doctor options accepted exactly:

```text
bootstrap [--agent codex|claude|gemini|all] [--dry-run] [--json]
doctor [--agent codex|claude|gemini] [--json]
```

Unknown/duplicate conflicting option values -> existing usage error exit 2.

Exit contract:

```text
bootstrap success / NO_CHANGE / successful pre-provision -> 0
bootstrap conflict or publication failure                -> 7
doctor READY                                               -> 0
doctor NOT_READY                                           -> 7
invalid CLI syntax                                         -> 2
```

Default bootstrap/doctor output is human text from `src/cli/render.ts`; `--json` suppresses `stdout` and uses the existing JSON serializer.

- [ ] **Step 1: Write CLI RED tests**

Assert parsing, exit codes, human default rendering, `--json`, explicit missing-agent pre-provision behavior, and unchanged Entry/Knowledge JSON output.

- [ ] **Step 2: Update package-content RED assertions**

R4 standalone package test must now require:

```text
skills/legora/SKILL.md present
skills/legora/references/* present
root package SKILL.md absent or non-authoritative according to package files contract
root package references/ absent
src/ absent
tests/ absent
tsx/typescript runtime absent
```

Set `package.json.files` to include `dist`, `skills/legora`, and `README.md`; do not package root compatibility pointer or root references.

- [ ] **Step 3: Run focused tests and verify RED**

Expected failures for missing CLI commands/package Skill migration.

- [ ] **Step 4: Implement CLI dispatch/render and generated launcher parity**

`src/cli/bin.mjs` development launcher and `scripts/build.mjs` generated production launcher must have the same `stdout`-override rule. Package version is read from package root `package.json` without adding a runtime package dependency.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run unit CLI tests plus R4 standalone package and R5 package-bootstrap integration.

- [ ] **Step 6: Run `npm pack --dry-run` and inspect the manifest**

Require exactly one canonical Legora Skill tree and no root duplicate workflow/reference tree. No actual registry publication.

---

### Task 8: Close deterministic R5 Gates 0/A/B/G/H and full regression

**Files:**
- Create: `tests/integration/r5/deterministic-gates.test.ts` if coverage is not already complete in focused R5 integration files.
- Modify: `package.json` to add `test:integration:r5` only after the test file set exists.
- Update: `README.md` only to describe R5 bootstrap/doctor as implemented; do **not** claim three-agent compatibility yet.

**Interfaces:**
- `npm run test:integration:r5` runs deterministic R5 tests only; it never launches model-backed Codex/Claude/Gemini sessions.
- Live agent gates stay outside this command.

- [ ] **Step 1: Add deterministic aggregate script**

Use serial execution if tests share package build artifacts:

```json
"test:integration:r5": "node --import tsx --test --test-concurrency=1 tests/integration/r5/*.test.ts"
```

- [ ] **Step 2: Run fresh deterministic full gate**

Run separately and require exit 0 for each:

```text
npm run typecheck
npm test
npm run test:integration:cartographer-real
npm run test:integration:causal-real
node --import tsx --test tests/integration/repository-knowledge/*.test.ts
npm run test:integration:r4
npm run test:integration:r5
```

- [ ] **Step 3: Run static/product-boundary checks**

Require:

```text
git diff --check PASS
canonical public Skill provider-neutrality PASS
root references/ absent
canonical Skill placeholder scan PASS
npm pack --dry-run has one skills/legora tree
no *.tgz residue
no repository-root .legora created by deterministic bootstrap/doctor tests
staged = 0
```

- [ ] **Step 4: Review repository-isolation proof**

For bootstrap/doctor integration, compare every target-repository file byte-for-byte before/after. No `.agents`, `.claude`, `.gemini`, instruction file, package manifest, lockfile, or source change is allowed.

- [ ] **Step 5: Record deterministic verdict**

At this point only Gates 0/A/B/G/H may be called PASS. R5 must remain incomplete until Task 9 closes C/D/E/F.

---

### Task 9: Run observable Codex, Claude Code, and Gemini live compatibility gates

**Files:**
- Create: `docs/validation/r5-agent-compatibility.md`
- Optionally create validation-only: `scripts/r5-live-gate.mjs` if structured trace collection can be made deterministic without changing agent semantics.
- Modify: `README.md` only after all live gates actually pass.
- Modify: `docs/superpowers/specs/2026-08-22-r5-portable-agent-skill-bootstrap-design.md` status only after all gates pass.

**Interfaces / proof boundary:**
- Live runs use the installed packed Legora CLI and real user-scope managed Skill targets.
- Use one disposable external copy of `tests/fixtures/r4-external/` for the controlled question.
- The external target has no Legora dependency or agent-specific instruction/bootstrap file.
- Prepend the isolated installed Legora `.bin` directory to PATH inherited by each agent so the discovered Skill can run `legora` without installing Legora into the target repo.
- Capture structured event streams where each host exposes them; retain only non-secret excerpts needed to prove command ordering and final output.

**Common controlled question:**

```text
How does request routing work in this repository, and what makes the routing decision?
```

Before each agent run, reset the disposable repository to no `.legora` state so every agent must demonstrate the full handshake independently.

Required trace invariant:

```text
Skill discovered/activated
-> first Legora runtime command is `legora entry <question>`
-> KNOWLEDGE_NOT_FOUND / ACQUIRE_KNOWLEDGE
-> bounded code inspection
-> `legora knowledge acquire`
-> second `legora entry <question>`
-> READY
-> grounded answer
```

No direct write to `.legora/repository-knowledge.json` is permitted.

- [ ] **Step 1: Preflight real user-scope targets with dry-run**

Run installed:

```text
legora bootstrap --agent all --dry-run --json
```

If any physical target is `CONFLICT`, stop the live gate and report the exact conflict; do not overwrite it. If publishable, run explicit bootstrap and then `legora doctor --json`.

- [x] **Step 2: Codex explicit activation gate**

Use installed `codex-cli 0.147.0` (or record the actual version if changed). Run non-interactively with `codex exec --json -C <external-repo>` and a prompt that explicitly invokes `$legora` and asks the common question. Preserve the JSONL event stream.

PASS requires observable command/tool events proving the common invariant and a final answer that distinguishes repository fact from inference. Host auth/network failure is recorded as `LIVE_GATE_BLOCKED_BY_HOST_AUTH_OR_NETWORK`, not PASS.

- [x] **Step 3: Codex implicit-trigger gate**

Reset the external repo. Ask the same question naturally without `$legora`. PASS only if the trace shows the Legora Skill/runtime workflow anyway. Failure here is an implicit-trigger compatibility failure even if explicit activation passed.

- [ ] **Step 4: Claude Code explicit activation gate**

Use installed Claude Code `2.1.45` (or actual current version). Prefer `claude -p --output-format stream-json --verbose` in the external repo with a prompt that says to use the `legora` Skill explicitly. Capture stream events and require the common invariant.

- [ ] **Step 5: Claude Code implicit-trigger gate**

Reset the repo and ask the same natural-language question without naming Legora. Require actual Legora workflow in the stream trace.

- [ ] **Step 6: Gemini deterministic discovery gate**

First run:

```text
gemini skills list --all
```

PASS requires a `legora [Enabled]` entry whose Location is the shared managed `$HOME/.agents/skills/legora/SKILL.md`. Authentication warnings may be recorded separately if the local listing still succeeds.

- [ ] **Step 7: Gemini explicit and implicit live gates**

Use `gemini -p <prompt> --output-format stream-json` (or the exact current equivalent if the installed CLI syntax changed) in the reset external repo. Run one explicit `legora` Skill request and one natural implicit trigger. Require the common invariant for both.

If the currently observed `UNSUPPORTED_CLIENT` host-auth state prevents the model session, record `LIVE_GATE_BLOCKED_BY_HOST_AUTH_OR_NETWORK`; do not convert the local `skills list` success into semantic compatibility PASS.

- [ ] **Step 8: Evaluate cross-agent parity**

For every successful agent trace, compare only these semantics:

```text
Entry first
ACQUIRE/REFRESH obeyed
READY before grounded answer
no direct authoritative store edit
bounded evidence acquisition
same Repository Knowledge / Behavior Slice authority
```

Do not compare wording, file-read order, token count, reasoning path, or answer identity.

- [ ] **Step 9: Write `docs/validation/r5-agent-compatibility.md`**

Record:

```text
package/Legora version
Codex/Claude/Gemini versions
physical Skill targets and managed payload digest
explicit/implicit result per agent
host block vs compatibility failure distinction
trace evidence for first Entry / acquire / READY ordering
repository-isolation result
Gate C/D/E/F verdicts
```

Do not include credentials, session identifiers, auth tokens, or full private agent logs.

- [ ] **Step 10: Final completion gate**

Only if deterministic Gates 0/A/B/G/H and live Gates C/D/E/F are all PASS:

```text
R5_COMPLETE
```

Then update README to claim observed compatibility specifically for the tested agent versions, and update the R5 spec status to `Implemented and validated as R5_COMPLETE`.

If even one live agent is blocked or fails, final status remains `R5_NOT_COMPLETE`; document the exact remaining gate instead of weakening the criterion.

- [ ] **Step 11: Final fresh verification before integrated review**

Re-run the complete deterministic suite from Task 8 on the exact final tree, `git diff --check`, package dry-run, public neutrality, placeholder scan, artifact hygiene, and working-tree/staged status. Do not stage or commit.

## Final Review Criteria

Before requesting commit approval, review the complete diff against these questions:

1. Is `skills/legora/` the only full semantic Skill source?
2. Can bootstrap prove ownership before every overwrite?
3. Can any interrupted update destroy the previous managed Skill without rollback evidence?
4. Can one conflicting physical target cause writes to another target before the conflict is known?
5. Does Doctor ever mutate user scope or claim Codex/Claude native discovery from path presence?
6. Does Gemini confirmation require an enabled entry at the expected managed location?
7. Do existing Entry/Knowledge commands retain their JSON and exit-code contracts?
8. Does package installation remain independent of target repositories and development dependencies?
9. Are Codex/Claude/Gemini semantic differences limited to host discovery/validation adapters only?
10. Is `R5_COMPLETE` withheld unless all three real live agent gates succeed?

No commit or push follows automatically from implementation completion; final integrated diff review and explicit user approval are required.
