import fs from 'node:fs';

const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

function evaluate(subject) {
  const present = new Set(subject.presentPaths);
  const checks = subject.declaredPaths.map((entry) => ({
    ...entry,
    present: present.has(entry.path),
  }));
  const missing = checks.filter((entry) => !entry.present);
  return {
    subjectCommit: subject.subjectCommit,
    checks,
    missingCount: missing.length,
    missingPaths: missing.map((entry) => entry.path),
    verdict: missing.length === 0
      ? 'SOURCE_CLOSURE_VERIFIED_ONLY'
      : 'HOLD_DECLARED_SOURCE_CLOSURE_INCOMPLETE',
  };
}

const result = {
  schema: 'kaopu.r37-declared-source-closure.n263.v1',
  current: evaluate(input.current),
  controls: input.controls.map((control) => ({
    name: control.name,
    expected: control.expected,
    actual: evaluate(control).verdict,
  })),
};

result.controlsPass = result.controls.every((control) => control.expected === control.actual);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.controlsPass) process.exitCode = 1;
