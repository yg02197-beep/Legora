# Legora

**Evidence-grounded code understanding for humans and coding agents — Explain, Explore, Verify.**

Legora helps a person understand what a codebase actually does without asking an
agent to invent a mental model from prose alone. It turns repository evidence
into fresh Repository Knowledge, projects a bounded Behavior Slice, and then
uses the smallest useful understanding intervention: Explain, Explore, or
Verify.

```text
Repository Evidence
        ↓
Repository Knowledge
        ↓
freshness validation
        ↓
Behavior Slice
        ↓
Explain / Explore / Verify
```

## Why Legora?

Coding agents are good at reading code, but a useful explanation still needs
three guarantees:

1. **Grounding** — claims should trace back to repository evidence.
2. **Freshness** — cached knowledge should not silently survive source changes.
3. **Boundaries** — the system should say when it does not know instead of
   fabricating a plausible answer.

Legora makes those guarantees part of the runtime rather than relying only on
prompt instructions.

## Current status

Legora is an early public `v0.1.0` source release.

| Surface | Status |
| --- | --- |
| Standalone CLI / external repository lifecycle (R4) | Validated |
| Codex CLI portable Skill workflow | Live validated |
| Claude Code bootstrap / doctor | Implemented; live gate not yet run |
| Gemini CLI bootstrap / doctor | Implemented; live gate not yet run |
| OpenCode bootstrap / doctor | Implemented; live gate not yet run |
| Remote repository support | Not currently claimed |
| Multi-agent support | Not currently claimed |

The npm package is **not published** yet. `package.json` remains private, so the
supported installation path for now is from source.

## Requirements

- Node.js **22 or newer**
- npm
- Git
- A local repository you want to understand
- Optional: Codex CLI, Claude Code, Gemini CLI, or OpenCode for portable Agent Skill use

## Install from source

```powershell
git clone https://github.com/yg02197-beep/Legora.git
cd Legora
npm ci
npm run build
npm link
```

Confirm the CLI is available:

```powershell
legora
```

The command intentionally returns usage information when called without a
subcommand. You can also request help explicitly:

```powershell
legora --help
```

`legora`, `legora --help`, `legora -h`, and `legora help` all print the
human-readable command list and exit `0`. An unknown or mistyped command still
returns a usage error with a non-zero exit code, so an explicit help request is
never confused with a mistake.

## Coding-agent setup

Legora ships one canonical portable Agent Skill at `skills/legora/`. The
bootstrap command installs a Legora-managed copy into the supported user-scope
location for the selected coding agent.

### Codex CLI

```powershell
legora bootstrap --agent codex
legora doctor --agent codex
```

Codex is the currently live-validated integration.

### Claude Code

```powershell
legora bootstrap --agent claude
legora doctor --agent claude
```

Bootstrap and Doctor are implemented, but the live workflow gate has not yet
been run.

### Gemini CLI

```powershell
legora bootstrap --agent gemini
legora doctor --agent gemini
```

Bootstrap and Doctor are implemented, but the live workflow gate has not yet
been run.

### OpenCode

```powershell
legora bootstrap --agent opencode
legora doctor --agent opencode
```

OpenCode shares the portable `~/.agents/skills/legora` target with Codex and
Gemini. Bootstrap and Doctor are implemented, but the live workflow gate has
not yet been run.

`legora doctor` is read-only. Bootstrap only manages targets owned by Legora
and refuses to overwrite unowned or locally modified Skill content.

## 30-second first use

From the repository you want to understand, start with an actual question:

```powershell
legora entry "Where is authentication enforced and what happens when it fails?"
```

`legora entry` now prints human-readable text by default, so a person can read
the result directly in the terminal. Coding agents that need structured output
can add `--json`:

```powershell
legora entry "Where is authentication enforced and what happens when it fails?" --json
```

The `--json` output is the prior structured contract and is unchanged, so the
agent-facing behavior stays backward compatible.

Entry is a gate, not an answer generator. Its lifecycle is:

