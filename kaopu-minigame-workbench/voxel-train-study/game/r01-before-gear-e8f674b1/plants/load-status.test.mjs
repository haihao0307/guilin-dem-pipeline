import test from 'node:test';
import assert from 'node:assert/strict';
import {nativePlantFailureStatus} from './load-status.mjs';
test('Unknown native output is explicitly unverified and retains current scene',()=>{const r=nativePlantFailureStatus(Error('Unqualified native output hash pair: abc / def'));assert.equal(r.unverified,true);assert.equal(r.retainScene,true);assert.match(r.message,/尚未驗證/);assert.match(r.message,/保留原場景/);assert(!r.message.includes('abc'));});
test('Other failures are not incorrectly certified as compatibility only',()=>{for(const e of [Error('BAD_SQLITE_SIGNATURE'),Error('LOADED_RULE_HASH_MISMATCH'),null]){const r=nativePlantFailureStatus(e);assert.equal(r.unverified,false);assert.equal(r.retainScene,true);assert.match(r.message,/讀取失敗/);}});
