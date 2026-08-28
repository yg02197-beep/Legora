import type { BootstrapResult } from "../bootstrap/service.ts";
import type { BehaviorFact, EvidenceClaim, EvidenceConfidence } from "../core/contracts.ts";
import type { DoctorResult } from "../doctor/contracts.ts";
import type { LegoraEntryCandidate, LegoraEntryFreshness, LegoraEntryResult } from "../entry.ts";
import type { KnowledgeFreshnessIssue } from "../repository-knowledge/freshness.ts";
import type { ScanResult } from "../scan/contracts.ts";
import type { VerifyResult } from "../verify/service.ts";

function labelAgent(agent: string): string {
  if (agent === "codex") return "Codex";
  if (agent === "claude") return "Claude Code";
  if (agent === "gemini") return "Gemini CLI";
  return agent;
}

export function renderBootstrapResult(result: BootstrapResult): string {
  const lines = [
    `Legora bootstrap: ${result.status}`,
    `physical_writes: ${result.physicalWrites}`,
  ];
  for (const agent of result.agents) {
    lines.push(`${labelAgent(agent.agent)}  executable=${agent.executable}  action=${agent.action}  target=${agent.targetPath}`);
  }
  if (result.message) lines.push(`message: ${result.message}`);
  return `${lines.join("\n")}\n`;
}