```text
question
  ↓
lexical + structural + terminology-normalized retrieval
  ↓
strong existing match ───────────────→ freshness check → READY
  ↓ no strong match
KNOWLEDGE_CANDIDATES
  ↓
agent reviews returned knowledge metadata only
  ├─ candidate covers question
  │    ↓
  │  legora entry --candidate <record-id> <question>
  │    ↓
  │  freshness check → READY
  │
  └─ no candidate covers question
       ↓
     legora entry --reject-candidates <question>
       ↓
     KNOWLEDGE_NOT_FOUND
       ↓
     ACQUIRE_KNOWLEDGE
       ↓
     coding agent inspects only the required repository region
       ↓
     Legora captures source evidence itself → READY
```

Candidate output includes the record identity, subject, structure, match
confidence, and matched concepts. If lexical or terminology-normalized search
has zero overlap but Repository Knowledge already contains behavior flows,
Entry returns those flow metadata as recovery candidates instead of declaring
knowledge missing immediately. This keeps repository Grep/Read and acquisition
behind the candidate-recovery gate.

If selected knowledge already exists but its active evidence changed or cannot
be checked:

```text
KNOWLEDGE_STALE / KNOWLEDGE_UNKNOWN
        ↓
REFRESH_KNOWLEDGE
        ↓
READY
```

Only `READY` allows Legora-grounded Behavior Slice output.

When used through the portable Skill, the coding agent follows this handshake
for you: it starts with Entry, reviews existing knowledge before repository
source, supplies acquisition or refresh proposals only when requested, and does
not treat a pre-READY guess as an authoritative Legora answer.

## Explain / Explore / Verify

Legora routes understanding work into three capabilities:

- **Explain** builds the smallest useful mental model from confirmed or bounded
  evidence.
- **Explore** uses grounded cases to inspect behavior. Microworld is an Explore
  capability, not the default answer format.
- **Verify** asks for observable evidence that the mental model transfers to a
  prediction or related case. It does not claim permanent mastery.

The canonical behavior instructions live in:

```text
skills/legora/SKILL.md
skills/legora/references/explain.md
skills/legora/references/explore.md
skills/legora/references/verify.md
```

The repository-root `SKILL.md` is a compatibility pointer, not a second source
of workflow truth.

### Verify

`legora verify` exposes the evidence-grounded Prediction infrastructure as a
CLI quiz. It is the Prediction form of the Verify capability: it builds an
evidence-derived prediction challenge from a `READY` behavior-flow knowledge
record, with the question and answer choices derived from that record's
evidence rather than fabricated.

```powershell
legora verify <flow-record-id>
legora verify --answer <choice-id> <flow-record-id>
```

The full flag surface is `legora verify <flow-record-id> [--json]` and
`legora verify --answer <choice-id> <flow-record-id> [--json]`. Without
`--answer` Legora prints the challenge; `--answer <choice-id>` grades a chosen
option against the evidence. `--json` produces structured output for coding
agents.

Verify is fail-closed. If the target record is not a behavior flow, is not
`READY` (its freshness is stale or unknown), or does not carry enough evidence
to build a challenge with distinct choices, Legora declines to make a quiz
instead of inventing one. As with the rest of Legora, a prediction is only
offered when it is grounded in captured evidence.

## Repository scan

`legora scan` is a shallow pass that builds a structural Repository Inventory
(files and modules, discovered via `git ls-files`) and then maps how far the
current Repository Knowledge covers it. It is Repository Inventory + Knowledge
Coverage, not exhaustive analysis or answer generation.

```powershell
legora scan
legora scan --depth file
legora scan --json
```

The full flag surface is `legora scan [--depth file|module] [--json]`. The
default depth is `module`; `--depth file` reports per-file coverage; `--json`
produces structured output for coding agents.

Coverage is reported in exactly three states — `covered`, `stale`, and
`uncovered`. The unreferenced state is deliberately called `uncovered`, not
`unknown`, so it is not confused with the freshness `UNKNOWN` state used
elsewhere. The mapping is fail-closed:

- a repository file referenced by a knowledge record's active evidence whose
  freshness is `CURRENT` is `covered`;
- a file referenced by a record whose freshness is `STALE` or `UNKNOWN` is
  `stale` (fail-closed — old or unverifiable evidence never counts as covered);
- a file not referenced by any knowledge record is `uncovered`.

Human-readable output looks like this (default `module` depth):

```text
Legora scan: 1 files (0 covered, 0 stale, 1 uncovered)
  src  total=1  covered=0  stale=0  uncovered=1
```

## Repository Knowledge

Legora stores repository-local knowledge in:

```text
.legora/repository-knowledge.json
```

Repository Knowledge separates active evidence from historical evidence
revisions. Freshness checks read the active evidence and fail closed when
source material is removed, changed, or cannot be verified.

A coding agent may propose *where* evidence should be captured, but Legora
validates the proposal and captures the source snippet itself. Authoritative
evidence fields are not accepted merely because an agent wrote them.

The normal agent-facing acquisition input is intentionally smaller than the
stored Knowledge Record contract. Agents submit `entity`, `flow`, or
`relationship` plus a subject, human-readable participants, and source
locators; Legora creates internal IDs, kinds, and structure fields itself.

```powershell
legora knowledge acquire --example
```

The legacy full proposal JSON remains accepted for compatibility. Before any
new record is published, Legora checks existing Knowledge both before evidence
capture and again inside the atomic store transaction. A likely duplicate
returns `EXISTING_KNOWLEDGE` instead of writing another record.

### Version-control policy for `.legora`

`.legora/repository-knowledge.json` can contain source-derived evidence
snippets.

Recommended default:

- keep `.legora` local while experimenting or working with private code;
- inspect its contents before every commit;
- never copy a `.legora` generated from a private codebase into a public
  repository;
- commit Repository Knowledge only when the team intentionally wants it to be
  a reviewed, shared knowledge asset.

Legora does not force a global ignore rule because intentional team-owned
Knowledge assets are a supported repository policy choice.

## Evidence boundary

Evidence capture rejects absolute locators and verifies repository containment
twice:

```text
relative locator
        ↓
lexical repository containment
        ↓
realpath resolution
        ↓
realpath containment re-check
```

That second containment check prevents a repository-local symlink or junction
from being used to read evidence outside the target repository.

The same fail-closed principle applies to freshness checks and Repository
Knowledge projection.

## Portable Agent Skill

Bootstrap uses a managed-copy transaction rather than blindly copying files.
The boundary includes:

- ownership manifests;
- SHA-256 payload verification;
- refusal to adopt unowned lookalike content;
- refusal to overwrite locally modified managed content;
- staged publication;
- backup and validation;
- rollback on failure.

Codex and Gemini use the shared Agent Skills user scope. Claude Code uses its
own user-scope Skill location. Run `doctor` to inspect the installation without
changing it.

## Cartographer

Legora was informed by
[`miltonian/cartographer`](https://github.com/miltonian/cartographer), an
MIT-licensed behavior-first code understanding project.

Legora is an independent implementation. Cartographer is **not** a runtime
dependency. The remaining Cartographer-facing code is a legacy import
compatibility boundary that can project an existing compatible model into
Legora-owned evidence and Behavior Slice structures.

See `THIRD_PARTY_NOTICES.md` and the design reference registry under
`docs/references/` for attribution and additional references.

## Development and tests

Install dependencies:

```powershell
npm ci
```

Run the public CI-equivalent verification:

```powershell
npm run typecheck
npm test
npm run build
npm run test:integration:r4
npm run test:integration:r5
```

Additional repository-specific integration and live-provider scripts exist for
development, but live provider gates are intentionally excluded from default
CI.

## License

Legora is released under the MIT License. See `LICENSE`.

Third-party projects and references remain under their respective licenses.
See `THIRD_PARTY_NOTICES.md`.
