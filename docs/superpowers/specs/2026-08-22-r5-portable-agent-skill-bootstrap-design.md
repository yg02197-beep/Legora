# R5 Portable Agent Skill & Bootstrap Design

Date: 2026-08-22
Status: Implemented with partial live validation — Codex PASS; Claude Code and Gemini CLI NOT_RUN; overall R5_NOT_COMPLETE

## 1. Purpose

R5 turns the R4 standalone runtime into a product a user can activate once and then use from supported coding agents without modifying each target repository.

R4 already proved that a packed Legora CLI can run against an unrelated repository, acquire evidence-bounded Repository Knowledge, reach READY, preserve stale/refresh semantics, and produce a useful grounded explanation through one coding-agent pilot. R5 does not redesign that runtime. It adds a portable Agent Skill distribution boundary, deterministic user-scope bootstrap/diagnostics, and live compatibility proof across Codex, Claude Code, and Gemini CLI.

The intended user journey is:

```text
install Legora CLI
  -> legora bootstrap
  -> open a repository in a supported coding agent
  -> ask a repository-understanding question normally
  -> agent discovers Legora Skill
  -> legora entry
  -> acquire/refresh when required
  -> READY
  -> Explain / Explore / Verify
```

R5 is complete only when the same canonical Legora Skill is discoverable through supported native Agent Skills mechanisms and the R2-R4 runtime authority boundary remains unchanged.

## 2. Verified external contracts as of 2026-08-22

R5 treats these as host integration facts, not as Legora-owned semantics.

### Agent Skills open specification

A Skill is a directory containing `SKILL.md`. `SKILL.md` must have YAML frontmatter and Markdown instructions. `name` and `description` are required. `name` must match the parent directory name and use lowercase alphanumeric characters and hyphens. `description` must describe both what the Skill does and when to use it. Relative references should resolve from the Skill root.

Reference: https://agentskills.io/specification

### Codex

Current OpenAI documentation states that Codex reads user skills from `$HOME/.agents/skills`. Repository skills are discovered from `.agents/skills` while walking from the current working directory to the repository root. Codex can explicitly invoke a Skill through `/skills` or `$<skill-name>`, and can implicitly select one from its `description`.

OpenAI documentation also recommends plugins as the reusable distribution unit for broader Codex/ChatGPT distribution. R5 intentionally does not adopt a Codex-only plugin as the canonical Legora package because Legora's product boundary is cross-agent. A future Codex plugin may wrap the same canonical Skill without changing its semantics.

Reference: https://developers.openai.com/codex/skills

Locally verified Codex CLI: `codex-cli 0.147.0`.

### Claude Code

Anthropic documents personal custom Skills under `~/.claude/skills/` and project Skills under `.claude/skills/`. Claude Code discovers custom `SKILL.md` directories automatically. The same required `name` and `description` frontmatter applies.

Reference: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview

Locally verified Claude Code: `2.1.45`.

### Gemini CLI

Gemini CLI documents user Skills under `~/.gemini/skills/` or the interoperable `~/.agents/skills/` alias, and workspace Skills under `.gemini/skills/` or `.agents/skills/`. Within the same tier, `.agents/skills/` takes precedence over `.gemini/skills/`. Gemini exposes deterministic Skill management through `gemini skills`, including `gemini skills list`.

References:
- https://geminicli.com/docs/cli/skills/
- https://geminicli.com/docs/cli/using-agent-skills/

Locally verified Gemini CLI package: `@google/gemini-cli@0.34.0`. Local `gemini skills --help` confirms `list`, `enable`, `disable`, `install`, `link`, and `uninstall` commands.

## 3. Core design decision: one canonical Skill

Legora must not maintain vendor-specific workflow copies.

Canonical source:

```text
skills/
└─ legora/
   ├─ SKILL.md
   └─ references/
      ├─ explain.md
      ├─ explore.md
      └─ verify.md
```

`skills/legora/` is the only authoritative Agent Skill source in R5.

Forbidden architecture:

```text
skills/codex-legora/
skills/claude-legora/
skills/gemini-legora/
```

Agent differences may affect only discovery/install locations and compatibility probing. They must not alter acquisition rules, readiness rules, Repository Knowledge authority, Behavior Slice ownership, Explain/Explore/Verify semantics, or safety boundaries.

## 4. Canonical Skill metadata

The canonical Skill begins with standards-compliant YAML frontmatter.

Required shape:

