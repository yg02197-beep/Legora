import type { KnowledgeRecord } from "./contracts.ts";
import { normalizeRetrievalTokens } from "./retrieval-normalization.ts";
import { readKnowledgeRecords } from "./store.ts";

function structuralSearchText(record: KnowledgeRecord): string {
  const structure = record.structure;
  if (!structure) return "";

  if (structure.type === "ENTITY") {
    return [structure.type, structure.entityKind, structure.name, structure.description]
      .filter((value): value is string => Boolean(value))
      .join(" ");
  }

  if (structure.type === "RELATIONSHIP") {
    return [
      structure.type,
      structure.relationshipKind,
      structure.sourceId,
      structure.targetId,
    ].join(" ");
  }

  return [
    structure.type,
    structure.flowKind,
    structure.name,
    ...structure.steps.flatMap((step) => [step.entityId, step.label ?? ""]),
  ].join(" ");
}

function searchableTokens(record: KnowledgeRecord): Set<string> {
  return normalizeRetrievalTokens([
    record.id,
    record.kind,
    record.subject,
    structuralSearchText(record),
  ].join(" "));
}

function tokenMatches(questionToken: string, searchableToken: string): boolean {
  return questionToken === searchableToken
    || questionToken.includes(searchableToken)
    || searchableToken.includes(questionToken);
}

export type KnowledgeQueryConfidence = "STRONG" | "CANDIDATE";

export interface KnowledgeQueryMatch {
  record: KnowledgeRecord;
  confidence: KnowledgeQueryConfidence;
  directMatches: string[];
  conceptMatches: string[];
  score: number;
}

function isConceptToken(token: string): boolean {
  return token.startsWith("concept:");
}

export function queryKnowledgeRecordMatches(
  records: readonly KnowledgeRecord[],
  question: string,
): KnowledgeQueryMatch[] {
  const questionTokens = normalizeRetrievalTokens(question);
  if (questionTokens.size === 0) return [];

  return records
    .map((record) => {
      const searchable = searchableTokens(record);
      const directMatches = [...questionTokens]
        .filter((token) => !isConceptToken(token))
        .filter((questionToken) => [...searchable]
          .filter((token) => !isConceptToken(token))
          .some((searchableToken) => tokenMatches(questionToken, searchableToken)));
      const conceptMatches = [...questionTokens]
        .filter(isConceptToken)
        .filter((concept) => searchable.has(concept))
        .sort();
      const score = (directMatches.length * 3) + conceptMatches.length;
      const confidence: KnowledgeQueryConfidence = directMatches.length > 0 || conceptMatches.length >= 2
        ? "STRONG"
        : "CANDIDATE";
      return {
        record,
        confidence,
        directMatches,
        conceptMatches,
        score,
      };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.record.id.localeCompare(right.record.id));
}

export function queryKnowledgeRecords(
  records: readonly KnowledgeRecord[],
  question: string,
): KnowledgeRecord[] {
  return queryKnowledgeRecordMatches(records, question).map(({ record }) => record);
}

export async function queryRepositoryKnowledge(
  repositoryRoot: string,
  question: string,
): Promise<KnowledgeRecord[]> {
  return queryKnowledgeRecords(await readKnowledgeRecords(repositoryRoot), question);
}
