# R4 External Repository Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Do not dispatch subagents for this project. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove that Legora works as a standalone, provider-neutral coding-agent tool against a repository that does not contain Legora source or dependencies, and replace the current development-runtime CLI packaging with a production JavaScript package boundary.

**Architecture:** R4 is verification-first. Gate 0 produces a packed Legora CLI that runs as plain Node.js without `tsx` or TypeScript in the consumer repository. Deterministic external-repository tests then prove the acquire/READY/stale/refresh lifecycle, repository isolation, bounded authoritative knowledge, and fail-closed behavior. Only after those gates pass do we run one live coding-agent pilot and evaluate Human Understanding quality.

**Tech Stack:** Node.js ESM, TypeScript 5.7+, Node test runner, npm package/tarball tooling, filesystem/process APIs, existing Legora CLI and Repository Knowledge runtime.

**Spec:** `docs/superpowers/specs/2026-08-22-r4-external-repository-validation-design.md`

## Global Constraints

- R4 is a validation release, not an AI-runtime or indexing release.
- Canonical deterministic proof executes Legora through its public installed CLI process from a repository outside the Legora source tree.
- The target repository must not contain Legora source, `tsx`, TypeScript, Cartographer, MCP configuration, or a local `node_modules/legora` dependency.
- Normal Legora operation may persist only `.legora/repository-knowledge.json` in the target repository. Do not auto-edit `.gitignore`, `package.json`, lockfiles, source, or agent configuration.
- Acquisition proposals contain candidate identity, vendor-neutral structure, and evidence locators only. They do not author snippets, history, timestamps, ACTIVE/HISTORY transitions, or `CONFIRMED` evidence.
- Do not require whole-repository analysis. The deterministic boundedness criterion is that unrelated code does not become persisted authoritative Repository Knowledge.
- Public Skill/CLI surfaces remain provider- and coding-agent-neutral.
- R4 live validation uses one coding agent only. Multi-agent compatibility is follow-up work.
- No subagents or parallel agents.
- Do not commit or push unless the user explicitly approves it.
- Preserve all existing R1-R3 behavior and existing real Cartographer compatibility tests.

## Spec-to-Task Coverage

| R4 Gate | Proof location |
| --- | --- |
| Gate 0 — Standalone Packaging / Invocation | Task 1 |
| Gate A — External Native CLI Lifecycle | Tasks 2–3 |
| Gate B — Target Repository Isolation | Task 4 |
| Gate C — Bounded Knowledge Publication | Task 4 |
| Gate D — External Fail-Closed Boundaries | Task 5 |
| Gate E — Live Coding-Agent Pilot | Task 7 |
| Gate F — Human Understanding Acceptance | Task 8 |

Task 6 is the deterministic aggregate/regression gate spanning Gates 0–D. `R4_COMPLETE` requires every Gate 0/A/B/C/D/E/F to pass; a skipped or unobserved required Gate is not a PASS.

## File Structure

- `tsconfig.build.json`
  - Production emit config for `src/**/*.ts` only. It keeps the main no-emit typecheck config unchanged and uses TypeScript's relative-import-extension rewrite for runnable JavaScript output.
- `scripts/build.mjs`
  - Cross-platform build coordinator. It deletes `dist/`, invokes the repository-local TypeScript compiler, and writes the plain-Node production CLI launcher.
- `tests/integration/r4/helpers.ts`
  - Creates isolated R4 workspaces, packs/installs Legora under a tool home, executes the installed CLI with an external repository as `cwd`, copies fixtures, parses JSON stdout, and inventories repositories. It must not import Legora production modules.
- `tests/integration/r4/standalone-package.test.ts`
  - Proves Gate 0 standalone installation/invocation and package-content isolation.
- `tests/integration/r4/external-native-loop.test.ts`
  - Proves public CLI `NOT_FOUND → ACQUIRE → READY → STALE → REFRESH → READY`.
- `tests/integration/r4/external-boundaries.test.ts`
  - Proves target-repository isolation, bounded authoritative publication, and fail-closed adversarial input.
- `tests/fixtures/r4/external-repository/`
  - Small router/auth/billing/decoy fixture copied into temporary external repositories.
- `docs/validation/r4-live-pilot.md`
  - Defines and records the one-agent live pilot and Human Understanding acceptance evidence.
