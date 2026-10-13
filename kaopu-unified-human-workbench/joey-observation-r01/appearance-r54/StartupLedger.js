(function (root) {
  'use strict';

  var SCHEMA = 'R54-startup-ledger/1';
  var MAX_EVENTS = 64;
  var MAX_ATTEMPTS = 8;
  var MAX_PAST_EVENTS = 12;
  var instances = [];

  function clipped(value, length) {
    return String(value == null ? '' : value).slice(0, length || 1000);
  }

  // Small diagnostic values only: never retain model arrays or DOM objects.
  function small(value, depth, seen, budget) {
    budget = budget || { remaining: 3000, nodes: 80 };
    if (budget.nodes-- <= 0 || budget.remaining <= 0) return '[omitted]';
    if (value == null || typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      var text = value.slice(0, Math.min(500, budget.remaining));
      budget.remaining -= text.length;
      return text;
    }
    if (typeof value === 'number') return isFinite(value) ? value : String(value);
    if (typeof value !== 'object') return clipped(value, 100);
    if (depth >= 5 || seen.indexOf(value) !== -1) return '[omitted]';
    if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(value)) {
      return { type: Object.prototype.toString.call(value), byteLength: value.byteLength };
    }
    seen.push(value);
    var result = Array.isArray(value) ? [] : {};
    var keyLimit = Array.isArray(value) ? 12 : 16;
    var count = 0;
    for (var key in value) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      if (count++ >= keyLimit || budget.nodes <= 0 || budget.remaining <= 0) break;
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      var outputKey = clipped(key, 80);
      budget.remaining -= outputKey.length;
      try { result[outputKey] = small(value[key], depth + 1, seen, budget); }
      catch (_) { result[outputKey] = '[unreadable]'; }
    }
    seen.pop();
    return result;
  }

  function copy(value) { return JSON.parse(JSON.stringify(value)); }

  // Imported records also use an allowlist: never preserve recursive reports.
  function snapshot(value) {
    if (!value || typeof value !== 'object' || typeof value.bootToken !== 'string' ||
        ['boot', 'loading', 'displaying', 'ready', 'error', 'blocked', 'retry'].indexOf(value.phase) === -1) return null;
    var result = {};
    ['schema', 'version', 'bootToken', 'documentToken', 'phase', 'stage', 'reason', 'storageIssue'].forEach(function (key) {
      result[key] = value[key] == null ? null : clipped(value[key]);
    });
    ['stageNumber', 'startedAt', 'updatedAt'].forEach(function (key) {
      result[key] = typeof value[key] === 'number' && isFinite(value[key]) ? value[key] : 0;
    });
    result.blocked = value.blocked === true;
    result.storageAvailable = value.storageAvailable === true;
    result.lastCheckpoint = small(value.lastCheckpoint || null, 0, []);
    result.lastRenderCheckpoint = small(value.lastRenderCheckpoint || null, 0, []);
    result.lastResources = small(value.lastResources || null, 0, []);
    result.interruption = small(value.interruption || null, 0, []);
    result.history = Array.isArray(value.history) ? value.history.slice(-MAX_PAST_EVENTS).map(function (entry) {
      return small(entry, 0, []);
    }) : [];
    return result;
  }

  function newToken(now) {
    if (root.crypto && typeof root.crypto.randomUUID === 'function') return root.crypto.randomUUID();
    return 'r54-' + now() + '-' + Math.random().toString(36).slice(2);
  }

  function create(options) {
    options = options || {};
    var now = typeof options.now === 'function' ? options.now : Date.now;
    var key = clipped(options.key || 'r54-startup-ledger', 200);
    var version = clipped(options.version || 'R54', 200);
    var bootToken = clipped(typeof options.token === 'function' ? options.token() : options.token || newToken(now), 200);
    var storage, storageIssue = null, storageAvailable = true;
    try { storage = Object.prototype.hasOwnProperty.call(options, 'storage') ? options.storage : root.sessionStorage; }
    catch (_) { storageIssue = '本机启动记录不可用：浏览器禁止读取储存。'; }
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
      storageAvailable = false;
      storageIssue = storageIssue || '本机启动记录不可用，无法保证跨刷新保护。';
    }
    for (var i = 0; i < instances.length; i += 1) {
      var item = instances[i];
      if (item.storage === storage && item.key === key && item.token === bootToken) return item.api;
    }

    var saved = null;
    if (storageAvailable) {
      try {
        var raw = storage.getItem(key);
        if (raw) {
          if (raw.length > 1000000) throw new Error('oversized');
          saved = JSON.parse(raw);
          if (!saved || saved.schema !== SCHEMA || !snapshot(saved.current)) {
            saved = null;
            storageIssue = '上一启动记录格式不兼容，无法据此判断中断。';
          }
        }
      } catch (error) {
        saved = null;
        if (error && (error.name === 'SyntaxError' || error.message === 'oversized')) {
          storageIssue = '上一启动记录损坏，无法据此判断中断。';
        } else {
          storageAvailable = false;
          storageIssue = '本机启动记录不可用：浏览器禁止读取储存。';
        }
      }
    }

    var previous = saved ? snapshot(saved.current) : null;
    var attempts = saved && Array.isArray(saved.attempts) ? saved.attempts.slice(-(MAX_ATTEMPTS - 1)).map(snapshot).filter(Boolean) : [];
    if (previous) attempts.push(previous);
    var retryAllowed = !!(saved && saved.retry && previous && previous.phase === 'retry' && saved.retry.fromBootToken === previous.bootToken);
    var unfinished = previous && ['boot', 'loading', 'displaying', 'error', 'blocked', 'retry'].indexOf(previous.phase) !== -1;
    var blocked = !!(unfinished && !retryAllowed);
    var startedAt = now();
    var state = {
      schema: SCHEMA, version: version, bootToken: bootToken, documentToken: null,
      phase: blocked ? 'blocked' : 'boot', blocked: blocked,
      stage: blocked ? clipped(previous.stage) : '正在启动页面',
      stageNumber: blocked ? Number(previous.stageNumber) || 0 : 0,
      reason: blocked ? '上次启动未记录稳定完成，已停止自动重启；原因未确定，请手动重试。' : null,
      startedAt: startedAt, updatedAt: startedAt, storageAvailable: storageAvailable,
      storageIssue: storageIssue, lastCheckpoint: null, lastRenderCheckpoint: null, lastResources: null,
      interruption: blocked ? copy(previous.interruption || {
        bootToken: previous.bootToken, phase: previous.phase, stage: previous.stage,
        stageNumber: previous.stageNumber, lastCheckpoint: previous.lastCheckpoint || null,
        lastRenderCheckpoint: previous.lastRenderCheckpoint || null, lastResources: previous.lastResources || null,
        updatedAt: previous.updatedAt
      }) : null,
      history: []
    };
    var retry = null;

    function active() {
      return !state.blocked && ['boot', 'loading', 'displaying'].indexOf(state.phase) !== -1;
    }

    function result(ok, reason, code) { return { ok: ok, reason: reason || null, code: code || null }; }
    function inactive() { return result(false, state.reason || '本次启动已结束，忽略迟到的消息。', 'inactive'); }

    function event(kind, payload) {
      var diagnostic;
      try {
        diagnostic = small(payload == null ? null : payload, 0, []);
        var encoded = JSON.stringify(diagnostic);
        if (encoded.length > 3500) diagnostic = { truncated: true, preview: encoded.slice(0, 2000) };
      } catch (_) { diagnostic = { captureFailed: true }; }
      var entry = { at: now(), kind: clipped(kind, 100), payload: diagnostic };
      state.updatedAt = entry.at;
      state.history.push(entry);
      if (state.history.length > MAX_EVENTS) state.history.splice(0, state.history.length - MAX_EVENTS);
      return entry;
    }

    function persist() {
      if (!state.storageAvailable) return;
      try {
        storage.setItem(key, JSON.stringify({ schema: SCHEMA, current: state, attempts: attempts, retry: retry }));
      } catch (_) {
        state.storageAvailable = false;
        state.storageIssue = '本机启动记录无法保存，无法保证跨刷新保护。';
        event('storage-unavailable', { operation: 'write' });
      }
    }

    function report() {
      var value = copy(state);
      value.active = active();
      value.previous = previous ? copy(previous) : null;
      value.attempts = copy(attempts);
      value.retryPrepared = !!retry;
      return value;
    }

    function fail(reason) {
      if (['error', 'blocked', 'retry'].indexOf(state.phase) !== -1) return inactive();
      state.phase = 'error';
      state.reason = clipped(reason && reason.message || reason || '启动未完成，原因未确定。');
      event('failed', { reason: state.reason });
      persist();
      return result(true, state.reason, 'failed');
    }

    function progress(text) {
      if (!active() || state.phase === 'displaying') return inactive();
      text = clipped(text);
      var match = /^\s*(\d+)\s*\/\s*(\d+)(?:\s|$)/.exec(text);
      var stageNumber = match ? Number(match[1]) : state.stageNumber;
      if (match && (Number(match[2]) !== 5 || stageNumber < 1 || stageNumber > 5)) {
        event('invalid-stage', { message: text }); persist();
        return result(false, '收到无效的启动阶段。', 'invalid-stage');
      }
      if (stageNumber < state.stageNumber) {
        event('stage-regression', { previous: state.stage, incoming: text });
        fail('启动阶段从 ' + state.stageNumber + '/5 回到 ' + stageNumber + '/5，已停止本次启动。');
        return result(false, state.reason, 'stage-regression');
      }
      if (state.stage === text && state.phase === 'loading') return result(true, null, 'duplicate-progress');
      state.phase = 'loading'; state.stage = text; state.stageNumber = stageNumber;
      event('progress', { stage: text, stageNumber: stageNumber }); persist();
      return result(true);
    }

    function registerChild(parentToken, documentToken) {
      if (parentToken !== bootToken) {
        event('rejected-parent-token', null); persist();
        return result(false, '忽略上一启动的原生页面消息。', 'stale-boot-token');
      }
      if (typeof documentToken !== 'string' || !documentToken || documentToken.length > 200) {
        return result(false, '原生页面标识无效。', 'invalid-document-token');
      }
      if (state.documentToken && documentToken !== state.documentToken) {
        event('child-document-changed', { previous: state.documentToken, incoming: documentToken });
        fail('原生页面在同一次启动中重新建立了文档，已停止自动重启。');
        return result(false, state.reason, 'child-restarted');
      }
      if (state.documentToken === documentToken && state.phase === 'ready') return result(true, null, 'already-registered');
      if (!active()) return inactive();
      if (state.documentToken === documentToken) return result(true, null, 'already-registered');
      state.documentToken = documentToken;
      event('child-registered', { documentToken: documentToken }); persist();
      return result(true);
    }

    function ready() {
      if (state.phase === 'displaying') return result(true, null, 'already-displaying');
      if (!active()) return inactive();
      if (!state.documentToken || state.stageNumber !== 5) {
        event('premature-ready', { documentRegistered: !!state.documentToken, stageNumber: state.stageNumber });
        persist();
        return result(false, '原生页面尚未完成握手或第 5/5 阶段，不能标记画面就绪。', 'premature-ready');
      }
      state.phase = 'displaying'; event('displaying', null); persist();
      return result(true);
    }

    function stable() {
      if (state.phase === 'ready') return result(true, null, 'already-stable');
      if (state.phase !== 'displaying' || !active()) return inactive();
      state.phase = 'ready'; event('stable', null); persist();
      return result(true);
    }

    function record(kind, payload) {
      var entry = event(kind, payload);
      if (active()) {
        state.lastCheckpoint = copy(entry);
        if (/(^|-)render(-|$)/.test(String(kind))) state.lastRenderCheckpoint = copy(entry);
        if (payload && typeof payload === 'object' && payload.resources) {
          state.lastResources = { at: entry.at, kind: entry.kind, resources: small(payload.resources, 0, []) };
        }
      }
      persist();
      return result(true);
    }

    // Call only from the visible, explicit retry action. No automatic caller.
    function prepareRetry() {
      if (retry) return result(true, null, 'already-prepared');
      retry = { fromBootToken: bootToken, requestedAt: now() };
      state.phase = 'retry';
      state.reason = '已请求手动重试。';
      event('manual-retry', null); persist();
      return result(true, state.storageAvailable ? null : state.storageIssue,
        state.storageAvailable ? 'retry-prepared' : 'retry-unpersisted');
    }

    event(blocked ? 'startup-blocked' : retryAllowed ? 'manual-retry-consumed' : 'startup', {
      previousBootToken: previous ? previous.bootToken : null,
      storageAvailable: state.storageAvailable
    });
    persist();
    var api = { report: report, active: active, progress: progress, registerChild: registerChild,
      ready: ready, stable: stable, fail: fail, record: record, prepareRetry: prepareRetry };
    instances.push({ storage: storage, key: key, token: bootToken, api: api });
    if (instances.length > 16) instances.shift();
    return api;
  }

  root.R54StartupLedger = { create: create };
})(typeof window !== 'undefined' ? window : globalThis);
