import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const canonical = value => JSON.stringify(value, Object.keys(value).sort());
const digest = value => crypto.createHash('sha256').update(canonical(value)).digest('hex');

function keyFromDeclared(state, declared) {
  return digest(Object.fromEntries([...declared].sort().map(name => [name, state[name]])));
}

function runObserved(provider, state, declared, {denyUndeclared = false} = {}) {
  const reads = new Set();
  const input = new Proxy(state, {
    get(target, property) {
      if (typeof property === 'string') {
        reads.add(property);
        if (denyUndeclared && !declared.includes(property)) {
          throw new Error(`UNDECLARED_DEPENDENCY:${property}`);
        }
      }
      return target[property];
    }
  });
  const value = provider(input);
  const undeclared = [...reads].filter(name => !declared.includes(name)).sort();
  return {value, reads: [...reads].sort(), undeclared};
}

const declared = ['height', 'width'];
const dry = {width: 2, height: 3, weather: 'dry'};
const wet = {width: 2, height: 3, weather: 'rain'};
const provider = state => state.width * state.height + (state.weather === 'rain' ? 10 : 0);
const branchProvider = state => state.width * state.height + (state.width > 0 && state.weather === 'rain' ? 10 : 0);

const checks = [];
const check = (name, fn) => { fn(); checks.push({name, pass: true}); };

check('declared-key-collides-when-hidden-input-changes', () => {
  assert.equal(keyFromDeclared(dry, declared), keyFromDeclared(wet, declared));
});
check('collision-would-reuse-a-wrong-result', () => {
  assert.notEqual(provider(dry), provider(wet));
});
check('observed-read-set-detects-the-hidden-input-on-executed-path', () => {
  assert.deepEqual(runObserved(provider, wet, declared).undeclared, ['weather']);
});
check('deny-mode-blocks-the-hidden-input-before-publication', () => {
  assert.throws(() => runObserved(provider, wet, declared, {denyUndeclared: true}), /UNDECLARED_DEPENDENCY:weather/);
});
check('adding-the-actual-input-separates-cache-identity', () => {
  assert.notEqual(keyFromDeclared(dry, [...declared, 'weather']), keyFromDeclared(wet, [...declared, 'weather']));
});
check('one-observed-path-is-not-a-completeness-proof', () => {
  const inactive = {width: 0, height: 3, weather: 'rain'};
  assert.deepEqual(runObserved(branchProvider, inactive, declared).undeclared, []);
  assert.deepEqual(runObserved(branchProvider, wet, declared).undeclared, ['weather']);
});

console.log(JSON.stringify({
  schema: 'kaopu/undeclared-dependency-probe-result@1',
  subject: 'Mother provider dependency declaration vs Engine exact reuse',
  checks,
  passed: checks.length,
  total: 6,
  decision: 'CANDIDATE_DENY_UNDECLARED_PROVIDER_READS_IN_AUDITION',
  boundary: 'Executed-path read tracing is counterexample evidence, not proof that the declaration is complete across unexecuted branches.'
}, null, 2));
