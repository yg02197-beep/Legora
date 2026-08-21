import type { AdapterDiagnostic, EvidenceAnchor, EvidenceClaim } from "../../core/contracts.ts";
import type { CartographerEvidenceView } from "./model-view.ts";

interface EvidenceBearingObject {
  id: string;
  name?: string;
  description?: string;
  evidence?: CartographerEvidenceView[];
}

function validAnchor(anchor: unknown): anchor is EvidenceAnchor {
  if (!anchor || typeof anchor !== "object") return false;
  const candidate = anchor as Record<string, unknown>;
  return typeof candidate.filePath === "string"
    && candidate.filePath.length > 0
    && Number.isInteger(candidate.lineStart)
    && Number(candidate.lineStart) > 0;
}

function mapConfidence(sourceConfidence: string | undefined, hasValidAnchor: boolean): EvidenceClaim["confidence"] {
  if (!hasValidAnchor) return "UNKNOWN";
  if (sourceConfidence === "proven") return "CONFIRMED";
  if (sourceConfidence === "high" || sourceConfidence === "medium" || sourceConfidence === "low") {
    return "INFERRED";
  }
  return "UNKNOWN";
}

export function normalizeCartographerEvidence(
  object: EvidenceBearingObject,
  diagnostics: AdapterDiagnostic[] = [],
): EvidenceClaim[] {
  const records = Array.isArray(object.evidence) ? object.evidence : [];

  return records.map((record, index) => {
    const rawAnchors = Array.isArray(record.anchors) ? record.anchors : [];
    const anchors = rawAnchors.filter(validAnchor).map((anchor) => ({
      filePath: anchor.filePath,
      lineStart: anchor.lineStart,
      ...(Number.isInteger(anchor.lineEnd) ? { lineEnd: anchor.lineEnd } : {}),
      ...(typeof anchor.snippet === "string" ? { snippet: anchor.snippet } : {}),
    }));
    const sourceConfidence = typeof record.confidence === "string" ? record.confidence : "unknown";
    const confidence = mapConfidence(sourceConfidence, anchors.length > 0);

    if (!["proven", "high", "medium", "low", "speculative"].includes(sourceConfidence)) {
      diagnostics.push({
        code: "CARTOGRAPHER_UNKNOWN_CONFIDENCE",
        message: `Unknown Cartographer confidence '${sourceConfidence}' was downgraded to UNKNOWN.`,
        providerRef: object.id,
      });
    }
    if (rawAnchors.length > 0 && anchors.length === 0) {
      diagnostics.push({
        code: "CARTOGRAPHER_INVALID_SOURCE_ANCHOR",
        message: "Provider evidence had no valid source anchor and cannot become CONFIRMED.",
        providerRef: object.id,
      });
    }

    return {
      id: `${object.id}#${record.id ?? `evidence-${index}`}`,
      claim: object.description ?? object.name ?? object.id,
      confidence,
      sourceConfidence,
      evidence: anchors,
      providerObjectId: object.id,
      provenance: typeof record.provenance === "string" ? record.provenance : null,
    };
  });
}
