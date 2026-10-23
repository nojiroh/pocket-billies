// Studio plan T2.5: the run rules that live in code, which the Run Lab's rules card shows read-only with their file and
// line. Each snippet must be in its file exactly once, so the Studio finds its line; a change to that code must update
// logic/run-rules-code.js (its snippet and what it says the value is).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { modules, ROOT } from './setup-fixture.mjs';

const { RUN_RULES_IN_CODE, runRulesCodeLine } = modules['run-rules-code'];

test('every run rule in code is found on exactly one line of its file', () => {
  assert.ok(RUN_RULES_IN_CODE.length >= 8);
  for (const R of RUN_RULES_IN_CODE) {
    const line = runRulesCodeLine(readFileSync(join(ROOT, R.file), 'utf8'), R.code);
    assert.ok(line > 0, `${R.what}: "${R.code}" is not on exactly one line of ${R.file}`);
  }
});

test('runRulesCodeLine: 1-based, and 0 when the code is missing or there twice', () => {
  assert.equal(runRulesCodeLine('a\nb = 2;\nc', 'b = 2'), 2);
  assert.equal(runRulesCodeLine('a\nb', 'z'), 0);
  assert.equal(runRulesCodeLine('x\nx', 'x'), 0);
});