```yaml
---
name: legora
description: Understand how a repository behaves using current source evidence. Use for questions about code flow, responsibilities, states, causality, failures, interactions, or when a user wants to understand why repository behavior occurs.
metadata:
  legora-managed: "true"
  legora-skill-schema: "1"
---
```

The exact `description` may be refined during implementation tests, but it must remain provider-neutral and must clearly encode both capability and trigger conditions.

The Skill body preserves the R3 contract:

1. Entry first.
2. Follow ACQUIRE_KNOWLEDGE / REFRESH_KNOWLEDGE exactly.
3. Do not make Legora-grounded repository claims before READY.
4. Agents submit candidate structure and evidence locators, not authoritative snippets/history/timestamps/confidence.
5. Choose the smallest useful Explain / Explore / Verify intervention after READY.
6. Do not force whole-repository pre-analysis.

## 5. Migration from the current root Skill

R3/R4 currently use root `SKILL.md` plus root `references/`. R5 moves authority to `skills/legora/`.

To avoid two editable authoritative copies, the root files must not continue as a second full source of truth.

R5 migration contract:

```text
skills/legora/SKILL.md               authoritative
skills/legora/references/*.md        authoritative
SKILL.md                             compatibility pointer only
references/                          removed after callers/tests migrate
```

The root compatibility `SKILL.md` may tell pre-R5/manual consumers to use `skills/legora/SKILL.md`, but it must not duplicate the full workflow. Tests must assert that public packaging and bootstrap consume only the canonical Skill directory.

If implementation proves that retaining root `references/` is required for a currently supported public consumer, R5 must stop for design review rather than silently introducing duplicated authoritative content.

## 6. Package boundary

The npm-compatible Legora package must contain both the standalone runtime and canonical Skill:

```text
dist/
skills/legora/
README.md
package.json
```

It must not require `tsx`, TypeScript, Legora source, tests, or target-repository dependencies at runtime.

R5 makes the package publishable/installable as a release artifact, but actual publication to a public registry is a separate explicit release action. R5 validation may use `npm pack` and isolated install prefixes and must not require `npm publish`.

Target repositories remain dependency-free with respect to Legora.

## 7. User-scope bootstrap topology

R5 uses at most two physical Skill installations for the three supported agents.

### Shared portable target: Codex + Gemini

```text
$HOME/.agents/skills/legora/
```

This one copy is used by:

- Codex user-scope Skill discovery;
- Gemini CLI's documented `.agents/skills` user-scope alias.

R5 must not use the older `$CODEX_HOME/skills` / `~/.codex/skills` location as its primary install target. It may diagnose legacy copies and report them, but it must not create or update them by default.

### Claude target

```text
$HOME/.claude/skills/legora/
```

This is a second managed copy of the same canonical Skill bytes.

No bootstrap operation writes `.agents`, `.claude`, `.gemini`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, package manifests, or config files inside the current target repository.

## 8. Bootstrap command contract

Public commands:

```text
legora bootstrap
legora bootstrap --agent codex
legora bootstrap --agent claude
legora bootstrap --agent gemini
legora bootstrap --agent all
legora bootstrap --dry-run
legora bootstrap --json
```

### Default behavior

Bare `legora bootstrap`:

1. detects supported agent executables available on PATH;
2. resolves the required user-scope install targets;
3. deduplicates Codex + Gemini to one `$HOME/.agents/skills/legora` write;
4. installs or updates only managed Legora Skill copies;
5. reports exact outcomes per agent and per physical target.

The user's explicit `legora bootstrap` invocation is the consent boundary for user-scope Skill installation. Bootstrap must not run implicitly from `legora entry`, package install hooks, or repository commands.

### Explicit agent behavior

`--agent <name>` targets that agent even if its executable is not currently detected. This allows pre-provisioning a Skill before the agent is installed. The result must distinguish `SKILL_INSTALLED` from `AGENT_EXECUTABLE_NOT_FOUND`.

`--agent all` targets all three supported agents and still performs at most two physical writes.

### No network

Bootstrap copies only Skill files already contained in the installed Legora package. It must not clone Git repositories, call package registries, download plugins, or invoke remote APIs.

## 9. Managed-copy safety and update semantics

Bootstrap owns only copies that it can prove were installed by Legora.

Each managed target contains an implementation-private manifest such as:

```text
.legora-install.json
```

The manifest records at minimum:

- manifest schema version;
- Legora package version;
- canonical Skill payload digest, computed only from canonical Skill files and excluding `.legora-install.json` itself;
- managed canonical relative file paths and digests.

State machine:

