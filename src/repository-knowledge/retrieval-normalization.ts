const CONCEPT_ALIASES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["concept:retry", ["retry", "retries", "retryable", "retried", "재시도", "재실행", "다시시도"]],
  ["concept:fallback", ["fallback", "fallbacks", "대체", "대체경로", "다음방식", "다른방식", "다음"]],
  ["concept:terminal", ["terminal", "terminate", "terminated", "stop", "stops", "stopped", "종료", "중단", "끝나", "바로끝"]],
  ["concept:failure", ["failure", "fail", "failed", "error", "실패", "오류"]],
  ["concept:direct", ["direct", "직접", "직접시도"]],
  ["concept:download", ["download", "downloads", "downloader", "다운로드"]],
  ["concept:routing", ["route", "routes", "routing", "라우팅"]],
];

function rawTokens(value: string): string[] {
  return (value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((token) => token.length >= 2);
}

function aliasMatches(token: string, alias: string): boolean {
  return token === alias || token.includes(alias) || alias.includes(token);
}

export function normalizeRetrievalTokens(value: string): Set<string> {
  const normalized = new Set(rawTokens(value));
  for (const token of [...normalized]) {
    for (const [concept, aliases] of CONCEPT_ALIASES) {
      if (aliases.some((alias) => aliasMatches(token, alias))) normalized.add(concept);
    }
  }
  return normalized;
}
