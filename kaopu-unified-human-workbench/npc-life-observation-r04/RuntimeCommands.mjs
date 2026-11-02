/**
 * One bounded command boundary for the observation host.
 *
 * This module does not own a render loop, clock, or physical world. The host
 * drains at most one command after an actual completed-frame reader barrier.
 * A receipt acknowledges a command decision, never a future rendered image.
 */
export const RUNTIME_COMMAND_TYPES = Object.freeze([
  'select-actor', 'set-station', 'pick', 'identity-plan', 'contend',
  'window-open', 'window-close', 'window-block', 'window-contend',
  'cancel', 'pause', 'step', 'reset', 'move-target', 'toggle-support',
  'start-verification', 'stop-verification'
]);

const knownTypes = new Set(RUNTIME_COMMAND_TYPES);
const verificationAllowed = new Set(['reset', 'stop-verification', 'pause']);
const sessionControls = new Set(['reset', 'stop-verification']);
const copy = value => structuredClone(value);
const frameValue = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const errorDetail = error => String(error?.message || error).slice(0, 2000);

// Sorted JSON distinguishes a changed request from a retry without depending
// on object insertion order. Non-JSON inputs cannot cross this DTO boundary.
function canonicalJSON(value, visiting = new Set()) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw Error('Command payload numbers must be finite');
    return JSON.stringify(value);
  }
  if (!value || typeof value !== 'object') throw Error('Command payload must contain JSON values');
  if (visiting.has(value)) throw Error('Command payload must not contain cycles');
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null)
    throw Error('Command payload must contain plain JSON objects');
  visiting.add(value);
  let result;
  if (Array.isArray(value)) {
    if (Object.keys(value).length !== value.length) throw Error('Command payload arrays must be dense JSON arrays');
    result = '[' + value.map(item => canonicalJSON(item, visiting)).join(',') + ']';
  } else {
    if (Object.getOwnPropertySymbols(value).length) throw Error('Command payload must not contain symbol keys');
    result = '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalJSON(value[key], visiting)).join(',') + '}';
  }
  visiting.delete(value);
  return result;
}

function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