```text
ABSENT
  -> INSTALL

PRESENT + valid Legora manifest + installed managed files match the manifest + canonical digest is unchanged
  -> NO_CHANGE

PRESENT + valid Legora manifest + installed managed files match the manifest + packaged canonical digest changed
  -> MANAGED_UPDATE

PRESENT + no valid Legora manifest
  -> CONFLICT

PRESENT + manifest exists but managed files were locally modified
  -> CONFLICT
```

Bootstrap must never overwrite an unowned `legora` Skill directory or silently destroy local modifications.

An identical-looking directory without a valid Legora manifest is still unowned and therefore `CONFLICT`; bootstrap must not silently adopt it.

Publication must be fail-closed. Implementation should stage a complete validated candidate in a sibling temporary directory before replacing a managed installation. If cross-platform atomic directory replacement cannot be proven for an update, implementation must use a rollback-capable bounded replacement protocol and add interruption tests before R5 can pass.

## 10. `legora doctor`

Public commands:

```text
legora doctor
legora doctor --agent codex
legora doctor --agent claude
legora doctor --agent gemini
legora doctor --json
```

Doctor is read-only. It must never install, update, repair, enable, disable, or delete a Skill.

Doctor reports distinct layers instead of collapsing them into a misleading single boolean:

```text
CLI_RUNTIME
CANONICAL_SKILL_FORMAT
AGENT_EXECUTABLE
INSTALL_TARGET
MANAGED_DIGEST
NATIVE_DISCOVERY
OVERALL
```

Example:

```text
Codex
  executable        FOUND
  install_target    CURRENT
  native_discovery  NOT_PROBED

Claude Code
  executable        FOUND
  install_target    CURRENT
  native_discovery  NOT_PROBED

Gemini CLI
  executable        FOUND
  install_target    CURRENT
  native_discovery  CONFIRMED
```

`NOT_PROBED` is not equivalent to failure. It means Doctor has no documented deterministic non-model probe for that host and therefore refuses to infer native discovery merely from file placement.

For Gemini, Doctor may execute the documented local `gemini skills list` command with a bounded timeout and no network requirement. It may report `NATIVE_DISCOVERY=CONFIRMED` only if `legora` appears in the discovered Skill list.

For Codex and Claude Code, R5 Doctor initially validates path, format, ownership, and digest. Native discovery/activation is proven in the live compatibility gates rather than fabricated from filesystem presence.

## 11. Agent compatibility boundary

R5 must preserve a strict distinction between bootstrap compatibility and semantic compatibility.

Bootstrap compatibility means:

- the agent has a documented discovery location;
- the canonical Skill can be installed there without target-repository mutation;
- the Skill is standards-valid;
- where a deterministic native listing exists, the host lists it.

Semantic compatibility means a real agent session actually follows the Legora contract.

The live compatibility evaluation checks behavior, not prose identity.

Required invariant for every supported agent:

```text
Skill discovered/activated
  -> Entry first
  -> acquire/refresh handshake when requested
  -> no authoritative grounded answer before READY
  -> no direct Repository Knowledge store edit
  -> READY
  -> evidence-bounded Explain / Explore / Verify
```

Different exploration order, wording, token use, or reasoning path is allowed.

## 12. Live compatibility gates

Use one external fixture repository plus one real repository question where practical. The target repository must not contain a Legora Skill, Legora dependency, or agent-specific bootstrap files.

### Codex gate

Use installed Codex CLI and user-scope `$HOME/.agents/skills/legora`.

The local CLI exposes `codex exec` for non-interactive runs. The R5 gate should begin with explicit Skill invocation (`$legora`) so discovery failure is distinguishable from implicit-trigger quality. After explicit invocation passes, run one implicit-trigger case based only on the canonical `description`.

### Claude Code gate

Use installed Claude Code and user-scope `~/.claude/skills/legora`.

Claude Code documentation states that filesystem custom Skills are automatically discovered. The gate must prove actual Skill activation in a real session rather than equating directory presence with success. Prefer explicit user invocation/skill naming for the first proof, then one natural-language implicit-trigger case.

### Gemini CLI gate

Use installed Gemini CLI and shared user-scope `$HOME/.agents/skills/legora`.

First require `gemini skills list` to show `legora`. Then use `gemini -p` headless mode for explicit and implicit activation cases.

### Authentication/network failures

Live agent sessions may require existing user authentication and network access. R5 must distinguish:

```text
COMPATIBILITY_FAILED
```

from:

