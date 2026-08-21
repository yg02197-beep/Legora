import type { KnowledgeRecord } from "./contracts.ts";
import { readKnowledgeRecords } from "./store.ts";

function tokens(value: string): Set<string> {
  return new Set(
    (value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
      .filter((token) => token.length >= 2),
  );
}

function tokenMatches(questionToken: string, searchableToken: string): boolean {
  return questionToken === searchableToken
    || questionToken.includes(searchableToken)
    || searchableToken.includes(questionToken);
}

export function queryKnowledgeRecords(
  records: readonly KnowledgeRecord[],
  question: string,
): KnowledgeRecord[] {
  const questionTokens = tokens(question);
  if (questionTokens.size === 0) return [];

  return records
    .map((record) => {
      const searchable = tokens(`${record.id} ${record.kind} ${record.subject}`);
      let score = 0;
      for (const questionToken of questionTokens) {
        if ([...searchable].some((searchableToken) => tokenMatches(questionToken, searchableToken))) {
          score += 1;
        }
      }
      return { record, score };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.record.id.localeCompare(right.record.id))
    .map(({ record }) => record);
}

export async function queryRepositoryKnowledge(
  repositoryRoot: string,
  question: string,
): Promise<KnowledgeRecord[]> {
  return queryKnowledgeRecords(await readKnowledgeRecords(repositoryRoot), question);
}
