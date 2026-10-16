import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const fixturePath = process.argv[2];
if (!fixturePath) throw new Error('usage: node material_push_range_scope_probe_n167.mjs <fixture.json>');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function scopeFor(file) {
  const match = file.match(/^kaopu-material-workbench\/material-master-(r0[1-4])\//);
  return match ? match[1] : null;
}

function scopes(files) {
  return [...new Set(files.map(scopeFor).filter(Boolean))].sort();
}

function changed(cwd, from, to) {
  const out = git(cwd, ['diff', '--name-only', from, to]);
  return out ? out.split('\n').filter(Boolean).sort() : [];
}

function runScenario(scenario) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'kaopu-push-range-'));
  try {
    git(cwd, ['init', '-q']);
    git(cwd, ['config', 'user.name', 'KAOPU Probe']);
    git(cwd, ['config', 'user.email', 'probe@example.invalid']);
    fs.writeFileSync(path.join(cwd, 'baseline.txt'), 'baseline\n');
    git(cwd, ['add', '.']);
    git(cwd, ['commit', '-q', '-m', 'baseline']);
    const before = git(cwd, ['rev-parse', 'HEAD']);

    scenario.commits.forEach((files, index) => {
      for (const relative of files) {
        const target = path.join(cwd, relative);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.appendFileSync(target, `scenario=${scenario.id};commit=${index + 1}\n`);
      }
      git(cwd, ['add', '.']);
      git(cwd, ['commit', '-q', '-m', `${scenario.id}-${index + 1}`]);
    });

    const after = git(cwd, ['rev-parse', 'HEAD']);
    const parent = git(cwd, ['rev-parse', 'HEAD^']);
    const fullRangePaths = changed(cwd, before, after);
    const lastCommitPaths = changed(cwd, parent, after);
    const requiredScopes = scopes(fullRangePaths);
    const selectedScopes = scopes(lastCommitPaths);
    const missedScopes = requiredScopes.filter((item) => !selectedScopes.includes(item));
    const verdict = missedScopes.length ? 'HOLD_PUSH_SCOPE_INCOMPLETE' : 'SCOPE_VERIFIED';

    assert.equal(verdict, scenario.expected, `${scenario.id}: unexpected verdict`);
    return {
      id: scenario.id,
      commit_count: scenario.commits.length,
      full_range_paths: fullRangePaths,
      last_commit_paths: lastCommitPaths,
      required_scopes: requiredScopes,
      selected_scopes_from_head_parent: selectedScopes,
      missed_scopes: missedScopes,
      verdict
    };
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
}

const scenarios = fixture.scenarios.map(runScenario);
const result = {
  probe_id: fixture.probe_id,
  hypothesis: fixture.hypothesis,
  command_under_test: fixture.subject.observed_selector,
  alternative_for_bounded_existing_branch_push: 'git diff --name-only <push-before-sha> <push-after-sha>',
  scenarios,
  summary: {
    total: scenarios.length,
    expected_verdicts_matched: scenarios.length,
    incomplete_scope_cases: scenarios.filter((item) => item.verdict === 'HOLD_PUSH_SCOPE_INCOMPLETE').length,
    hypothesis_falsified: false
  },
  boundary: fixture.boundary,
  explicit_unknowns: fixture.explicit_unknowns
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