```text
LIVE_GATE_BLOCKED_BY_HOST_AUTH_OR_NETWORK
```

A blocked live gate does not count as compatibility PASS. R5 remains incomplete for that agent until an observable real session is executed successfully.

## 13. Repository isolation

R5 bootstrap is user-scope configuration and must be independent of the repository where the user happens to run the command.

Before/after repository manifests must prove bootstrap and doctor do not create or modify:

- `.agents/`;
- `.claude/`;
- `.gemini/`;
- `AGENTS.md`;
- `CLAUDE.md`;
- `GEMINI.md`;
- package manifests or lockfiles;
- source files.

Normal Legora question execution retains the R4 contract: `.legora/repository-knowledge.json` is the only normal target-repository persistence created by Legora runtime knowledge acquisition.

## 14. Failure handling

R5 must fail closed on at least these cases:

- canonical Skill missing required frontmatter;
- `name` does not match `legora` directory;
- canonical Skill references missing files;
- destination `legora` directory exists but is not Legora-managed;
- managed destination has local modifications;
- managed-copy manifest is malformed;
- staged candidate digest differs from packaged canonical digest;
- unsupported agent name;
- home directory cannot be resolved;
- install target cannot be created;
- agent native discovery command times out;
- live session activates but bypasses Entry/READY authority.

No failure may cause fallback writes into the current repository.

## 15. R5 validation gates

```text
Gate 0  Agent Skills Standard
        canonical skills/legora validates against required structure/frontmatter

Gate A  Distribution
        packed Legora contains standalone CLI + exactly one canonical Legora Skill

Gate B  Bootstrap Safety
        user-scope install/update/no-change/conflict semantics are deterministic and fail-closed

Gate C  Codex Discovery & Compatibility
        user-scope install + explicit live activation + implicit trigger + Legora workflow PASS

Gate D  Claude Code Discovery & Compatibility
        user-scope install + explicit live activation + implicit trigger + Legora workflow PASS

Gate E  Gemini Discovery & Compatibility
        gemini skills list + explicit live activation + implicit trigger + Legora workflow PASS

Gate F  Cross-Agent Semantic Parity
        all three agents preserve the same Entry/acquire/READY/authority contract

Gate G  Repository Isolation
        bootstrap/doctor leave target repositories byte-for-byte unchanged

Gate H  R1-R4 Regression
        existing runtime, safety, standalone package, and live-R4 contracts remain green
```

R5 is `R5_COMPLETE` only when Gates 0-A-B-C-D-E-F-G-H all pass. A host-auth/network block may be recorded but does not satisfy C, D, or E.

## 16. R5 non-goals

R5 does not add:

- MCP server;
- built-in LLM runtime;
- background daemon;
- whole-repository pre-indexer;
- remote repository service;
- editor extension;
- persistent learner profile;
- vendor-specific Repository Knowledge semantics;
- Codex-specific, Claude-specific, or Gemini-specific copies of Explain/Explore/Verify;
- automatic target-repository instruction files;
- automatic public npm publication;
- automatic Codex plugin publication.

A later distribution phase may package the same canonical Skill as a Codex/ChatGPT plugin if broader OpenAI ecosystem installation becomes a product requirement. That wrapper must not become a second semantic source of truth.

## 17. Expected implementation surfaces

Likely production additions/changes:

```text
skills/legora/SKILL.md
skills/legora/references/explain.md
skills/legora/references/explore.md
skills/legora/references/verify.md
src/bootstrap/*
src/doctor/*
src/cli/index.ts
scripts/build.mjs
package.json
README.md
```

Likely compatibility cleanup:

```text
SKILL.md                  -> small compatibility pointer
references/               -> remove after callers migrate
```

Tests should include standards validation, package-content validation, isolated fake-home bootstrap state machines, conflict/update interruption behavior, doctor read-only behavior, repository-isolation checks, and three live agent validation records kept separate from deterministic tests.

## 18. Completion claim boundary

After R5, Legora may claim:

- one canonical Agent Skill is standards-compliant;
- Codex, Claude Code, and Gemini CLI user-scope bootstrap is supported;
- Codex and Gemini share the interoperable `.agents/skills` copy;
- supported live agents have been observed following the same Legora authority contract;
- target repositories do not need Legora dependencies or agent-specific bootstrap files.

R5 must not claim:

- every coding agent is compatible;
- all versions of Codex/Claude/Gemini are compatible;
- public package registry availability unless a later release action actually publishes it;
- identical agent outputs;
- zero-cost or whole-repository understanding;
- remote repository support.
