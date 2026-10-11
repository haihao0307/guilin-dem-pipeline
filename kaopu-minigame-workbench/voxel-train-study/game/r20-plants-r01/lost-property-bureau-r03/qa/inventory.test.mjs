import test from 'node:test';
import assert from 'node:assert/strict';
import * as I from '../inventory.mjs';
let sequence = 0;
const command = fields => ({ commandId: `TEST-${++sequence}`, ...fields });
const throwsCode = (fn, code) => assert.throws(fn, e => e.code === code);
const approve = (s, itemId = 'LP-0001', fields = {}) => I.verifyClaim(s, command({ claimId: `CLAIM-${++sequence}`, itemId, claimantRef: 'FICTIONAL-PERSON-A', hiddenFeature: s.items[itemId].internalFeature, identityVerified: true, identityReference: 'fictional-identity-check', reviewerRef: 'FICTIONAL-REVIEWER', ...fields }));
const pick = (s, claimId, fields = {}) => I.requestPick(s, command({ claimId, durationSeconds: 10, ...fields }));
const pickup = (s, taskId) => I.advanceTask(s, command({ taskId, action: 'pickup' }));
const arrive = (s, taskId) => { I.advanceTime(s, 10); return I.advanceTask(s, command({ taskId, action: 'arrive' })); };
const handover = (s, claimId, fields = {}) => I.confirmHandover(s, command({ claimId, actualItemId: s.claims[claimId].itemId, recipientRef: s.claims[claimId].claimantRef, identityRechecked: true, receivedConfirmed: true, clerkRef: 'FICTIONAL-CLERK', ...fields }));
const newItem = fields => ({ itemId: 'NEW-1', label: '虚构接收样本', category: 'parcel', dimensions: [0.3, 0.3, 0.3], internalFeature: '内侧三点绿墨', ...fields });