- `package.json`
  - Points `bin.legora` at production `dist`, restricts packed files, and adds `build`, `prepack`, and `test:integration:r4` scripts.
- `package-lock.json`
  - Update root package metadata if npm changes it after `package.json` changes. Do not add a production dependency on `tsx`.
- `README.md`
  - Update only after all R4 gates pass.

The packed production package must not require `tsx` or TypeScript at runtime. `tsx` and TypeScript remain development/test dependencies only.

---

### Task 1: Production JavaScript Build and Standalone Package Gate

**Files:**
- Create: `tsconfig.build.json`
- Create: `scripts/build.mjs`
- Create: `tests/integration/r4/helpers.ts`
- Create: `tests/integration/r4/standalone-package.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json` if npm rewrites root package metadata

**Interfaces:**
- `npm run build` deletes `dist/`, emits `src/**/*.ts` as JavaScript under `dist/`, rewrites relative `.ts` import extensions to `.js`, and writes `dist/cli/bin.mjs` as a plain Node launcher.
- `package.json#bin.legora` becomes `./dist/cli/bin.mjs`.
- `createR4Workspace(): Promise<R4Workspace>` returns absolute `root`, `toolHome`, and `targetRepository` paths.
- `installPackedLegora(workspace: R4Workspace): Promise<InstalledLegora>` packs the current project, installs the tarball under `toolHome`, removes the temporary tarball, and returns the installed executable path.
- `runInstalledLegora(installed: InstalledLegora, targetRepository: string, args: string[], stdin?: string): Promise<{ exitCode: number; stdout: string; stderr: string; data: unknown }>` executes only the installed CLI with `cwd = targetRepository`.

- [ ] **Step 1: Write the standalone-package test against the current package boundary**

Create an isolated workspace and assert:

```ts
const workspace = await createR4Workspace();
const installed = await installPackedLegora(workspace);

assert.equal(await exists(path.join(workspace.targetRepository, "node_modules")), false);
assert.equal(await exists(path.join(workspace.targetRepository, "package-lock.json")), false);
assert.equal(installed.executable.startsWith(workspace.toolHome), true);

const result = await runInstalledLegora(
  installed,
  workspace.targetRepository,
  ["entry", "request routing"],
);
assert.equal(result.exitCode, 3);
assert.equal((result.data as { status?: string }).status, "KNOWLEDGE_NOT_FOUND");
```

- [ ] **Step 2: Run the current package test and capture RED**

Run:

```bash
node --import tsx --test tests/integration/r4/standalone-package.test.ts
```

Expected current-baseline failure: packed `bin` points at `src/cli/bin.mjs`, which imports `tsx/esm/api`; `tsx` is not a production dependency and therefore the installed CLI is not a valid standalone consumer boundary.

- [ ] **Step 3: Add exact production TypeScript emit configuration**

Create `tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "outDir": "dist",
    "rootDir": "src",
    "allowImportingTsExtensions": true,
    "rewriteRelativeImportExtensions": true,
    "declaration": false,
    "sourceMap": false
  },
  "include": ["src/**/*.ts"],
  "exclude": ["tests", "docs", "dist"]
}
```

Do not modify the main `tsconfig.json`; its `noEmit` typecheck contract remains canonical for development.

- [ ] **Step 4: Add cross-platform `scripts/build.mjs`**

Implement this behavior:

```js
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
await fs.rm(dist, { recursive: true, force: true });

const require = createRequire(import.meta.url);
const tsc = require.resolve("typescript/bin/tsc");
const compile = spawnSync(process.execPath, [tsc, "-p", "tsconfig.build.json"], {
  cwd: root,
  stdio: "inherit",
});
if (compile.status !== 0) process.exit(compile.status ?? 1);

const launcher = `#!/usr/bin/env node
const { runCliCommand } = await import("./index.js");

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
    process.stdout.write(\`${JSON.stringify(result.data)}\\n\`);
    process.exitCode = result.exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(\`${JSON.stringify({ status: "INTERNAL_ERROR", message })}\\n\`);
    process.exitCode = 1;
  }
}

await main();
`;

await fs.mkdir(path.join(dist, "cli"), { recursive: true });
await fs.writeFile(path.join(dist, "cli", "bin.mjs"), launcher, { mode: 0o755 });
```

When implementing the template string, escape nested template interpolation so the generated launcher—not the build script—evaluates `JSON.stringify(result.data)` and the error object.

- [ ] **Step 5: Change package metadata to production artifacts**

Merge these exact fields while preserving current scripts and devDependencies:

```json
{
  "bin": {
    "legora": "./dist/cli/bin.mjs"
  },
  "files": [
    "dist",
    "SKILL.md",
    "references"
  ],
  "scripts": {
    "build": "node scripts/build.mjs",
    "prepack": "npm run build"
  }
}
```

Do not move `tsx` or TypeScript into production dependencies.

- [ ] **Step 6: Implement isolated pack/install helpers**

`installPackedLegora()` executes:

```text
npm pack --json
→ parse filename from JSON output
→ npm install --prefix <toolHome> --no-audit --no-fund <absolute-tarball-path>
→ locate <toolHome>/node_modules/.bin/legora.cmd on Windows or .../.bin/legora elsewhere
→ remove the generated tarball from the Legora project root in finally
```

No package command may use the target repository as installation prefix or package-manager working directory.

- [ ] **Step 7: Verify Gate 0 GREEN and inspect the actual tarball manifest**

Run:

```bash
node --import tsx --test tests/integration/r4/standalone-package.test.ts
npm run typecheck
npm pack --dry-run
```

Expected: PASS. Dry-run output must contain `dist/cli/bin.mjs`, required `dist/**/*.js`, `SKILL.md`, and `references/`; it must not contain tests, `.legora`, caches, temporary tarballs, or `src/cli/bin.mjs`.

- [ ] **Step 8: Stop without commit**

Keep Task 1 changes uncommitted.

---

### Task 2: External Public-CLI Acquire → READY Lifecycle

**Files:**
- Create: `tests/fixtures/r4/external-repository/src/router.ts`
- Create: `tests/fixtures/r4/external-repository/src/auth.ts`
- Create: `tests/fixtures/r4/external-repository/src/billing.ts`
- Create: `tests/fixtures/r4/external-repository/src/decoy.ts`
- Create: `tests/fixtures/r4/external-repository/package.json`
- Create: `tests/integration/r4/external-native-loop.test.ts`
- Modify: `tests/integration/r4/helpers.ts`

**Interfaces:**
- Consumes `installPackedLegora()` and `runInstalledLegora()` from Task 1.
- Produces `copyExternalFixture(targetRepository: string): Promise<void>`.
- The test must not import `src/entry.ts`, acquisition service, store, validator, projector, or any Legora runtime module.

- [ ] **Step 1: Create the external fixture**

`src/router.ts`:

```ts
export function routeRequest(path: string): "auth" | "billing" {
  return path.startsWith("/auth") ? "auth" : "billing";
}
```

`src/auth.ts`:

```ts
export function authorize(token: string): boolean {
  return token.length > 0;
}
```

`src/billing.ts`:

```ts
export function charge(cents: number): number {
  return Math.max(0, cents);
}
```

`src/decoy.ts`:

```ts
export const documentationPhrase = "request routing historical note";
```

`package.json`:

```json
{
  "name": "legora-r4-external-fixture",
  "private": true,
  "type": "module"
}
```

- [ ] **Step 2: Write the external lifecycle test through installed CLI only**

First call:

```ts
const missing = await runInstalledLegora(installed, repo, ["entry", "request routing"]);
assert.equal(missing.exitCode, 3);
assert.equal((missing.data as any).status, "KNOWLEDGE_NOT_FOUND");
assert.equal((missing.data as any).nextAction?.type, "ACQUIRE_KNOWLEDGE");
```

Submit via stdin:

```json
{
  "candidates": [
    {
      "id": "native:entity:router",
      "kind": "entity:service",
      "subject": "request router",
      "structure": { "type": "ENTITY", "entityKind": "service", "name": "router" },
      "evidenceLocators": [{ "filePath": "src/router.ts", "lineStart": 1, "lineEnd": 3 }]
    },
    {
      "id": "native:flow:routing",
      "kind": "behavior-flow:routing",
      "subject": "request routing",
      "structure": {
        "type": "BEHAVIOR_FLOW",
        "flowKind": "routing",
        "name": "Request routing",
        "steps": [{ "entityId": "native:entity:router", "label": "Route request" }]
      },
      "evidenceLocators": [{ "filePath": "src/router.ts", "lineStart": 1, "lineEnd": 3 }]
    }
  ]
}
```

Assert:

```ts
assert.equal(acquire.exitCode, 0);
assert.equal((acquire.data as any).status, "ACQUIRED");

const ready = await runInstalledLegora(installed, repo, ["entry", "request routing"]);
assert.equal(ready.exitCode, 0);
assert.equal((ready.data as any).status, "READY");
assert.equal((ready.data as any).behaviorSlice?.owner, "LEGORA");
assert.equal((ready.data as any).nextAction, null);
```

- [ ] **Step 3: Run lifecycle test**

Run:

```bash
node --import tsx --test tests/integration/r4/external-native-loop.test.ts
```

Expected final result: PASS for `NOT_FOUND → ACQUIRE → READY` without any internal runtime import.

- [ ] **Step 4: Stop without commit**

Keep Task 2 changes uncommitted.

---

### Task 3: External STALE → REFRESH → READY and HISTORY Proof

**Files:**
- Modify: `tests/integration/r4/external-native-loop.test.ts`

**Interfaces:**
- Uses only installed CLI commands and direct JSON reading of `.legora/repository-knowledge.json`.
- Public exit-code contract is fixed: `KNOWLEDGE_STALE=4`, `KNOWLEDGE_UNKNOWN=5`, `KNOWLEDGE_NOT_FOUND=3`, acquisition semantic rejection=`6`.

- [ ] **Step 1: Mutate the external routing source after initial READY**

Rewrite temporary `src/router.ts` to:

```ts
export function routeRequest(path: string): "auth" | "billing" {
  return path === "/login" ? "auth" : "billing";
}
```

Then assert:

```ts
const stale = await runInstalledLegora(installed, repo, ["entry", "request routing"]);
assert.equal(stale.exitCode, 4);
assert.equal((stale.data as any).status, "KNOWLEDGE_STALE");
assert.equal((stale.data as any).nextAction?.type, "REFRESH_KNOWLEDGE");
assert.deepEqual(
  [...(stale.data as any).nextAction.recordIds].sort(),
  ["native:entity:router", "native:flow:routing"].sort(),
);
```

- [ ] **Step 2: Refresh through acquisition stdin and return to READY**

Re-submit the same candidate IDs and line range. Assert acquire exit `0`, then Entry exit `0` and status `READY`.

- [ ] **Step 3: Prove HISTORY externally**

Read the store using `fs.readFile` and assert for both records:

```ts
assert.equal(record.history.length, 1);
assert.notEqual(record.history[0][0].snippet, record.activeEvidence[0].snippet);
assert.equal(record.activeEvidence[0].snippet.includes("path === \"/login\""), true);
```

- [ ] **Step 4: Run complete lifecycle test**

```bash
node --import tsx --test tests/integration/r4/external-native-loop.test.ts
```

Expected: PASS for `NOT_FOUND → ACQUIRE → READY → STALE → REFRESH → READY`.

- [ ] **Step 5: Stop without commit**

Keep Task 3 changes uncommitted.

---

### Task 4: Target Repository Isolation and Bounded Authoritative Knowledge

**Files:**
- Create: `tests/integration/r4/external-boundaries.test.ts`
- Modify: `tests/integration/r4/helpers.ts`

**Interfaces:**
- Produces `inventoryRepository(root: string): Promise<string[]>` returning normalized relative paths.
- Consumes standalone package and fixture helpers.

- [ ] **Step 1: Implement deterministic repository inventory**

Recursively inventory every target-repository path except ephemeral OS metadata. Normalize separators to `/`. Do not ignore `.legora`, package files, `node_modules`, or agent configuration because these are the isolation surface.

- [ ] **Step 2: Write repository-isolation assertions**

Capture inventory before and after acquisition. Persistent additions must be exactly:

```text
.legora/
.legora/repository-knowledge.json
```

If the helper inventories files only, expected additions are exactly `.legora/repository-knowledge.json`.

Assert `.legora/.repository-knowledge.lock` is absent after every completed command. Assert fixture `package.json` and every `src/*` file remain byte-identical.

- [ ] **Step 3: Write bounded-publication assertions**

Read persisted records and assert:

```ts
assert.deepEqual(
  records.map((record: any) => record.id).sort(),
  ["native:entity:router", "native:flow:routing"].sort(),
);
assert.equal(records.some((record: any) => JSON.stringify(record).includes("documentationPhrase")), false);
assert.equal(records.some((record: any) => record.id.includes("billing")), false);
```

Do not claim the agent never reads unrelated files; this deterministic gate controls what becomes authoritative Knowledge.

- [ ] **Step 4: Run isolation/boundedness test**

```bash
node --import tsx --test tests/integration/r4/external-boundaries.test.ts
```

Expected: PASS.

- [ ] **Step 5: Stop without commit**

Keep Task 4 changes uncommitted.

---

### Task 5: Public-CLI Fail-Closed Adversarial Boundaries

**Files:**
- Modify: `tests/integration/r4/external-boundaries.test.ts`

**Interfaces:**
- Uses installed CLI only.
- Every rejected semantic acquisition exits `6` and leaves the persistent store byte-for-byte equal to its pre-command snapshot.
- Malformed acquisition JSON exits `2`.

- [ ] **Step 1: Add malformed and empty acquisition cases**

```ts
const malformed = await runInstalledLegora(installed, repo, ["knowledge", "acquire"], "{");
assert.equal(malformed.exitCode, 2);

const empty = await runInstalledLegora(
  installed,
  repo,
  ["knowledge", "acquire"],
  JSON.stringify({ candidates: [] }),
);
assert.equal(empty.exitCode, 6);
```

- [ ] **Step 2: Add evidence-path and locator cases**

Test separate proposals using:

```text
absolute path inside repository
../outside.ts
junction/symlink inside repository resolving outside
lineStart = 0
lineStart = 1.5
lineEnd < lineStart
```

Each semantic rejection exits `6` and preserves the pre-command store. If the OS denies symlink/junction creation, mark only that case skipped with the actual OS error code in the skip reason.

- [ ] **Step 3: Add structural-integrity cases**

Reject and preserve the prior store for:

```text
relationship referencing missing entity
behavior flow referencing missing entity
update replacing a referenced ENTITY with BEHAVIOR_FLOW
```

For the update case, first acquire valid referenced knowledge, snapshot the store, then submit the invalid replacement under the same entity ID.

- [ ] **Step 4: Run adversarial external test**

```bash
node --import tsx --test tests/integration/r4/external-boundaries.test.ts
```

Expected: PASS with all invalid requests fail-closed.

- [ ] **Step 5: Stop without commit**

Keep Task 5 changes uncommitted.

---

### Task 6: R4 Deterministic Gate Script and Artifact Hygiene

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` if npm rewrites root package metadata

**Interfaces:**
- Produces `test:integration:r4 = node --import tsx --test tests/integration/r4/*.test.ts`.
- Existing typecheck/unit/real integration scripts keep their current meaning.

- [ ] **Step 1: Add the R4 script**

Merge:

```json
"test:integration:r4": "node --import tsx --test tests/integration/r4/*.test.ts"
```

- [ ] **Step 2: Run deterministic R4 and full regression gate**

```bash
npm run typecheck
npm test
npm run test:integration:cartographer-real
npm run test:integration:causal-real
npm run test:integration:r4
```

Every command must PASS.

- [ ] **Step 3: Verify artifact hygiene**

After tests require:

```text
no *.tgz remains in project root
no temporary R4 tool-home or target repository exists under project root
no R4-generated .legora data exists in the Legora repository
no package/test command changed node_modules as a Git diff
dist/ is not accidentally staged as source
```

Run `git diff --check`, placeholder scan, and the same public provider/vendor-neutrality scan used by R3.

- [ ] **Step 4: Stop without commit**

Keep Task 6 changes uncommitted.

---

### Task 7: Live Coding-Agent Pilot Procedure and Observed Run

**Files:**
- Create: `docs/validation/r4-live-pilot.md`
- Do not install Legora into the chosen pilot repository.

**Interfaces:**
- Consumes the standalone installed Legora executable that passed Tasks 1-6.
- Produces these pilot fields:

```text
repository
question
agent
entry_first
acquisition_handshake
ready_before_grounded_output
published_record_ids
source_files_in_active_evidence
pre_run_repository_state
post_run_repository_state
explain_acceptance
explore_acceptance
verify_acceptance
result
notes
```

- [ ] **Step 1: Write the pilot procedure before the run**

The document instructs the operator to:

1. choose one real repository outside the Legora source tree;
2. capture pre-run Git/inventory state;
3. expose Legora `SKILL.md` and `references/` through the coding agent's normal skill-loading mechanism without adding vendor-specific behavior to Legora;
4. ask one behavior-flow question with a repository-grounded answer;
5. record whether the first Legora command is `legora entry`;
6. record acquire/refresh CLI JSON statuses;
7. record persisted record IDs and active-evidence file paths;
8. record whether grounded output waits for READY;
9. record the user-visible intervention and post-run repository state.

- [ ] **Step 2: Run exactly one coding-agent pilot**

Use one agent and one real behavior question. Do not expand R4 into a multi-agent or multi-repository benchmark.

- [ ] **Step 3: Record observable evidence only**

Allowed evidence:

```text
commands invoked
CLI JSON output
persisted record IDs
active-evidence file paths
user-visible final output
pre/post repository state
```

Do not collect private chain-of-thought.

- [ ] **Step 4: Mark Gate E**

PASS requires all:

```text
entry_first = true
requested acquisition/refresh handshake followed
repository-grounded output withheld until READY
no direct authoritative .legora store edit by the agent
published Knowledge bounded to the question
```

On failure record `R4_NOT_COMPLETE` and classify the blocker as `PACKAGING_INVOCATION`, `SKILL_ORCHESTRATION`, or `RUNTIME_CONTRACT`.

- [ ] **Step 5: Stop without commit**

Do not commit a PASS claim before observed pilot evidence exists.

---

### Task 8: Human Understanding Acceptance and R4 Closure

**Files:**
- Modify: `docs/validation/r4-live-pilot.md`
- Modify: `README.md` only after proven R4 completion

**Interfaces:**
- Consumes deterministic Gates 0/A/B/C/D and live Gate E.
- Produces final verdict exactly `R4_COMPLETE` or `R4_NOT_COMPLETE`.

- [ ] **Step 1: Evaluate Explain acceptance**

PASS only if all are true:

```text
simple mental model precedes unnecessary implementation detail
formal repository terminology remains connected to the mental model
execution/control flow is understandable
repository fact is distinguishable from inference/general analogy
unsupported repository claims are absent or explicitly unknown
```

- [ ] **Step 2: Evaluate Explore acceptance**

If Explore is useful, verify it fabricates no executable behavior and Prediction/Microworld obey existing executable-evidence gates. Otherwise record `NOT_REQUIRED` instead of forcing Explore.

- [ ] **Step 3: Evaluate Verify acceptance**

If Verify is requested or useful, verify it judges only observable current-conversation understanding and makes no permanent-mastery claim or binary-only evaluation. Otherwise record `NOT_REQUIRED`.

- [ ] **Step 4: Verify live target-repository isolation**

The post-run repository may contain `.legora/repository-knowledge.json`; it must not contain new Legora dependencies, source/package changes, agent-specific config, or other persistent Legora files caused by the tool.

- [ ] **Step 5: Run final fresh regression**

```bash
npm run typecheck
npm test
npm run test:integration:cartographer-real
npm run test:integration:causal-real
npm run test:integration:r4
```

Every command must PASS from the final tree.

- [ ] **Step 6: Update README only after all gates pass**

If Gates 0, A, B, C, D, E, and F all pass, update status to say standalone external-repository validation R4 passed. Do not claim multi-agent compatibility, remote repository support, benchmark superiority, or whole-repository zero-cost understanding.

- [ ] **Step 7: Final static/Git review**

Require:

```text
R4 deterministic gate              PASS
Live coding-agent pilot            PASS
Human Understanding acceptance     PASS
Target repository isolation        PASS
Public provider neutrality         PASS
Placeholder scan                   PASS
diff --check                       PASS
```

Report `R4_COMPLETE` only when every line passes; otherwise report `R4_NOT_COMPLETE` with the first blocking gate and observed evidence.

- [ ] **Step 8: Stop before commit/push**

Do not stage, commit, or push. Present final diff and verification evidence for explicit user approval.