export function renderDoctorResult(result: DoctorResult): string {
  const lines = [
    `Legora doctor: ${result.status}`,
    `canonical_skill_format: ${result.canonicalSkillFormat}`,
  ];
  for (const agent of result.agents) {
    lines.push(
      `${labelAgent(agent.agent)}  executable=${agent.executable}  install=${agent.installTarget}  digest=${agent.managedDigest}  native_discovery=${agent.nativeDiscovery}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

export function renderScanResult(result: ScanResult): string {
  const lines: string[] = [
    `Legora scan: ${result.totalFiles} files (${result.coveredFiles} covered, ${result.staleFiles} stale, ${result.uncoveredFiles} uncovered)`,
  ];

  if (result.depth === "module") {
    for (const mod of result.modules) {
      lines.push(`  ${mod.module}  total=${mod.total}  covered=${mod.covered}  stale=${mod.stale}  uncovered=${mod.uncovered}`);
    }
  } else {
    for (const file of result.files) {
      lines.push(`  ${file.filePath}  ${file.coverageStatus}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function computeFactConfidence(
  fact: BehaviorFact,
  claimsById: Map<string, EvidenceClaim>,
): EvidenceConfidence | null {
  if (fact.requiredEvidenceClaimIds.length === 0) return null;
  let hasInferred = false;
  let hasUnknown = false;
  for (const claimId of fact.requiredEvidenceClaimIds) {
    const claim = claimsById.get(claimId);
    if (!claim) return null;
    if (claim.confidence === "UNKNOWN") hasUnknown = true;
    else if (claim.confidence === "INFERRED") hasInferred = true;
  }
  if (hasUnknown) return "UNKNOWN";
  if (hasInferred) return "INFERRED";
  return "CONFIRMED";
}

function formatFactFilePaths(
  fact: BehaviorFact,
  claimsById: Map<string, EvidenceClaim>,
): string {
  const anchors: string[] = [];
  for (const claimId of fact.requiredEvidenceClaimIds) {
    const claim = claimsById.get(claimId);
    if (!claim) continue;
    for (const anchor of claim.evidence) {
      const loc = anchor.lineEnd
        ? `${anchor.filePath}:${anchor.lineStart}-${anchor.lineEnd}`
        : `${anchor.filePath}:${anchor.lineStart}`;
      anchors.push(loc);
    }
  }
  if (anchors.length === 0) return "";
  if (anchors.length === 1) return anchors[0];
  return `${anchors[0]} +${anchors.length - 1}`;
}

function renderFactLine(
  fact: BehaviorFact,
  claimsById: Map<string, EvidenceClaim>,
): string {
  const confidence = computeFactConfidence(fact, claimsById);
  const filePaths = formatFactFilePaths(fact, claimsById);
  const badge = confidence ? `[${confidence}]` : "";
  const pathPart = filePaths ? `  ${filePaths}` : "";
  const badgePart = badge ? `  ${badge}` : "";
  return `    \u2022 ${fact.text}${pathPart}${badgePart}`;
}

const CATEGORY_LABELS: Record<string, string> = {
  participants: "Participants",
  states: "States",
  events: "Events",
  flows: "Flows",
  constraints: "Constraints",
  effects: "Effects",
  failures: "Failures",
};

function renderReadyStatus(result: LegoraEntryResult): string {
  const lines: string[] = [];
  lines.push("\u2713 READY");
  lines.push("");
  lines.push(`  ${result.question}`);
  lines.push("");

  const slice = result.behaviorSlice!;
  lines.push(`  \u2500\u2500\u2500 Behavior Slice: ${slice.subject} \u2500\u2500\u2500`);
  lines.push("");

  const claimsById = new Map(result.evidenceClaims.map((c) => [c.id, c]));

  const categories: Array<[string, BehaviorFact[]]> = [
    ["participants", slice.participants],
    ["states", slice.states],
    ["events", slice.events],
    ["flows", slice.flows],
    ["constraints", slice.constraints],
    ["effects", slice.effects],
    ["failures", slice.failures],
  ];

  for (const [key, facts] of categories) {
    if (facts.length === 0) continue;
    lines.push(`  ${CATEGORY_LABELS[key]}`);
    for (const fact of facts) {
      lines.push(renderFactLine(fact, claimsById));
    }
    lines.push("");
  }

  const totalAnchors = result.freshness.reduce((sum, f) => sum + f.result.checkedAnchors, 0);
  const allCurrent = result.freshness.every((f) => f.result.status === "CURRENT");
  lines.push("  \u2500\u2500\u2500 Evidence \u2500\u2500\u2500");
  lines.push(`  ${totalAnchors} anchors checked, ${allCurrent ? "all CURRENT" : "some issues found"}`);

  return `${lines.join("\n")}\n`;
}

function renderCandidatesStatus(result: LegoraEntryResult): string {
  const lines: string[] = [];
  lines.push("? CANDIDATES \u2014 \uAE30\uC874 Knowledge\uC5D0 \uD6C4\uBCF4\uAC00 \uC788\uC2B5\uB2C8\uB2E4");
  lines.push("");
  lines.push(`  ${result.question}`);
  lines.push("");

  const candidates = result.candidates ?? [];
  for (let i = 0; i < candidates.length; i += 1) {
    const c = candidates[i];
    lines.push(`  #${i + 1}  ${c.recordId}`);
    lines.push(`      ${c.subject}`);
    lines.push(`      confidence: ${c.confidence}`);
    if (c.directMatches.length > 0) {
      lines.push(`      matched: ${c.directMatches.map((m) => `"${m}"`).join(", ")}`);
    }
    if (c.conceptMatches.length > 0) {
      lines.push(`      concept: ${c.conceptMatches.join(", ")}`);
    }
    if (c.structure?.type === "BEHAVIOR_FLOW") {
      const entityIds = c.structure.steps.map((s) => s.entityId);
      if (entityIds.length > 0) {
        lines.push(`      entities: ${entityIds.join(", ")}`);
      }
    }
    lines.push("");
  }

  lines.push("  \u2500\u2500\u2500 Next \u2500\u2500\u2500");
  if (candidates.length > 0) {
    lines.push(`  \uD6C4\uBCF4\uAC00 \uB9DE\uC73C\uBA74:  legora entry --candidate ${candidates[0].recordId} "${result.question}"`);
  }
  lines.push(`  \uD6C4\uBCF4\uAC00 \uC5C6\uC73C\uBA74:  legora entry --reject-candidates "${result.question}"`);

  return `${lines.join("\n")}\n`;
}

function renderNotFoundStatus(result: LegoraEntryResult): string {
  const lines: string[] = [];
  lines.push("\u2717 NOT FOUND \u2014 \uC774 \uC9C8\uBB38\uC744 \uB2F5\uD560 Knowledge\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4");
  lines.push("");
  lines.push(`  ${result.question}`);
  lines.push("");
  lines.push("  \u2500\u2500\u2500 Next \u2500\u2500\u2500");
  lines.push("  \uCF54\uB4DC\uB97C \uD655\uC778\uD558\uACE0 Knowledge\uB97C \uC218\uC9D1\uD558\uC138\uC694:");
  lines.push("    legora knowledge acquire --example    (\uC785\uB825 \uD615\uC2DD \uD655\uC778)");
  lines.push("  \uC218\uC9D1 \uD6C4 \uB2E4\uC2DC:");
  lines.push(`    legora entry "${result.question}"`);

  return `${lines.join("\n")}\n`;
}

function renderFreshnessIssues(issues: KnowledgeFreshnessIssue[]): string[] {
  const lines: string[] = [];
  for (const issue of issues) {
    const filePart = issue.filePath ? `${issue.filePath} \u2014 ` : "";
    lines.push(`      ${filePart}${issue.message}`);
  }
  return lines;
}

function renderStaleStatus(result: LegoraEntryResult): string {
  const lines: string[] = [];
  lines.push("\u26A0 STALE \u2014 Knowledge\uAC00 \uC788\uC9C0\uB9CC \uC99D\uAC70\uAC00 \uC624\uB798\uB418\uC5C8\uC2B5\uB2C8\uB2E4");
  lines.push("");
  lines.push(`  ${result.question}`);
  lines.push("");
  if (result.flowRecordId) {
    lines.push(`  Flow: ${result.flowRecordId}`);
    lines.push("");
  }
  lines.push("  Stale records:");
  for (const f of result.freshness) {
    if (f.result.status !== "CURRENT") {
      lines.push(`    \u2022 ${f.recordId}`);
      lines.push(...renderFreshnessIssues(f.result.issues));
    }
  }
  lines.push("");
  lines.push("  \u2500\u2500\u2500 Next \u2500\u2500\u2500");
  lines.push("  \uD574\uB2F9 \uC601\uC5ED\uC744 \uD655\uC778\uD558\uACE0 \uAC31\uC2E0\uD558\uC138\uC694:");
  lines.push("    legora knowledge acquire < refresh.json");
  lines.push("  \uAC31\uC2E0 \uD6C4 \uB2E4\uC2DC:");
  lines.push(`    legora entry "${result.question}"`);

  return `${lines.join("\n")}\n`;
}

function renderUnknownStatus(result: LegoraEntryResult): string {
  const lines: string[] = [];
  lines.push("\u26A0 UNKNOWN \u2014 Knowledge \uC99D\uAC70\uB97C \uD655\uC778\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4");
  lines.push("");
  lines.push(`  ${result.question}`);
  lines.push("");
  if (result.flowRecordId) {
    lines.push(`  Flow: ${result.flowRecordId}`);
    lines.push("");
  }
  lines.push("  Uncheckable records:");
  for (const f of result.freshness) {
    if (f.result.status === "UNKNOWN") {
      lines.push(`    \u2022 ${f.recordId}`);
      lines.push(...renderFreshnessIssues(f.result.issues));
    }
  }
  lines.push("");
  lines.push("  \u2500\u2500\u2500 Next \u2500\u2500\u2500");
  lines.push("  \uC99D\uAC70 \uACBD\uB85C\uB97C \uD655\uC778\uD558\uACE0 \uAC31\uC2E0\uD558\uC138\uC694.");

  return `${lines.join("\n")}\n`;
}

export function renderEntryResult(result: LegoraEntryResult): string {
  switch (result.status) {
    case "READY":
      return renderReadyStatus(result);
    case "KNOWLEDGE_CANDIDATES":
      return renderCandidatesStatus(result);
    case "KNOWLEDGE_NOT_FOUND":
      return renderNotFoundStatus(result);
    case "KNOWLEDGE_STALE":
      return renderStaleStatus(result);
    case "KNOWLEDGE_UNKNOWN":
      return renderUnknownStatus(result);
  }
}

function choiceLetter(index: number): string {
  return String.fromCharCode(97 + index);
}

export function renderVerifyResult(result: VerifyResult, flowRecordId: string): string {
  if (result.status === "NOT_FOUND") {
    return `Knowledge record '${flowRecordId}' was not found.\n`;
  }

  if (result.status === "NOT_FLOW") {
    return `Knowledge record '${flowRecordId}' is not a behavior flow.\n`;
  }

  if (result.status === "STALE") {
    return `퀴즈를 만들 수 없습니다: ${result.reason ?? "Knowledge is stale."}\n`;
  }

  if (result.status === "UNKNOWN") {
    return `퀴즈를 만들 수 없습니다: ${result.reason ?? "Knowledge freshness is unknown."}\n`;
  }

  if (result.status === "INSUFFICIENT_EVIDENCE") {
    return `퀴즈를 만들 수 없습니다 (증거 부족)\n`;
  }

  if (result.status === "CHALLENGE_READY") {
    const challenge = result.challenge!;
    const prompt = challenge.prompt;
    const lines: string[] = [];
    lines.push(`\u2500\u2500\u2500 Verify: ${prompt.question.replace(/^Predict the outcome when: /, "")} \u2500\u2500\u2500`);
    lines.push("");
    lines.push("조건:");
    lines.push(`  ${prompt.question.replace(/^Predict the outcome when: /, "")}`);
    lines.push("");
    lines.push("질문:");
    lines.push(`  ${prompt.question}`);
    lines.push("");
    for (let i = 0; i < prompt.choices.length; i++) {
      lines.push(`  ${choiceLetter(i)}) ${prompt.choices[i]!.label}`);
    }
    lines.push("");
    lines.push(`정답 확인:  legora verify --answer ${prompt.choices[0]!.id} ${flowRecordId}`);
    return `${lines.join("\n")}\n`;
  }

  if (result.status === "CORRECT") {
    const challenge = result.challenge!;
    const predictionResult = result.predictionResult!;
    const selectedChoice = challenge.prompt.choices.find((c) => c.id === predictionResult.receivedChoiceId);
    const correctChoice = challenge.prompt.choices.find((c) => c.id === predictionResult.expectedChoiceId);
    const lines: string[] = [];
    lines.push("\u2713 CORRECT");
    lines.push("");
    lines.push(`  선택: ${selectedChoice?.label ?? predictionResult.receivedChoiceId}`);
    lines.push(`  정답: ${correctChoice?.label ?? predictionResult.expectedChoiceId}`);
    lines.push("");
    lines.push("  이 동작의 근거:");
    if (result.evidenceClaims) {
      for (const claim of result.evidenceClaims) {
        for (const anchor of claim.evidence) {
          const lineRange = anchor.lineEnd
            ? `${anchor.lineStart}-${anchor.lineEnd}`
            : `${anchor.lineStart}`;
          lines.push(`    ${anchor.filePath}:${lineRange} [${claim.confidence}]`);
        }
      }
    }
    return `${lines.join("\n")}\n`;
  }

  if (result.status === "INCORRECT") {
    const challenge = result.challenge!;
    const predictionResult = result.predictionResult!;
    const selectedChoice = challenge.prompt.choices.find((c) => c.id === predictionResult.receivedChoiceId);
    const correctChoice = challenge.prompt.choices.find((c) => c.id === predictionResult.expectedChoiceId);
    const lines: string[] = [];
    lines.push("\u2717 INCORRECT");
    lines.push("");
    lines.push(`  선택: ${selectedChoice?.label ?? predictionResult.receivedChoiceId}`);
    lines.push(`  정답: ${correctChoice?.label ?? predictionResult.expectedChoiceId}`);
    lines.push("");
    lines.push("  왜 이게 정답인가:");
    if (result.evidenceClaims) {
      for (const claim of result.evidenceClaims) {
        for (const anchor of claim.evidence) {
          const lineRange = anchor.lineEnd
            ? `${anchor.lineStart}-${anchor.lineEnd}`
            : `${anchor.lineStart}`;
          lines.push(`    ${anchor.filePath}:${lineRange} [${claim.confidence}]`);
        }
      }
    }
    return `${lines.join("\n")}\n`;
  }

  return "";
}