test('24 scripted objects are distinct from 11,040 valid rack addresses', () => {
  const s = I.createInventory(); const audit = I.assertInvariants(s), summary = I.summary(s);
  assert.equal(audit.items, 24); assert.equal(audit.inCustody, 24); assert.equal(summary.addressCapacity, 11040);
  assert.equal(summary.worldDate, '1976-07-01T08:00:00.000Z'); assert.equal(summary.oldestReceiptYear, 1948);
  assert.equal(Object.keys(s.slots).length, 24); assert.equal(summary.occupiedRackSlots, 21);
  let count = 0;
  for (let r = 1; r <= 16; r++) for (let b = 1; b <= 20; b++) for (let l = 1; l <= 6; l++) for (const f of ['A', 'B']) for (let c = 1; c <= (r > 10 ? 6 : 1); c++) {
    const id = `R${String(r).padStart(2, '0')}-B${String(b).padStart(2, '0')}-L${l}-${f}${r > 10 ? `-C${c}` : ''}`;
    assert.equal(I.getSlot(id).slotId, id); count++;
  }
  assert.equal(count, I.ADDRESS_CAPACITY);
});
test('one year without a claim preserves every item, identity, receipt date and position', () => {
  const s = I.createInventory(), before = JSON.stringify(s.items), oldAge = I.itemAgeYears(s, 'LP-0001');
  I.advanceTime(s, I.YEAR_SECONDS); assert.equal(JSON.stringify(s.items), before); assert.equal(I.summary(s).inCustody, 24);
  assert.ok(Math.abs(I.itemAgeYears(s, 'LP-0001') - oldAge - 1) < 1e-10); assert.equal(Object.keys(s.claims).length, 0); I.assertInvariants(s);
});
test('calendar and dimensional validation do not silently fix bad initial manifests', () => {
  throwsCode(() => I.createInventory({ worldTime: '1976-02-31' }), 'INVALID_TIME');
  throwsCode(() => I.createInventory({ items: [newItem({ receivedAt: '1977-01-01', slotId: 'R01-B01-L1-A' })] }), 'TIME_ORDER');
  throwsCode(() => I.createInventory({ items: [newItem({ foundAt: '1976-07-02', slotId: 'R01-B01-L1-A' })] }), 'TIME_ORDER');
  throwsCode(() => I.createInventory({ items: [newItem({ slotId: 'R01-B01-L1-A' }), newItem({ slotId: 'R02-B01-L1-A' })] }), 'DUPLICATE_ITEM');
  throwsCode(() => I.createInventory({ items: [newItem({ slotId: 'R01-B01-L1-A' }), newItem({ itemId: 'NEW-2', slotId: 'R01-B01-L1-A' })] }), 'INITIAL_SLOT_CONFLICT');
  throwsCode(() => I.createInventory({ items: [newItem({ dimensions: [5, 5, 5], slotId: 'R01-B01-L1-A' })] }), 'INITIAL_SLOT_CONFLICT');
});
test('slot coordinates use the building row, bay, level and face contract', () => {
  assert.deepEqual(I.slotPosition('R01-B01-L1-A'), [-31.98, 0.45, -13.4]);
  const p = I.slotPosition('R02-B02-L2-B'); assert.ok(Math.abs(p[0] - -26.82) < 1e-9); assert.ok(Math.abs(p[1] - 1.6) < 1e-9); assert.ok(Math.abs(p[2] - -12.2) < 1e-9);
  assert.match(I.getSlot('R11-B01-L1-A-C2').address, /小件.*11排.*2小格/);
  for (const id of ['R00-B01-L1-A', 'R17-B01-L1-A', 'R01-B21-L1-A', 'R11-B01-L1-A', 'R01-B01-L1-A-C1']) throwsCode(() => I.getSlot(id), 'INVALID_SLOT');
});
test('intake retry applies once, preserves unknown found date and rejects changed retry payload', () => {
  const s = I.createInventory(), c = command({ item: newItem() }); const first = I.intake(s, c), after = JSON.stringify(s);
  assert.equal(I.intake(s, c).duplicate, true); assert.equal(JSON.stringify(s), after); assert.equal(I.summary(s).inCustody, 25);
  assert.equal(s.items[first.itemId].foundAt, null); assert.equal(s.items[first.itemId].foundTimeReliability, 'unknown');
  assert.equal(s.events.filter(e => e.type === 'intake_confirmed').length, 1);
  throwsCode(() => I.intake(s, { ...c, item: newItem({ label: '不同输入' }) }), 'COMMAND_CONFLICT');
});
test('intake needs inspection before storage; reservation is not occupancy', () => {
  const s = I.createInventory(); I.intake(s, command({ item: newItem() })); const from = s.items['NEW-1'].location.slotId;
  throwsCode(() => I.requestMove(s, command({ itemId: 'NEW-1' })), 'INSPECTION_REQUIRED');
  I.inspectItem(s, command({ itemId: 'NEW-1', safeToStore: true, inspectorRef: 'INSPECTOR-1' }));
  const move = I.requestMove(s, command({ itemId: 'NEW-1', durationSeconds: 10 }));
  assert.equal(s.slots[from].occupiedBy, 'NEW-1'); assert.equal(s.slots[move.targetSlotId].occupiedBy, null); assert.equal(s.slots[move.targetSlotId].reservedBy, move.taskId);
  pickup(s, move.taskId); assert.equal(s.slots[from].occupiedBy, null); assert.equal(s.items['NEW-1'].location.type, 'carrier');
  arrive(s, move.taskId); assert.equal(s.items['NEW-1'].state, 'stored'); assert.equal(s.slots[move.targetSlotId].occupiedBy, 'NEW-1'); I.assertInvariants(s);
});
test('unsafe items stay in their confirmed receiving position and cannot be forced into storage', () => {
  const s = I.createInventory(); I.intake(s, command({ item: newItem() })); const from = structuredClone(s.items['NEW-1'].location);
  I.inspectItem(s, command({ itemId: 'NEW-1', safeToStore: false, inspectorRef: 'INSPECTOR-1' }));
  assert.equal(s.items['NEW-1'].state, 'quarantined'); assert.deepEqual(s.items['NEW-1'].location, from);
  throwsCode(() => I.requestMove(s, command({ itemId: 'NEW-1' })), 'INSPECTION_REQUIRED'); I.assertInvariants(s);
});
test('oversize goods cannot fit small racks or be reduced to make them fit', () => {
  const s = I.createInventory(), c = command({ item: newItem({ category: 'oversize', dimensions: [2, 2, 2] }) }); I.intake(s, c);
  I.inspectItem(s, command({ itemId: 'NEW-1', safeToStore: true, inspectorRef: 'INSPECTOR-1' })); const before = JSON.stringify(s);
  throwsCode(() => I.requestMove(s, command({ itemId: 'NEW-1', targetSlotId: 'R11-B01-L1-A-C1' })), 'TARGET_UNAVAILABLE'); assert.equal(JSON.stringify(s), before);
  const move = I.requestMove(s, command({ itemId: 'NEW-1' })); assert.match(move.targetSlotId, /^OVERSIZE-/); assert.deepEqual(s.items['NEW-1'].dimensions, [2, 2, 2]);
});
test('a name, tag, outward appearance or journey evidence cannot authorize release', () => {
  const s = I.createInventory();
  for (const feature of ['LP-0001', s.items['LP-0001'].label, 'FICTIONAL-PERSON-A', 'train-ticket-123']) {
    const result = approve(s, 'LP-0001', { hiddenFeature: feature }); assert.equal(result.status, 'rejected'); assert.equal(result.checks.hiddenFeature, false);
    throwsCode(() => pick(s, result.claimId), 'CLAIM_NOT_APPROVED');
  }
  assert.equal(approve(s, 'LP-0016', { identityVerified: false }).status, 'rejected'); assert.equal(I.summary(s).inCustody, 24);
});
test('hidden feature match and identity are independently required; proxy also needs authorization', () => {
  const s = I.createInventory(); assert.equal(approve(s, 'LP-0001', { identityReference: '' }).status, 'rejected');
  assert.equal(approve(s, 'LP-0001', { actingAs: 'representative', proxyAuthorized: false }).status, 'rejected');
  assert.equal(approve(s, 'LP-0001', { actingAs: 'representative', proxyAuthorized: true, authorizationReference: 'FICTIONAL-LETTER-1' }).status, 'approved');
  assert.equal(I.summary(s).delivered, 0); assert.equal(I.summary(s).stored, 24);
});
test('two verified claims preserve both records, freeze dispute, and do not decide by arrival order', () => {
  const s = I.createInventory(), a = approve(s), b = approve(s, 'LP-0001', { claimantRef: 'FICTIONAL-PERSON-B' });
  assert.equal(b.status, 'disputed'); assert.equal(s.claims[a.claimId].status, 'disputed'); assert.equal(s.items['LP-0001'].activeClaimId, null); assert.equal(s.items['LP-0001'].holdReason, 'conflicting-claims');
  throwsCode(() => pick(s, a.claimId), 'CLAIM_NOT_APPROVED');
  I.resolveClaimDispute(s, command({ itemId: 'LP-0001', approvedClaimId: b.claimId, reviewerRef: 'SENIOR-1', reason: 'fictional-reviewed-original-custody-evidence' }));
  assert.equal(s.claims[a.claimId].status, 'rejected'); assert.equal(s.claims[b.claimId].status, 'approved'); I.assertInvariants(s);
});
test('a dispute during a reserved pick can be safely cancelled and explicitly resolved', () => {
  const s = I.createInventory(), a = approve(s), task = pick(s, a.claimId), b = approve(s, 'LP-0001', { claimantRef: 'FICTIONAL-PERSON-B' });
  throwsCode(() => pickup(s, task.taskId), 'PICKUP_BLOCKED');
  I.cancelTask(s, command({ taskId: task.taskId, reason: 'dispute', actorRef: 'SUPERVISOR' }));
  I.resolveClaimDispute(s, command({ itemId: 'LP-0001', approvedClaimId: b.claimId, reviewerRef: 'SENIOR-1', reason: 'new evidence examined' })); I.assertInvariants(s);
});
test('a target has one reservation and one item has at most one active task', () => {
  const s = I.createInventory(), a = approve(s), b = approve(s, 'LP-0002'); pick(s, a.claimId, { targetSlotId: 'HANDOVER-01' }); const before = JSON.stringify(s);
  throwsCode(() => pick(s, b.claimId, { targetSlotId: 'HANDOVER-01' }), 'TARGET_UNAVAILABLE'); assert.equal(JSON.stringify(s), before);
  throwsCode(() => pick(s, a.claimId), 'CLAIM_NOT_APPROVED'); assert.equal(I.summary(s).reservedSlots, 1); I.assertInvariants(s);
});
test('picking, in-transit position, destination reservation and handover are separate events', () => {
  const s = I.createInventory(), a = approve(s), source = s.items['LP-0001'].location.slotId, task = pick(s, a.claimId);
  assert.equal(s.items['LP-0001'].state, 'stored'); assert.equal(s.slots[source].occupiedBy, 'LP-0001');
  const pickCommand = command({ taskId: task.taskId, action: 'pickup' }); I.advanceTask(s, pickCommand); assert.equal(I.advanceTask(s, pickCommand).duplicate, true);
  assert.equal(s.items['LP-0001'].state, 'pick_transit'); assert.equal(s.items['LP-0001'].location.type, 'carrier'); assert.equal(s.slots[source].occupiedBy, null); assert.equal(s.slots[task.targetSlotId].occupiedBy, null);
  throwsCode(() => handover(s, a.claimId), 'HANDOVER_NOT_READY'); throwsCode(() => I.advanceTask(s, command({ taskId: task.taskId, action: 'arrive' })), 'NOT_ARRIVED');
  I.advanceTime(s, 5); assert.equal(I.taskProgress(s, task.taskId), 0.5); assert.equal(I.itemPosition(s, 'LP-0001').length, 3);
  arrive(s, task.taskId); assert.equal(s.items['LP-0001'].state, 'handover'); assert.equal(I.summary(s).inCustody, 24); assert.equal(I.summary(s).delivered, 0);
  throwsCode(() => handover(s, a.claimId, { receivedConfirmed: false }), 'HANDOVER_CONFIRMATION_REQUIRED');
  handover(s, a.claimId); assert.equal(I.summary(s).inCustody, 23); assert.equal(I.summary(s).delivered, 1); assert.equal(I.itemPosition(s, 'LP-0001'), null); I.assertInvariants(s);
});
test('blocked carriers keep custody, freeze rendered progress and shift travel deadline on resume', () => {
  const s = I.createInventory(), a = approve(s), task = pick(s, a.claimId); pickup(s, task.taskId); I.advanceTime(s, 4);
  I.advanceTask(s, command({ taskId: task.taskId, action: 'block', reason: 'blocked aisle' })); const location = structuredClone(s.items['LP-0001'].location), position = I.itemPosition(s, 'LP-0001');
  I.advanceTime(s, 1000); assert.deepEqual(s.items['LP-0001'].location, location); assert.deepEqual(I.itemPosition(s, 'LP-0001'), position); assert.equal(I.taskProgress(s, task.taskId), 0.4);
  throwsCode(() => I.advanceTask(s, command({ taskId: task.taskId, action: 'arrive' })), 'NOT_ARRIVED');
  I.advanceTask(s, command({ taskId: task.taskId, action: 'resume' })); I.advanceTime(s, 6); I.advanceTask(s, command({ taskId: task.taskId, action: 'arrive' })); I.assertInvariants(s);
});
test('save and restore midway preserve carrier, reservation, world time, events and command retry protection', () => {
  const s = I.createInventory(), a = approve(s), task = pick(s, a.claimId); const c = command({ taskId: task.taskId, action: 'pickup' }); I.advanceTask(s, c); I.advanceTime(s, 3.5);
  const saved = I.serializeInventory(s), restored = I.restoreInventory(saved); assert.equal(I.serializeInventory(restored), saved);
  assert.equal(I.advanceTask(restored, c).duplicate, true); assert.equal(restored.items['LP-0001'].location.type, 'carrier'); assert.equal(restored.slots[task.targetSlotId].reservedBy, task.taskId);
  I.advanceTime(restored, 6.5); I.advanceTask(restored, command({ taskId: task.taskId, action: 'arrive' })); I.assertInvariants(restored);
});
test('handover retries and reloading never double-deliver, and historical custody remains', () => {
  let s = I.createInventory(); const a = approve(s), task = pick(s, a.claimId); pickup(s, task.taskId); arrive(s, task.taskId);
  const c = command({ claimId: a.claimId, actualItemId: 'LP-0001', recipientRef: 'FICTIONAL-PERSON-A', identityRechecked: true, receivedConfirmed: true, clerkRef: 'FICTIONAL-CLERK' });
  const result = I.confirmHandover(s, c); s = I.restoreInventory(I.serializeInventory(s)); assert.equal(I.confirmHandover(s, c).duplicate, true);
  assert.equal(s.items['LP-0001'].state, 'delivered'); assert.ok(s.items['LP-0001'].eventIds.length > 3); assert.equal(s.receipts[result.receiptId].type, 'handover'); assert.equal(s.ledger.delivered, 1); assert.equal(Object.keys(s.items).length, 24);
});
test('cancel before pickup releases only reservation; actual source occupancy stays', () => {
  const s = I.createInventory(), a = approve(s), source = structuredClone(s.items['LP-0001'].location), task = pick(s, a.claimId);
  I.cancelClaim(s, command({ claimId: a.claimId })); assert.deepEqual(s.items['LP-0001'].location, source); assert.equal(s.slots[source.slotId].occupiedBy, 'LP-0001'); assert.equal(s.slots[task.targetSlotId].reservedBy, null); assert.equal(s.tasks[task.taskId].status, 'cancelled'); I.assertInvariants(s);
});
test('cancel during transport keeps the carrier and schedules a separate physical return after arrival', () => {
  const s = I.createInventory(), a = approve(s), receivedAt = s.items['LP-0001'].receivedAt, source = structuredClone(s.items['LP-0001'].location), task = pick(s, a.claimId); pickup(s, task.taskId);
  I.cancelClaim(s, command({ claimId: a.claimId })); assert.equal(s.items['LP-0001'].location.type, 'carrier'); assert.equal(s.tasks[task.taskId].returnRequired, true);
  arrive(s, task.taskId); const returnId = s.items['LP-0001'].activeTaskId; assert.ok(returnId); assert.equal(s.items['LP-0001'].state, 'handover'); assert.equal(s.slots[source.slotId].reservedBy, returnId);
  pickup(s, returnId); arrive(s, returnId); assert.deepEqual(s.items['LP-0001'].location, source); assert.equal(s.items['LP-0001'].receivedAt, receivedAt); assert.equal(I.summary(s).inCustody, 24); I.assertInvariants(s);
});
test('cancel at handover creates a return reservation without teleporting or handing over', () => {
  const s = I.createInventory(), a = approve(s), task = pick(s, a.claimId); pickup(s, task.taskId); arrive(s, task.taskId); const position = structuredClone(s.items['LP-0001'].location);
  I.cancelClaim(s, command({ claimId: a.claimId })); assert.deepEqual(s.items['LP-0001'].location, position); assert.ok(s.items['LP-0001'].activeTaskId); assert.equal(s.slots[position.slotId].occupiedBy, 'LP-0001'); throwsCode(() => handover(s, a.claimId), 'HANDOVER_NOT_READY'); I.assertInvariants(s);
});
test('replacement tags preserve stable identity, all old aliases and original receipt age', () => {
  const s = I.createInventory(), old = structuredClone(s.items['LP-0001']); I.advanceTime(s, 12345); I.retag(s, command({ itemId: old.itemId, tag: 'REPRINTED-1976-1' }));
  const i = s.items[old.itemId]; assert.equal(i.receivedAt, old.receivedAt); assert.equal(i.tagAliases[0].tag, old.tagAliases[0].tag); assert.ok(i.tagAliases[0].retiredAt); assert.equal(i.tagAliases.length, 2); I.assertInvariants(s);
});
test('retention dates produce review notices only, even across many years', () => {
  const s = I.createInventory({ items: [newItem({ receivedAt: '1960-01-01', slotId: 'R01-B01-L1-A', reviewAt: I.WORLD_START + 10000 })] });
  I.advanceTime(s, I.YEAR_SECONDS * 10); assert.equal(s.items['NEW-1'].retention.reviewRequired, true); assert.equal(I.summary(s).inCustody, 1); assert.equal(s.items['NEW-1'].state, 'stored');
  I.advanceTime(s, I.YEAR_SECONDS); assert.equal(s.events.filter(e => e.type === 'retention_review_due').length, 1); I.assertInvariants(s);
});
test('loss reports are separate from actual received property; public views omit verification secrets', () => {
  const s = I.createInventory(); I.recordLossReport(s, command({ reportId: 'LOSS-1', personRef: 'PERSON-2', description: '虚构旅途中遗失', candidates: ['LP-0001'] }));
  assert.equal(I.summary(s).inCustody, 24); assert.equal(Object.keys(s.lossReports).length, 1); const publicRecord = I.publicItem(s, 'LP-0001'); assert.equal(publicRecord.internalFeature, undefined); assert.equal(publicRecord.location, undefined); assert.equal(publicRecord.tagAliases, undefined);
});
test('failed commands are atomic and expected-version checks reject stale decisions', () => {
  const s = I.createInventory(), a = approve(s), before = I.serializeInventory(s); throwsCode(() => pick(s, a.claimId, { expectedVersion: s.revision - 1 }), 'VERSION_CONFLICT'); assert.equal(I.serializeInventory(s), before);
  throwsCode(() => I.advanceTime(s, -1), 'TIME_REVERSAL'); assert.equal(I.serializeInventory(s), before);
  const c = command({ seconds: 10 }); I.advanceTime(s, c); const time = s.worldTime; I.advanceTime(s, c); assert.equal(s.worldTime, time);
});
test('corrupt or incomplete snapshots fail visibly rather than regenerating inventory', () => {
  throwsCode(() => I.restoreInventory('{'), 'INVALID_SNAPSHOT'); throwsCode(() => I.restoreInventory({ schemaVersion: 2 }), 'SNAPSHOT_VERSION');
  const s = I.createInventory(), source = s.items['LP-0001'].location.slotId; s.slots[source].occupiedBy = null; throwsCode(() => I.restoreInventory(s), 'INVARIANT');
  const t = I.createInventory(), a = approve(t), task = pick(t, a.claimId); pickup(t, task.taskId); t.slots[task.targetSlotId].reservedBy = null; throwsCode(() => I.restoreInventory(t), 'INVARIANT');
  const u = I.createInventory(); approve(u); u.commands = {}; throwsCode(() => I.restoreInventory(u), 'INVARIANT');
});
test('render queries, repeated views and distant LOD queries do not mutate the ledger', () => {
  const s = I.createInventory(), before = I.serializeInventory(s); for (let n = 0; n < 20; n++) for (const i of Object.values(s.items)) { I.itemPosition(s, i); I.itemAgeYears(s, i); I.publicItem(s, i.itemId); I.summary(s); } assert.equal(I.serializeInventory(s), before);
});
test('item centres rest above shelf floors; receiving is rear +z and handover front -z', () => {
  const s = I.createInventory();
  for (const i of Object.values(s.items)) {
    const slot = I.getSlot(i.location.slotId), p = I.itemPosition(s, i);
    if (slot.kind === 'rack') {
      const floor = 0.3 + 1.15 * (slot.level - 1) + (slot.cell ? Math.floor((slot.cell - 1) / 3) * 1.15 / 2 : 0);
      assert.ok(Math.abs(p[1] - i.dimensions[1] / 2 - floor - 0.04) < 1e-9);
    }
  }
  assert.equal(I.slotPosition('RECEIVING-01')[2], 27); assert.equal(I.slotPosition('HANDOVER-01')[2], -22);
  const a = approve(s), move = pick(s, a.claimId), path = I.taskWaypoints(s, move.taskId);
  assert.deepEqual(path[0], I.itemPosition(s, 'LP-0001')); assert.equal(path[3][2], -17); assert.equal(path.at(-1)[2], -22); assert.equal(path.length, 8);
});
test('cancelling only an in-progress pick safely returns it without trapping its valid claim', () => {
  const s = I.createInventory(), a = approve(s), task = pick(s, a.claimId); pickup(s, task.taskId);
  I.cancelTask(s, command({ taskId: task.taskId, reason: 'mechanical reassignment', actorRef: 'OPERATOR-1' }));
  assert.equal(s.items['LP-0001'].location.type, 'carrier'); arrive(s, task.taskId);
  const returnId = s.items['LP-0001'].activeTaskId; pickup(s, returnId); arrive(s, returnId);
  assert.equal(s.claims[a.claimId].status, 'approved'); assert.equal(s.items['LP-0001'].state, 'stored'); assert.ok(pick(s, a.claimId).taskId); I.assertInvariants(s);
});