export function createRuntimeCommands({
  getEpoch, getMode, apply, getTaskToken = () => null, getFrameSerial = () => null,
  queueLimit = 32, historyLimit = 128, payloadByteLimit = 16384
} = {}) {
  for (const [name, fn] of Object.entries({getEpoch, getMode, apply, getTaskToken, getFrameSerial}))
    if (typeof fn !== 'function') throw Error(name + ' must be a function');
  for (const [name, value, maximum] of [['queueLimit', queueLimit, 32], ['historyLimit', historyLimit, 128], ['payloadByteLimit', payloadByteLimit, 16384]])
    if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw Error(name + ' is outside the bounded command contract');

  const queue = [], history = [], byId = new Map();
  const droppedCounts = {queueFull: 0, historyEvicted: 0, idempotencyEvicted: 0};
  const counts = {submitted: 0, applied: 0, rejected: 0, failed: 0, duplicates: 0, conflicts: 0};
  let generatedId = 0, receiptSequence = 0, revision = 0, draining = false, lastReceipt = null, failure = null;

  function context() {
    const epoch = getEpoch(), mode = getMode();
    if (!Number.isSafeInteger(epoch) || epoch < 0) throw Error('Runtime epoch must be a nonnegative safe integer');
    if (!['observation', 'verification'].includes(mode)) throw Error('Runtime mode must be observation or verification');
    return {epoch, mode};
  }

  function retain(receipt, entry = null) {
    history.push(receipt);
    if (entry) byId.set(receipt.id, entry);
    if (history.length > historyLimit) {
      const evicted = history.shift(); droppedCounts.historyEvicted++;
      if (byId.get(evicted.id)?.receipt === evicted) {
        byId.delete(evicted.id); droppedCounts.idempotencyEvicted++;
      }
    }
    lastReceipt = receipt;
  }

  function finish(entry, status, code, detail, completedFrameSerial = null) {
    const receipt = entry.receipt;
    receipt.status = status; receipt.code = code;
    receipt.completedFrameSerial = frameValue(completedFrameSerial);
    receipt.revision = revision;
    if (detail !== undefined) receipt.detail = copy(detail);
    counts[status]++;
    retain(receipt, entry.diagnosticOnly ? null : entry);
    return copy(receipt);
  }

  function freshReceipt(id, type, expectedEpoch, submittedFrameSerial) {
    return {
      schema: 'kaopu/runtime-command-receipt@1', sequence: ++receiptSequence,
      id, type, expectedEpoch, status: 'queued', code: 'queued', revision,
      submittedEpoch: null, epochBefore: null, epochAfter: null,
      epochPolicy: sessionControls.has(type) ? 'current-session-control' : 'exact-epoch',
      submittedFrameSerial: frameValue(submittedFrameSerial), completedFrameSerial: null,
      presentedFrameSerial: null,
      frameScope: 'submittedFrameSerial is the last completed frame at submission; completedFrameSerial is the completed frame before this decision, not the resulting image'
    };
  }

  function submit(input) {
    counts.submitted++;
    const providedId = input?.id;
    let id = providedId;
    if (id === undefined) {
      do { id = 'runtime-command-' + (++generatedId); } while (byId.has(id));
    }
    const validId = typeof id === 'string' && id.length > 0 && id.length <= 160;
    let diagnosticId = id;
    if (!validId) do { diagnosticId = 'invalid-command-' + (++generatedId); } while (byId.has(diagnosticId));
    let submittedFrameSerial = null;
    try { submittedFrameSerial = frameValue(getFrameSerial()); } catch { /* Decision remains diagnosable without frame metadata. */ }
    const receipt = freshReceipt(diagnosticId, typeof input?.type === 'string' ? input.type : null,
      Number.isSafeInteger(input?.expectedEpoch) ? input.expectedEpoch : null, submittedFrameSerial);
    let command, fingerprint;
    try {
      if (!validId) throw Error('Command id must be a nonempty string of at most 160 characters');
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Command envelope must be an object');
      if (!knownTypes.has(input.type)) throw Error('Unknown runtime command type');
      if (!Number.isSafeInteger(input.expectedEpoch) || input.expectedEpoch < 0) throw Error('Command expectedEpoch is required');
      if (input.expectedTaskToken !== undefined && input.expectedTaskToken !== null && (typeof input.expectedTaskToken !== 'string' || !input.expectedTaskToken))
        throw Error('Command expectedTaskToken must be a nonempty string or explicit null for no task');
      const payload = input.payload === undefined ? {} : input.payload;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw Error('Command payload must be a JSON object');
      const payloadText = canonicalJSON(payload);
      if (new TextEncoder().encode(payloadText).length > payloadByteLimit) throw Error('Command payload exceeds byte limit');
      command = {id, type: input.type, payload: JSON.parse(payloadText), expectedEpoch: input.expectedEpoch};
      if (input.expectedTaskToken !== undefined) command.expectedTaskToken = input.expectedTaskToken;
      fingerprint = canonicalJSON({type: command.type, payload: command.payload, expectedEpoch: command.expectedEpoch,
        ...(command.expectedTaskToken === undefined ? {} : {expectedTaskToken: command.expectedTaskToken})});
    } catch (error) {
      // A malformed retry must never replace the retained valid request.
      if (validId && byId.has(id)) {
        counts.conflicts++;
        return finish({receipt, diagnosticOnly: true}, 'rejected', 'id-conflict', {message: errorDetail(error)});
      }
      return finish({receipt, diagnosticOnly: !validId}, 'rejected', 'invalid-command', {message: errorDetail(error)});
    }

    const existing = byId.get(id);
    if (existing) {
      if (existing.fingerprint === fingerprint) {
        counts.duplicates++;
        const duplicate = {...copy(existing.receipt), duplicate: true}; lastReceipt = duplicate;
        return duplicate;
      }
      counts.conflicts++;
      // Conflict receipts are diagnostic events. receipt(id) retains the first
      // accepted/rejected command associated with that id while it is retained.
      const conflict = {receipt, diagnosticOnly: true};
      const result = finish(conflict, 'rejected', 'id-conflict', {message: 'The same id was already used for a different command'});
      return result;
    }

    const entry = {command, fingerprint, receipt};
    if (failure) return finish(entry, 'rejected', 'runtime-failed', {message: failure.message});
    let state;
    try { state = context(); } catch (error) { return finish(entry, 'rejected', 'invalid-runtime-context', {message: errorDetail(error)}); }
    receipt.submittedEpoch = state.epoch;
    if (state.mode === 'verification' && !verificationAllowed.has(command.type))
      return finish(entry, 'rejected', 'verification-running', {message: 'Numerical verification owns scene mutations; reset, stop-verification or pause is required'});
    if (queue.length >= queueLimit) {
      droppedCounts.queueFull++;
      return finish(entry, 'rejected', 'queue-full', {message: 'Command queue is full', queueLimit});
    }
    queue.push(entry); byId.set(id, entry); lastReceipt = receipt;
    return copy(receipt);
  }

  function drain({canMutate = false, frameSerial = null} = {}) {
    if (canMutate !== true || draining || !queue.length || failure) return null;
    draining = true;
    const entry = queue.shift(), command = entry.command;
    try {
      let state;
      try { state = context(); } catch (error) {
        return finish(entry, 'rejected', 'invalid-runtime-context', {message: errorDetail(error)}, frameSerial);
      }
      entry.receipt.epochBefore = state.epoch;
      entry.receipt.epochAfter = state.epoch;
      if (!sessionControls.has(command.type) && command.expectedEpoch !== state.epoch)
        return finish(entry, 'rejected', 'stale-epoch', {expected: command.expectedEpoch, actual: state.epoch}, frameSerial);
      if (state.mode === 'verification' && !verificationAllowed.has(command.type))
        return finish(entry, 'rejected', 'verification-running', {message: 'Runtime mode changed before command application'}, frameSerial);
      if (command.expectedTaskToken !== undefined) {
        let actual;
        try { actual = getTaskToken(copy(command)) ?? null; } catch (error) {
          return finish(entry, 'rejected', 'task-context-unavailable', {message: errorDetail(error)}, frameSerial);
        }
        if (actual !== command.expectedTaskToken)
          return finish(entry, 'rejected', 'stale-task', {expected: command.expectedTaskToken, actual: actual ?? null}, frameSerial);
      }

      let result;
      try {
        result = apply(freeze(copy(command)));
        if (!result || typeof result !== 'object' || typeof result.then === 'function' || typeof result.ok !== 'boolean' || typeof result.code !== 'string')
          throw Error('Command apply must return a synchronous {ok, code, detail?} result');
        // Validate/copy before updating the accepted-command revision.
        if (result.detail !== undefined) result = {...result, detail: JSON.parse(canonicalJSON(result.detail))};
        entry.receipt.epochAfter = context().epoch;
      } catch (error) {
        failure = {message: errorDetail(error), commandId: command.id};
        finish(entry, 'failed', 'apply-exception', {message: failure.message}, frameSerial);
        throw error;
      }
      if (result.ok) revision++;
      return finish(entry, result.ok ? 'applied' : 'rejected', result.code, result.detail, frameSerial);
    } finally { draining = false; }
  }

  function status() {
    let activeMode = null, epoch = null, contextError = null;
    try { const current = context(); activeMode = current.mode; epoch = current.epoch; } catch (error) { contextError = errorDetail(error); }
    return copy({schema: 'kaopu/runtime-commands@1', revision, epoch, activeMode, contextError,
      pendingCount: queue.length, queueLimit, historyCount: history.length, historyLimit, payloadByteLimit,
      draining, failure, counts, droppedCounts, lastReceipt,
      idempotencyScope: 'Ids are deduplicated while queued or retained in the bounded receipt history; evicted external ids are outside the retry window',
      frameScope: 'Command acknowledgement is not rendered-image completion; the host must provide the actual GPU-completed-frame barrier'});
  }

  return {
    submit, drain, status,
    receipt(id) { return byId.has(id) ? copy(byId.get(id).receipt) : null; },
    snapshot() { return {...status(), queue: queue.map(entry => ({command: copy(entry.command), receipt: copy(entry.receipt)})), history: copy(history)}; }
  };
}
