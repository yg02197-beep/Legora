import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRetrievalTokens } from "../../../src/repository-knowledge/retrieval-normalization.ts";

test("tokenizes text, lowercases, and drops tokens shorter than two characters", () => {
  const tokens = normalizeRetrievalTokens("A Retry Loop x");

  assert.ok(tokens.has("retry"));
  assert.ok(tokens.has("loop"));
  // Single-character tokens "a" and "x" are filtered out.
  assert.ok(!tokens.has("a"));
  assert.ok(!tokens.has("x"));
});

test("splits on non-alphanumeric separators", () => {
  const tokens = normalizeRetrievalTokens("download-routing.failure");

  assert.ok(tokens.has("download"));
  assert.ok(tokens.has("routing"));
  assert.ok(tokens.has("failure"));
});

test("maps English concept aliases to their concept tokens", () => {
  const tokens = normalizeRetrievalTokens("The retries triggered a fallback download route on failure");

  assert.ok(tokens.has("concept:retry"));
  assert.ok(tokens.has("concept:fallback"));
  assert.ok(tokens.has("concept:download"));
  assert.ok(tokens.has("concept:routing"));
  assert.ok(tokens.has("concept:failure"));
});

test("maps Korean aliases to their concept tokens", () => {
  const tokens = normalizeRetrievalTokens("재시도 후 대체 경로로 라우팅하다 종료");

  assert.ok(tokens.has("concept:retry"));
  assert.ok(tokens.has("concept:fallback"));
  assert.ok(tokens.has("concept:routing"));
  assert.ok(tokens.has("concept:terminal"));
});

test("adds the terminal concept for the direct terminate wording", () => {
  const tokens = normalizeRetrievalTokens("the process will terminate directly");

  assert.ok(tokens.has("concept:terminal"));
  assert.ok(tokens.has("concept:direct"));
});

test("returns an empty set when no tokens survive filtering", () => {
  const tokens = normalizeRetrievalTokens("a b !");

  assert.equal(tokens.size, 0);
});

test("does not add unrelated concept tokens for plain vocabulary", () => {
  const tokens = normalizeRetrievalTokens("database schema migration");

  for (const token of tokens) {
    assert.ok(!token.startsWith("concept:"), `unexpected concept token: ${token}`);
  }
});

test("matches aliases via substring in either direction", () => {
  // "downloader" contains the alias "download".
  const contains = normalizeRetrievalTokens("downloader");
  assert.ok(contains.has("concept:download"));

  // token "fail" is contained by the alias "failure".
  const containedBy = normalizeRetrievalTokens("fail");
  assert.ok(containedBy.has("concept:failure"));
});
