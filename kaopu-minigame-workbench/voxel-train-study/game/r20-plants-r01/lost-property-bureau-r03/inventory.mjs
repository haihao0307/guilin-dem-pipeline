/**
 * Lost Property Bureau R03 — fictional 1976 custody ledger, no dependencies.
 * All dimensions/positions are metres [x, y, z]; worldTime is UTC milliseconds.
 * Commands mutate the supplied state atomically, return IDs/status, and require
 * commandId. Retrying an identical command is safe; reusing its ID is an error.
 * advanceTime(state, seconds) is the inexpensive clock-only frame API. It never
 * picks, hands over, destroys or invents property. Call advanceTask explicitly.
 * JSON snapshots contain fictional internal verification features. Public UI
 * should use publicItem(), not expose the internalFeature field to claimants.
 */
export const SCHEMA_VERSION = 3;
export const WORLD_START = Date.UTC(1976, 6, 1, 8);
export const ADDRESS_CAPACITY = 11040;
export const YEAR_SECONDS = 365.2425 * 86400;
const ACTIVE = new Set(['reserved', 'moving', 'blocked']);
const CATEGORIES = ['baggage', 'parcel', 'umbrella', 'small', 'document', 'valuable', 'oversize'];
const clone = value => JSON.parse(JSON.stringify(value));
const fail = (code, message) => { const error = new Error(message); error.code = code; throw error; };
const check = (condition, code, message) => { if (!condition) fail(code, message); };
const id = value => { check(typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,95}$/.test(value) && !['constructor', 'prototype', '__proto__'].includes(value), 'INVALID_ID', 'A stable, safe identifier is required.'); return value; };
const stable = value => JSON.stringify(value, (_, v) => v && !Array.isArray(v) && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
const positiveSize = size => Array.isArray(size) && size.length === 3 && size.every(n => Number.isFinite(n) && n > 0);
const equalPosition = (a, b) => stable(a) === stable(b);
const pad = n => String(n).padStart(2, '0');
function time(value) {
  if (typeof value === 'number') { check(Number.isFinite(value) && Math.abs(value) <= 8.64e15, 'INVALID_TIME', 'Invalid world time.'); return value; }
  check(typeof value === 'string' && /^\d{4}-\d\d-\d\d(?:T.*(?:Z|[+-]\d\d:\d\d))?$/.test(value), 'INVALID_TIME', 'Use a UTC millisecond value or an ISO date with timezone.');
  const result = Date.parse(value);
  check(Number.isFinite(result), 'INVALID_TIME', 'Invalid date.');
  if (value.length === 10) check(new Date(result).toISOString().slice(0, 10) === value, 'INVALID_TIME', 'Invalid calendar date.');
  return result;
}
function event(s, type, itemId, data = {}, commandId = null) {
  const e = { eventId: `E-${String(++s.lastEventSequence).padStart(7, '0')}`, sequence: s.lastEventSequence, worldTime: s.worldTime, type, itemId, commandId, ...clone(data) };
  s.events.push(e); s.lastEventId = e.eventId;
  if (itemId && s.items[itemId]) s.items[itemId].eventIds.push(e.eventId);
  return e;
}
function transact(s, command, type, operation) {
  check(command && typeof command === 'object', 'INVALID_COMMAND', 'A command object is required.');
  id(command.commandId);
  const signature = stable(command), previous = s.commands[command.commandId];
  if (previous) {
    check(previous.type === type && previous.signature === signature, 'COMMAND_CONFLICT', 'This command ID was already used with different input.');
    return { ...clone(previous.result), duplicate: true };
  }
  if (command.expectedVersion !== undefined) check(command.expectedVersion === s.revision, 'VERSION_CONFLICT', 'Inventory changed; refresh before retrying.');
  const next = clone(s), result = operation(next);
  next.revision++;
  const response = { ...result, revision: next.revision, duplicate: false };
  next.commands[command.commandId] = { type, signature, result: response };
  assertInvariants(next);
  Object.keys(s).forEach(k => delete s[k]); Object.assign(s, next);
  return clone(response);
}
/** Slots are resolved by address; 11,040 addresses do not create 11,040 items. */
export function getSlot(slotId) {
  id(slotId);
  const rack = /^R(\d\d)-B(\d\d)-L([1-6])-([AB])(?:-C([1-6]))?$/.exec(slotId);
  if (rack) {
    const row = +rack[1], bay = +rack[2], level = +rack[3], face = rack[4], cell = rack[5] ? +rack[5] : null, small = row >= 11;
    check(row >= 1 && row <= 16 && bay >= 1 && bay <= 20 && (small ? cell !== null : cell === null), 'INVALID_SLOT', 'Invalid rack address.');
    return { slotId, kind: 'rack', row, bay, level, face, cell, address: `${small ? '小件' : '普通'}区—${pad(row)}排—${pad(bay)}架间—${level}层—${face}面${cell ? `—${cell}小格` : ''}`, dimensions: small ? [0.85, 0.32, 0.33] : [0.85, 0.8, 1.1], categories: small ? ['small', 'document'] : ['baggage', 'parcel', 'umbrella', 'small', 'document'], disabled: false, occupiedBy: null, reservedBy: null };
  }
  const buffer = /^(RECEIVING|INSPECTION|HANDOVER|QUARANTINE|OVERSIZE|VAULT)-(\d\d)$/.exec(slotId);
  const specs = { RECEIVING: [16, [4, 3, 4], 'receiving', '接收'], INSPECTION: [4, [4, 3, 4], 'inspection', '检查'], HANDOVER: [8, [4, 3, 4], 'handover', '交接'], QUARANTINE: [4, [4, 3, 4], 'quarantine', '隔离'], OVERSIZE: [8, [4, 3, 4], 'oversize', '大件'], VAULT: [16, [1, 1, 1], 'vault', '贵重'] };
  check(buffer && +buffer[2] > 0 && +buffer[2] <= specs[buffer[1]][0], 'INVALID_SLOT', 'Unknown operational position.');
  const [_, dimensions, kind, label] = specs[buffer[1]];
  return { slotId, kind, address: `${label}区—${buffer[2]}位`, dimensions, categories: kind === 'vault' ? ['valuable'] : kind === 'oversize' ? ['oversize', 'baggage', 'parcel'] : [...CATEGORIES], disabled: false, occupiedBy: null, reservedBy: null };
}
/** Pure coordinate helper. Optional origin/rowPitch/bayPitch/levelPitch adapt scene placement. */
export function slotPosition(slotId, options = {}) {
  const slot = getSlot(slotId), origin = options.origin || [-31.5, 0.45, -13.4];
  if (slot.kind === 'rack') {
    const cell = (slot.cell || 1) - 1;
    return [origin[0] + (slot.row - 1) * (options.rowPitch || 4.2) + (slot.face === 'A' ? -0.48 : 0.48), origin[1] + (slot.level - 1) * (options.levelPitch || 1.15) + (slot.cell ? Math.floor(cell / 3) * (options.levelPitch || 1.15) / 2 : 0), origin[2] + (slot.bay - 1) * (options.bayPitch || 1.2) + (slot.cell ? (cell % 3 - 1) * 0.36 : 0)];
  }
  const n = +slotId.slice(-2) - 1;
  const origins = { receiving: [-23, 0.6, 27], inspection: [-6, 0.8, 25], handover: [-14, 1.3, -22], quarantine: [23, 0.5, 26], oversize: [23, 0.6, 15], vault: [-31, 0.8, 16] };
  const p = origins[slot.kind]; return [p[0] + (n % 8) * 2.2, p[1], p[2] + Math.floor(n / 8) * 2.5];
}
const materialize = (s, slotId) => s.slots[slotId] || (s.slots[slotId] = getSlot(slotId));
export function fitsSlot(item, slot) {
  if (typeof slot === 'string') slot = getSlot(slot);
  return !slot.disabled && slot.categories.includes(item.category) && positiveSize(item.dimensions) && item.dimensions.every((v, i) => v <= slot.dimensions[i]);
}
function freeSlot(s, item, kind = 'storage', preferred = null) {
  const free = slotId => { const slot = s.slots[slotId] || getSlot(slotId); return fitsSlot(item, slot) && !slot.occupiedBy && !slot.reservedBy; };
  if (preferred && free(preferred)) return preferred;
  const group = kind === 'storage' ? (item.category === 'valuable' ? 'VAULT' : item.category === 'oversize' ? 'OVERSIZE' : null) : kind.toUpperCase();
  if (group) { for (let n = 1; n <= (group === 'RECEIVING' || group === 'VAULT' ? 16 : group === 'HANDOVER' || group === 'OVERSIZE' ? 8 : 4); n++) { const key = `${group}-${pad(n)}`; if (free(key)) return key; } }
  else {
    const small = item.category === 'small' || item.category === 'document';
    for (const row of small ? [...Array.from({ length: 6 }, (_, i) => i + 11), ...Array.from({ length: 10 }, (_, i) => i + 1)] : Array.from({ length: 10 }, (_, i) => i + 1))
      for (let bay = 1; bay <= 20; bay++) for (let level = 1; level <= 6; level++) for (const face of ['A', 'B']) for (let cell = 1; cell <= (row >= 11 ? 6 : 1); cell++) {
        const key = `R${pad(row)}-B${pad(bay)}-L${level}-${face}${row >= 11 ? `-C${cell}` : ''}`;
        if (free(key)) return key;
      }
  }
  fail('NO_COMPATIBLE_SLOT', 'No vacant compatible position is available.');
}
const itemById = (s, itemId) => { id(itemId); const item = s.items[itemId]; check(item, 'UNKNOWN_ITEM', `Unknown item ${itemId}.`); return item; };
function normalizedItem(input, now, initialized = false) {
  id(input.itemId); check(CATEGORIES.includes(input.category), 'INVALID_CATEGORY', 'Unsupported item category.');
  check(positiveSize(input.dimensions), 'INVALID_DIMENSIONS', 'Actual positive [x,y,z] dimensions are required.');
  const receivedAt = time(input.receivedAt ?? now), foundAt = input.foundAt == null ? null : time(input.foundAt);
  check(receivedAt <= now && (foundAt === null || foundAt <= receivedAt), 'TIME_ORDER', 'Found and received dates must not be in the future or reversed.');
  check(typeof input.internalFeature === 'string' && input.internalFeature.trim().length >= 2, 'MISSING_INTERNAL_FEATURE', 'A fictional internal verification feature is required.');
  return { itemId: input.itemId, label: input.label || input.itemId, category: input.category, dimensions: [...input.dimensions], source: input.source || 'public', batchId: input.batchId || `BATCH-${new Date(receivedAt).getUTCFullYear()}`, receivedAt, foundAt, foundTimeReliability: foundAt === null ? 'unknown' : input.foundTimeReliability || 'reported', state: initialized ? 'stored' : 'receiving', location: { type: 'slot', slotId: input.slotId }, version: 1, internalFeature: input.internalFeature.trim(), publicDescription: input.publicDescription || input.label || input.category, inspected: initialized, activeTaskId: null, activeClaimId: null, holdReason: null, returnPending: false, retention: { ruleId: 'FICTIONAL-1976-PENDING', status: 'pending', reviewAt: input.reviewAt == null ? null : time(input.reviewAt), reviewRequired: false }, tagAliases: [{ tag: input.tag || `TAG-${input.itemId}`, activeFrom: receivedAt, retiredAt: null }], initializedFromScript: initialized, eventIds: [] };
}
function initialManifest() {
  const rows = [
    ['1948-03-17', 'baggage', '棕色皮箱', [0.7, 0.45, 0.38], '内衬底角三针蓝线'],
    ['1950-11-04', 'parcel', '帆布工具包', [0.52, 0.32, 0.3], '内袋有倒写的山字'],
    ['1952-06-12', 'small', '黄铜怀表', [0.08, 0.06, 0.09], '底盖内侧刻两颗星'],
    ['1954-02-23', 'document', '布面速写簿', [0.22, 0.04, 0.3], '第七页画有缺轮自行车'],
    ['1956-09-09', 'baggage', '深绿旅行袋', [0.65, 0.4, 0.32], '衬袋缝有白色方布'],
    ['1958-04-28', 'umbrella', '竹柄长伞', [0.1, 0.77, 0.1], '握柄底部缺一小角'],
    ['1960-12-19', 'valuable', '银色纪念盒', [0.24, 0.16, 0.2], '盒底垫纸画三片叶'],
    ['1962-08-05', 'parcel', '木制棋具盒', [0.4, 0.12, 0.35], '少一枚黑马并有纸替子'],
    ['1963-01-21', 'small', '圆框眼镜盒', [0.18, 0.06, 0.08], '盒盖内贴半枚蓝花纸'],
    ['1964-05-14', 'baggage', '灰色藤箱', [0.72, 0.5, 0.4], '箱盖内有三道紫墨线'],
    ['1965-07-30', 'document', '虚构乘务笔记', [0.16, 0.03, 0.22], '末页写有海鸥与十三'],
    ['1966-10-02', 'parcel', '红布针线篮', [0.34, 0.28, 0.32], '底层藏一枚木纽扣'],
    ['1967-03-18', 'small', '袖珍口琴', [0.13, 0.04, 0.04], '底面第六孔旁有短划痕'],
    ['1968-06-22', 'baggage', '褐色公文箱', [0.5, 0.35, 0.15], '内夹缝有折成船的纸'],
    ['1969-09-11', 'oversize', '舞台道具木箱', [1.6, 1.1, 0.75], '右内壁画有白色月牙'],
    ['1970-02-07', 'document', '虚构旧学生证套', [0.11, 0.02, 0.08], '夹层有紫色手缝十字'],
    ['1971-04-29', 'parcel', '蓝白饭盒袋', [0.28, 0.24, 0.22], '底部绣有三枚稻穗'],
    ['1972-08-16', 'small', '木雕小鸟', [0.12, 0.1, 0.08], '底座有两枚不同钉头'],
    ['1973-11-03', 'baggage', '黑色相机袋', [0.3, 0.26, 0.22], '肩带内侧有黄色双结'],
    ['1974-05-26', 'umbrella', '蓝格折伞', [0.13, 0.36, 0.13], '第二根伞骨绑红棉线'],
    ['1975-01-15', 'valuable', '旧黄铜罗盘', [0.16, 0.07, 0.16], '盖内写有虚构北湾号'],
    ['1975-09-08', 'parcel', '纸包搪瓷杯', [0.2, 0.2, 0.2], '杯底手绘绿色小圆点'],
    ['1976-02-19', 'document', '船形书签册', [0.16, 0.04, 0.23], '第三张书签缺右上角'],
    ['1976-06-28', 'baggage', '米色布旅行箱', [0.68, 0.48, 0.35], '内衬藏有空白信封和蓝线']
  ];
  return rows.map(([receivedAt, category, label, dimensions, internalFeature], i) => ({ itemId: `LP-${String(i + 1).padStart(4, '0')}`, receivedAt, foundAt: i % 3 === 0 ? null : receivedAt, category, label, dimensions, internalFeature, source: ['railway', 'aviation', 'maritime', 'public'][i % 4], slotId: category === 'valuable' ? `VAULT-${pad(i === 6 ? 1 : 2)}` : category === 'oversize' ? 'OVERSIZE-01' : category === 'small' || category === 'document' ? `R${pad(11 + (i % 6))}-B${pad(1 + Math.floor(i / 6))}-L${1 + i % 6}-A-C${1 + i % 6}` : `R${pad(1 + i % 10)}-B${pad(1 + Math.floor(i / 10))}-L${1 + i % 6}-${i % 2 ? 'B' : 'A'}` }));
}
export function createInventory(options = {}) {
  const worldTime = time(options.worldTime ?? WORLD_START), manifest = options.items ?? initialManifest();
  check(Array.isArray(manifest), 'INVALID_MANIFEST', 'Initial items must be an array.');
  const s = { schemaVersion: SCHEMA_VERSION, scenario: 'lost-property-bureau-r03-fictional-1976', worldTime, initialWorldTime: worldTime, seed: options.seed ?? 1976, revision: 0, items: {}, slots: {}, tasks: {}, carriers: {}, claims: {}, lossReports: {}, receipts: {}, commands: {}, events: [], lastEventSequence: 0, lastEventId: null, ledger: { initial: manifest.length, received: 0, delivered: 0, externallyTransferred: 0, disposed: 0 }, capacity: { addressedRackSlots: ADDRESS_CAPACITY, actualInitialItems: manifest.length }, policy: { id: 'FICTIONAL-1976-PENDING', automaticDisposal: false, realInstitutionData: false } };
  for (const input of manifest) {
    const item = normalizedItem(input, worldTime, true); check(!s.items[item.itemId], 'DUPLICATE_ITEM', 'Duplicate initial item ID.');
    const slot = materialize(s, input.slotId); check(['rack', 'vault', 'oversize'].includes(slot.kind), 'INITIAL_LOCATION', 'Initial items require a storage location.');
    check(!slot.occupiedBy && fitsSlot(item, slot), 'INITIAL_SLOT_CONFLICT', 'Initial slot is occupied or incompatible.');
    s.items[item.itemId] = item; slot.occupiedBy = item.itemId;
    event(s, 'scripted_initial_custody', item.itemId, { to: item.location, receivedAt: item.receivedAt, actorRef: 'fictional-scenario-initializer' });
  }
  assertInvariants(s); return s;
}
export function itemAgeYears(s, itemOrId) { return (s.worldTime - (typeof itemOrId === 'string' ? itemById(s, itemOrId) : itemOrId).receivedAt) / (YEAR_SECONDS * 1000); }
export function publicItem(s, itemId) {
  const i = itemById(s, itemId); return { itemId: i.itemId, label: i.label, category: i.category, source: i.source, publicDescription: i.publicDescription, receivedAt: i.receivedAt, foundAt: i.foundAt, state: i.state, ageYears: itemAgeYears(s, i) };
}
export function summary(s) {
  const items = Object.values(s.items), local = items.filter(i => i.state !== 'delivered');
  return { worldTime: s.worldTime, worldDate: new Date(s.worldTime).toISOString(), inCustody: local.length, stored: items.filter(i => i.state === 'stored').length, moving: items.filter(i => i.location.type === 'carrier').length, awaitingHandover: items.filter(i => i.state === 'handover').length, delivered: s.ledger.delivered, initial: s.ledger.initial, received: s.ledger.received, addressCapacity: ADDRESS_CAPACITY, occupiedRackSlots: Object.values(s.slots).filter(p => p.kind === 'rack' && p.occupiedBy).length, reservedSlots: Object.values(s.slots).filter(p => p.reservedBy).length, oldestReceiptYear: items.length ? Math.min(...items.map(i => new Date(i.receivedAt).getUTCFullYear())) : null, reviewRequired: local.filter(i => i.retention.reviewRequired).length };
}
function changeTime(s, seconds, commandId = null) {
  check(Number.isFinite(seconds) && seconds >= 0, 'TIME_REVERSAL', 'Advance by a finite nonnegative number of seconds; replay cannot edit live time.');
  time(s.worldTime + seconds * 1000); s.worldTime += seconds * 1000;
  for (const i of Object.values(s.items)) if (i.state !== 'delivered' && i.retention.reviewAt !== null && s.worldTime >= i.retention.reviewAt && !i.retention.reviewRequired) {
    i.retention.reviewRequired = true; i.version++; event(s, 'retention_review_due', i.itemId, { actorRef: 'world-clock', scheduledAt: i.retention.reviewAt, action: 'review-only' }, commandId);
  }
  return { worldTime: s.worldTime };
}
export function advanceTime(s, secondsOrCommand) {
  if (typeof secondsOrCommand === 'number') { const result = changeTime(s, secondsOrCommand); s.revision++; return result; }
  return transact(s, secondsOrCommand, 'advanceTime', d => changeTime(d, secondsOrCommand.seconds, secondsOrCommand.commandId));
}
export function intake(s, c) {
  return transact(s, c, 'intake', d => {
    const input = c.item || c; check(!d.items[input.itemId], 'DUPLICATE_ITEM', 'This item identity is already registered.');
    const item = normalizedItem(input, d.worldTime), slotId = input.slotId || freeSlot(d, item, 'receiving'), slot = materialize(d, slotId);
    check(slot.kind === 'receiving' && !slot.occupiedBy && !slot.reservedBy && fitsSlot(item, slot), 'INTAKE_POSITION', 'Use a vacant, compatible receiving position.');
    item.location.slotId = slotId; d.items[item.itemId] = item; slot.occupiedBy = item.itemId; d.ledger.received++;
    const receiptId = `RECEIPT-${c.commandId}`; d.receipts[receiptId] = { receiptId, type: 'intake', itemId: item.itemId, at: d.worldTime, fromRef: c.fromRef || 'fictional-finder', commandId: c.commandId };
    event(d, 'intake_confirmed', item.itemId, { to: item.location, actorRef: c.actorRef || 'fictional-intake-clerk', receiptId }, c.commandId);
    return { itemId: item.itemId, status: item.state, receiptId };
  });
}
export function inspectItem(s, c) {
  return transact(s, c, 'inspectItem', d => {
    const i = itemById(d, c.itemId); check(i.state === 'receiving' && !i.activeTaskId, 'WRONG_STATE', 'Inspection requires the received item at its current position.');
    check(c.inspectorRef && typeof c.safeToStore === 'boolean', 'MISSING_INSPECTION', 'An inspector and explicit safe-to-store result are required.');
    i.inspected = c.safeToStore; i.state = c.safeToStore ? 'awaiting_storage' : 'quarantined'; i.holdReason = c.safeToStore ? null : 'inspection-pending-or-unsafe'; i.version++;
    event(d, 'inspection_recorded', i.itemId, { safeToStore: c.safeToStore, actorRef: c.inspectorRef, position: i.location }, c.commandId); return { itemId: i.itemId, status: i.state };
  });
}
function makeMove(s, c, item, kind, targetSlotId, claimId = null) {
  check(!item.activeTaskId && item.location.type === 'slot', 'ITEM_BUSY', 'Item is already moving or has a live transport task.');
  check(!item.holdReason, 'ITEM_HELD', 'Resolve the item hold before moving it.');
  const target = materialize(s, targetSlotId), source = materialize(s, item.location.slotId);
  check(source.occupiedBy === item.itemId && source.slotId !== targetSlotId, 'SOURCE_CONFLICT', 'Source custody position is inconsistent or identical to target.');
  check(!target.occupiedBy && !target.reservedBy && fitsSlot(item, target), 'TARGET_UNAVAILABLE', 'Target must be compatible, enabled, vacant and unreserved.');
  const taskId = id(c.taskId || `MOVE-${c.commandId}`), carrierId = id(c.carrierId || `CARRIER-${taskId}`);
  check(!s.tasks[taskId], 'DUPLICATE_TASK', 'Task ID already exists.');
  const carrier = s.carriers[carrierId]; check(!carrier?.itemId && !carrier?.activeTaskId, 'CARRIER_BUSY', 'The carrier has another task.');
  const durationSeconds = c.durationSeconds ?? 12; check(Number.isFinite(durationSeconds) && durationSeconds >= 0, 'INVALID_DURATION', 'Transport duration must be nonnegative.');
  const task = { taskId, itemId: item.itemId, kind, claimId, from: clone(item.location), to: { type: 'slot', slotId: targetSlotId }, carrierId, status: 'reserved', previousStatus: null, sourceItemState: item.state, createdAt: s.worldTime, startedAt: null, dueAt: null, arrivedAt: null, completedAt: null, durationSeconds, blockedAt: null, blockedSeconds: 0, returnRequired: false };
  if (kind === 'return') item.returnPending = false;
  s.tasks[taskId] = task; target.reservedBy = taskId; item.activeTaskId = taskId; item.version++;
  s.carriers[carrierId] = { carrierId, itemId: null, activeTaskId: taskId, position: slotPosition(source.slotId) };
  event(s, 'move_reserved', item.itemId, { taskId, kind, from: task.from, to: task.to, actorRef: c.actorRef || 'fictional-dispatcher' }, c.commandId);
  return { taskId, itemId: item.itemId, status: task.status, targetSlotId };
}
export function requestMove(s, c) {
  return transact(s, c, 'requestMove', d => {
    const i = itemById(d, c.itemId); check(i.inspected && ['awaiting_storage', 'stored', 'handover'].includes(i.state), 'INSPECTION_REQUIRED', 'Storage moves require completed inspection and a stable position.');
    check(!i.activeClaimId, 'CLAIM_ACTIVE', 'Use the active claim workflow for this item.');
    const target = c.targetSlotId || freeSlot(d, i), spec = getSlot(target); check(['rack', 'vault', 'oversize'].includes(spec.kind), 'WRONG_TARGET', 'A storage move needs a storage position.');
    return makeMove(d, c, i, i.state === 'handover' ? 'return' : i.state === 'stored' ? 'relocate' : 'putaway', target);
  });
}
export function verifyClaim(s, c) {
  return transact(s, c, 'verifyClaim', d => {
    const i = itemById(d, c.itemId), claimId = id(c.claimId), claimantRef = id(c.claimantRef);
    check(i.state !== 'delivered', 'ALREADY_DELIVERED', 'This item was already handed over.');
    const old = d.claims[claimId]; check(!old || old.itemId === i.itemId && old.claimantRef === claimantRef && ['rejected', 'review'].includes(old.status), 'CLAIM_ID_CONFLICT', 'This claim ID cannot be reassigned or silently reapproved.');
    const matchPassed = typeof c.hiddenFeature === 'string' && c.hiddenFeature.trim() === i.internalFeature;
    const identityPassed = c.identityVerified === true && typeof c.identityReference === 'string' && c.identityReference.trim().length > 0;
    const actingAs = c.actingAs || 'owner'; check(['owner', 'representative'].includes(actingAs), 'INVALID_CLAIMANT_ROLE', 'Use owner or representative.');
    const authorizationPassed = actingAs === 'owner' || c.proxyAuthorized === true && typeof c.authorizationReference === 'string' && c.authorizationReference.length > 0;
    check(typeof c.reviewerRef === 'string' && c.reviewerRef.length > 0, 'REVIEWER_REQUIRED', 'An explicit reviewer is required.');
    const reasons = []; if (!matchPassed) reasons.push('hidden-feature-not-matched'); if (!identityPassed) reasons.push('identity-not-verified'); if (!authorizationPassed) reasons.push('proxy-not-authorized');
    const claim = { claimId, itemId: i.itemId, claimantRef, actingAs, submittedAt: old?.submittedAt ?? d.worldTime, reviewedAt: d.worldTime, reviewerRef: c.reviewerRef, checks: { hiddenFeature: matchPassed, identity: identityPassed, authorization: authorizationPassed }, identityReference: identityPassed ? c.identityReference : null, authorizationReference: actingAs === 'representative' && authorizationPassed ? c.authorizationReference : null, status: reasons.length ? 'rejected' : 'approved', reasons, taskId: null, completedAt: null };
    d.claims[claimId] = claim;
    if (!reasons.length) {
      const others = Object.values(d.claims).filter(x => x.claimId !== claimId && x.itemId === i.itemId && ['approved', 'picking', 'ready', 'disputed'].includes(x.status));
      if (others.length || i.holdReason) {
        claim.status = 'disputed'; claim.reasons.push('explicit-dispute-review-required'); others.forEach(x => { x.status = 'disputed'; }); i.activeClaimId = null; i.holdReason = i.holdReason || 'conflicting-claims';
      } else i.activeClaimId = claimId;
      i.version++;
    }
    event(d, 'claim_reviewed', i.itemId, { claimId, checks: claim.checks, status: claim.status, reasons: claim.reasons, actorRef: c.reviewerRef }, c.commandId);
    return { itemId: i.itemId, claimId, status: claim.status, checks: clone(claim.checks), reasons: [...claim.reasons] };
  });
}
export function resolveClaimDispute(s, c) {
  return transact(s, c, 'resolveClaimDispute', d => {
    const i = itemById(d, c.itemId), chosen = d.claims[c.approvedClaimId];
    check(i.holdReason === 'conflicting-claims' && chosen?.itemId === i.itemId && chosen.status === 'disputed' && c.reviewerRef && c.reason, 'EXPLICIT_REVIEW_REQUIRED', 'Name a reviewed claim, reviewer and resolution reason.');
    check(!i.activeTaskId, 'TASK_RECOVERY_REQUIRED', 'Finish or safely cancel the existing transport before resolving the claim.');
    for (const claim of Object.values(d.claims).filter(x => x.itemId === i.itemId && x.status === 'disputed')) { claim.status = claim === chosen ? (i.state === 'handover' ? 'ready' : 'approved') : 'rejected'; claim.reasons.push(c.reason); }
    i.activeClaimId = chosen.claimId; i.holdReason = null; i.version++;
    event(d, 'claim_dispute_resolved', i.itemId, { claimId: chosen.claimId, actorRef: c.reviewerRef, reason: c.reason }, c.commandId);
    return { itemId: i.itemId, claimId: chosen.claimId, status: chosen.status };
  });
}
export function requestPick(s, c) {
  return transact(s, c, 'requestPick', d => {
    const claim = d.claims[c.claimId]; check(claim && claim.status === 'approved', 'CLAIM_NOT_APPROVED', 'An approved, independently verified claim is required.');
    const i = itemById(d, claim.itemId); check(i.activeClaimId === claim.claimId && i.state === 'stored' && !i.holdReason, 'ITEM_NOT_RELEASABLE', 'Item must be stored with this sole authorization and no hold.');
    const target = c.targetSlotId || freeSlot(d, i, 'handover'); check(getSlot(target).kind === 'handover', 'WRONG_TARGET', 'Picking ends at a handover position.');
    const result = makeMove(d, c, i, 'pick', target, claim.claimId); claim.status = 'picking'; claim.taskId = result.taskId; return result;
  });
}
export function taskProgress(s, taskOrId) {
  const task = typeof taskOrId === 'string' ? s.tasks[taskOrId] : taskOrId; check(task, 'UNKNOWN_TASK', 'Unknown transport task.');
  if (task.status === 'completed') return 1; if (task.startedAt === null) return 0;
  const at = task.status === 'blocked' ? task.blockedAt : s.worldTime;
  return task.durationSeconds === 0 ? 1 : Math.max(0, Math.min(1, (at - task.startedAt - task.blockedSeconds * 1000) / (task.durationSeconds * 1000)));
}
/** Item centres sit above the actual shelf floor, including both small-cell rows. */
function itemSlotPosition(item, slotId, layout = {}) {
  const slot = getSlot(slotId), p = slotPosition(slotId, layout);
  if (slot.kind === 'rack') p[1] = (layout.shelfFloor ?? 0.3) + (slot.level - 1) * (layout.levelPitch || 1.15) + (slot.cell ? Math.floor((slot.cell - 1) / 3) * (layout.levelPitch || 1.15) / 2 : 0) + 0.04 + item.dimensions[1] / 2;
  else p[1] += item.dimensions[1] / 2;
  return p;
}
/** Dogleg transport interpolation via rack aisles and clear front/rear cross aisles.
 * The host must still validate obstructions and send block/resume confirmations.
 */
export function taskWaypoints(s, taskOrId, layout = {}) {
  const task = typeof taskOrId === 'string' ? s.tasks[taskOrId] : taskOrId; check(task, 'UNKNOWN_TASK', 'Unknown transport task.');
  const i = itemById(s, task.itemId), a = itemSlotPosition(i, task.from.slotId, layout), b = itemSlotPosition(i, task.to.slotId, layout);
  const from = getSlot(task.from.slotId), to = getSlot(task.to.slotId), laneY = (layout.transportFloor ?? 0.65) + i.dimensions[1] / 2;
  const aisle = (slot, p) => slot.kind === 'rack' ? p[0] + (slot.face === 'A' ? -1.05 : 1.05) : p[0];
  const ax = aisle(from, a), bx = aisle(to, b), crossZ = (from.kind === 'handover' || to.kind === 'handover') ? (layout.frontCrossAisle ?? -17) : (layout.rearCrossAisle ?? 13);
  // Clear the public counter before lowering, and lift before approaching it.
  // This prevents both static and moving parcels from intersecting its body.
  const base = [a, [ax, a[1], a[2]]];
  if (from.kind === 'handover') base.push([ax, a[1], -21]);
  base.push([ax, laneY, from.kind === 'handover' ? -21 : a[2]], [ax, laneY, crossZ], [bx, laneY, crossZ]);
  if (to.kind === 'handover') base.push([bx, b[1], crossZ], [bx, b[1], b[2]]);
  else base.push([bx, laneY, b[2]], [bx, b[1], b[2]]);
  base.push(b);
  // Partitions are at z=-20 and z=22, with door centres x=0, ±16, ±32.
  // Every crossing gets explicit approach and exit nodes at a door centre.
  // The front approach is the clear z=-17 cross aisle, exit z=-21;
  // the rear approaches are z=21 and z=23 on the two sides of its wall.
  const gates = [{ wall: -20, lower: -21, upper: layout.frontCrossAisle ?? -17 }, { wall: 22, lower: 21, upper: 23 }];
  const path = [base[0]];
  for (let n = 1; n < base.length; n++) {
    const fromPoint = base[n - 1], toPoint = base[n];
    const crossed = gates.filter(g => (fromPoint[2] - g.wall) * (toPoint[2] - g.wall) < 0).sort((g, h) => toPoint[2] > fromPoint[2] ? g.wall - h.wall : h.wall - g.wall);
    for (const gate of crossed) {
      const increasing = toPoint[2] > fromPoint[2], beforeZ = increasing ? gate.lower : gate.upper, afterZ = increasing ? gate.upper : gate.lower;
      const doorX = Math.max(-32, Math.min(32, Math.round(toPoint[0] / 16) * 16));
      path.push([fromPoint[0], fromPoint[1], beforeZ], [doorX, fromPoint[1], beforeZ], [doorX, toPoint[1], afterZ], [toPoint[0], toPoint[1], afterZ]);
    }
    path.push(toPoint);
  }
  return path;
}
export function itemPosition(s, itemOrId, layout = {}) {
  const i = typeof itemOrId === 'string' ? itemById(s, itemOrId) : itemOrId;
  if (i.location.type === 'slot') return itemSlotPosition(i, i.location.slotId, layout);
  if (i.location.type === 'recipient') return null;
  const task = s.tasks[i.activeTaskId], path = taskWaypoints(s, task, layout), lengths = path.slice(1).map((p, n) => Math.hypot(...p.map((v, axis) => v - path[n][axis])));
  let distance = lengths.reduce((a, b) => a + b, 0) * taskProgress(s, task);
  for (let n = 0; n < lengths.length; n++) { if (distance <= lengths[n] && lengths[n] > 0) { const t = distance / lengths[n]; return path[n].map((v, axis) => v + (path[n + 1][axis] - v) * t); } distance -= lengths[n]; }
  return [...path.at(-1)];
}
function scheduleReturn(s, task, item, commandId) {
  let target;
  try { target = freeSlot(s, item, 'storage', task.from.slotId); }
  catch (error) {
    if (error.code !== 'NO_COMPATIBLE_SLOT') throw error;
    item.returnPending = true;
    event(s, 'return_waiting_for_space', item.itemId, { position: item.location, actorRef: 'fictional-return-clerk' }, commandId);
    return { itemId: item.itemId, status: 'return_waiting_for_space' };
  }
  return makeMove(s, { commandId, taskId: `RETURN-${task.taskId}`, carrierId: task.carrierId, durationSeconds: task.durationSeconds, actorRef: 'fictional-return-clerk' }, item, 'return', target, task.claimId);
}
/** Cancellation never teleports a picked-up item; it must reach a safe position. */
export function cancelTask(s, c) {
  return transact(s, c, 'cancelTask', d => {
    const task = d.tasks[c.taskId]; check(task && ACTIVE.has(task.status), 'TASK_NOT_ACTIVE', 'No active task to cancel.');
    check(c.reason && c.actorRef, 'CANCEL_REASON_REQUIRED', 'A cancellation reason and operator are required.');
    const i = itemById(d, task.itemId), phase = task.status === 'blocked' ? task.previousStatus : task.status;
    if (phase === 'reserved') {
      d.slots[task.to.slotId].reservedBy = null; d.carriers[task.carrierId].activeTaskId = null; i.activeTaskId = null; task.status = 'cancelled'; task.completedAt = d.worldTime;
      const claim = task.claimId && d.claims[task.claimId]; if (claim?.status === 'picking') { claim.status = 'approved'; claim.taskId = null; }
    } else { task.cancelRequested = true; task.returnRequired = task.kind === 'pick'; }
    i.version++; event(d, 'move_cancellation_requested', i.itemId, { taskId: task.taskId, position: i.location, reason: c.reason, actorRef: c.actorRef }, c.commandId);
    return { taskId: task.taskId, itemId: i.itemId, status: task.status, cancelRequested: !!task.cancelRequested };
  });
}
export function advanceTask(s, c) {
  return transact(s, c, 'advanceTask', d => {
    const task = d.tasks[c.taskId]; check(task && ACTIVE.has(task.status), 'TASK_NOT_ACTIVE', 'No active transport task.');
    const i = itemById(d, task.itemId), carrier = d.carriers[task.carrierId], source = materialize(d, task.from.slotId), target = materialize(d, task.to.slotId);
    if (c.action === 'block') {
      check(task.status !== 'blocked' && c.reason, 'BLOCK_REASON_REQUIRED', 'An unblocked task and obstruction reason are required.');
      task.previousStatus = task.status; task.status = 'blocked'; task.blockedAt = d.worldTime; task.blockReason = c.reason;
    } else if (c.action === 'resume') {
      check(task.status === 'blocked', 'TASK_NOT_BLOCKED', 'Only a blocked task can resume.');
      if (task.previousStatus === 'moving') { const elapsed = d.worldTime - task.blockedAt; task.blockedSeconds += elapsed / 1000; task.dueAt += elapsed; }
      task.status = task.previousStatus; task.previousStatus = null; task.blockedAt = null; task.blockReason = null;
    } else if (c.action === 'pickup') {
      check(task.status === 'reserved' && !i.holdReason, 'PICKUP_BLOCKED', 'Pickup requires an unblocked reservation and no item hold.');
      check(source.occupiedBy === i.itemId && target.reservedBy === task.taskId && !carrier.itemId, 'CUSTODY_CONFLICT', 'Source, target reservation or carrier is inconsistent.');
      source.occupiedBy = null; carrier.itemId = i.itemId; i.location = { type: 'carrier', carrierId: carrier.carrierId }; i.state = task.kind === 'pick' ? 'pick_transit' : 'in_transit';
      task.status = 'moving'; task.startedAt = d.worldTime; task.dueAt = d.worldTime + task.durationSeconds * 1000;
    } else if (c.action === 'arrive') {
      check(task.status === 'moving' && d.worldTime >= task.dueAt, 'NOT_ARRIVED', 'Transport must be unblocked and reach its world-time destination first.');
      check(target.reservedBy === task.taskId && !target.occupiedBy && carrier.itemId === i.itemId && fitsSlot(i, target), 'CUSTODY_CONFLICT', 'Destination or carrier is inconsistent.');
      target.occupiedBy = i.itemId; target.reservedBy = null; carrier.itemId = null; carrier.activeTaskId = null; carrier.position = slotPosition(target.slotId);
      i.location = clone(task.to); i.state = target.kind === 'handover' ? 'handover' : 'stored'; i.activeTaskId = null;
      task.status = 'completed'; task.arrivedAt = d.worldTime; task.completedAt = d.worldTime;
      const claim = task.claimId && d.claims[task.claimId]; if (task.kind === 'pick' && claim?.status === 'picking') { claim.status = task.cancelRequested ? 'approved' : 'ready'; if (task.cancelRequested) claim.taskId = null; }
      event(d, 'move_arrived', i.itemId, { taskId: task.taskId, from: { type: 'carrier', carrierId: carrier.carrierId }, to: i.location, actorRef: c.actorRef || 'fictional-handler' }, c.commandId);
      if (task.returnRequired && !i.holdReason) scheduleReturn(d, task, i, c.commandId);
    } else fail('INVALID_TASK_ACTION', 'Use pickup, arrive, block or resume.');
    i.version++; event(d, `move_${c.action}`, i.itemId, { taskId: task.taskId, position: i.location, actorRef: c.actorRef || 'fictional-handler', reason: c.reason || null }, c.commandId);
    return { taskId: task.taskId, itemId: i.itemId, status: task.status, activeTaskId: i.activeTaskId };
  });
}
export function cancelClaim(s, c) {
  return transact(s, c, 'cancelClaim', d => {
    const claim = d.claims[c.claimId]; check(claim && ['approved', 'picking', 'ready'].includes(claim.status), 'CLAIM_NOT_CANCELLABLE', 'Claim cannot be cancelled in this state.');
    const i = itemById(d, claim.itemId), task = claim.taskId && d.tasks[claim.taskId]; claim.status = 'cancelled'; claim.cancelledAt = d.worldTime; i.activeClaimId = null;
    if (task && ACTIVE.has(task.status)) {
      if (task.status === 'reserved' || task.status === 'blocked' && task.previousStatus === 'reserved') {
        d.slots[task.to.slotId].reservedBy = null; d.carriers[task.carrierId].activeTaskId = null; task.status = 'cancelled'; task.completedAt = d.worldTime; i.activeTaskId = null;
      } else task.returnRequired = true;
    } else if (i.state === 'handover' && task) scheduleReturn(d, task, i, c.commandId);
    i.version++; event(d, 'claim_cancelled', i.itemId, { claimId: claim.claimId, position: i.location, actorRef: c.actorRef || claim.claimantRef }, c.commandId);
    return { claimId: claim.claimId, itemId: i.itemId, status: claim.status, activeTaskId: i.activeTaskId };
  });
}
export function confirmHandover(s, c) {
  return transact(s, c, 'confirmHandover', d => {
    const claim = d.claims[c.claimId]; check(claim?.status === 'ready', 'HANDOVER_NOT_READY', 'An approved claim and completed delivery to the handover position are required.');
    const i = itemById(d, claim.itemId);
    check(i.activeClaimId === claim.claimId && i.state === 'handover' && !i.activeTaskId && !i.holdReason, 'HANDOVER_BLOCKED', 'Actual item must be at handover with no hold or transport task.');
    check(c.actualItemId === i.itemId && c.recipientRef === claim.claimantRef && c.identityRechecked === true && c.receivedConfirmed === true && c.clerkRef, 'HANDOVER_CONFIRMATION_REQUIRED', 'Check actual item, recipient identity, clerk and explicit receipt confirmation.');
    const from = clone(i.location), slot = materialize(d, from.slotId), receiptId = `RECEIPT-${c.commandId}`;
    check(slot.occupiedBy === i.itemId, 'CUSTODY_CONFLICT', 'The item is absent from its recorded handover position.');
    slot.occupiedBy = null; i.state = 'delivered'; i.location = { type: 'recipient', personRef: c.recipientRef, receiptId }; i.activeClaimId = null; i.version++;
    claim.status = 'completed'; claim.completedAt = d.worldTime; d.ledger.delivered++;
    d.receipts[receiptId] = { receiptId, type: 'handover', itemId: i.itemId, claimId: claim.claimId, recipientRef: c.recipientRef, clerkRef: c.clerkRef, at: d.worldTime, commandId: c.commandId };
    event(d, 'handover_confirmed', i.itemId, { claimId: claim.claimId, receiptId, from, to: i.location, actorRef: c.clerkRef }, c.commandId);
    return { itemId: i.itemId, claimId: claim.claimId, receiptId, status: 'delivered' };
  });
}
export function retag(s, c) {
  return transact(s, c, 'retag', d => {
    const i = itemById(d, c.itemId); id(c.tag); check(i.state !== 'delivered', 'ALREADY_DELIVERED', 'Cannot retag delivered property.');
    check(!Object.values(d.items).some(item => item.tagAliases.some(t => t.tag === c.tag)), 'TAG_ALREADY_USED', 'A historical tag cannot be reassigned.');
    i.tagAliases.filter(t => t.retiredAt === null).forEach(t => { t.retiredAt = d.worldTime; }); i.tagAliases.push({ tag: c.tag, activeFrom: d.worldTime, retiredAt: null }); i.version++;
    event(d, 'tag_replaced', i.itemId, { tag: c.tag, actorRef: c.actorRef || 'fictional-clerk' }, c.commandId); return { itemId: i.itemId, tag: c.tag };
  });
}
export function recordLossReport(s, c) {
  return transact(s, c, 'recordLossReport', d => {
    const reportId = id(c.reportId); check(!d.lossReports[reportId], 'DUPLICATE_REPORT', 'Loss report already exists.'); id(c.personRef);
    d.lossReports[reportId] = { reportId, personRef: c.personRef, description: c.description || '', at: d.worldTime, candidates: [...(c.candidates || [])] };
    for (const itemId of d.lossReports[reportId].candidates) itemById(d, itemId);
    event(d, 'loss_report_recorded', null, { reportId, actorRef: c.personRef }, c.commandId); return { reportId };
  });
}
export function serializeInventory(s) { assertInvariants(s); return JSON.stringify(s); }
export function restoreInventory(serialized) {
  let s; try { s = typeof serialized === 'string' ? JSON.parse(serialized) : clone(serialized); } catch { fail('INVALID_SNAPSHOT', 'Snapshot is not complete JSON. No replacement inventory was generated.'); }
  check(s?.schemaVersion === SCHEMA_VERSION && s.scenario === 'lost-property-bureau-r03-fictional-1976', 'SNAPSHOT_VERSION', 'Unsupported or incomplete scene snapshot.'); assertInvariants(s); return s;
}
/** Throws on corruption. Returns an audit suitable for the UI/test report. */
export function assertInvariants(s) {
  check(s && s.schemaVersion === SCHEMA_VERSION && Number.isFinite(s.worldTime) && Number.isFinite(s.initialWorldTime) && s.worldTime >= s.initialWorldTime && Number.isInteger(s.revision) && s.revision >= 0, 'INVARIANT', 'Invalid scene header.');
  for (const key of ['items', 'slots', 'tasks', 'carriers', 'claims', 'commands', 'receipts', 'lossReports']) check(s[key] && typeof s[key] === 'object' && !Array.isArray(s[key]), 'INVARIANT', `Missing ${key}.`);
  check(Array.isArray(s.events) && s.events.length === s.lastEventSequence && s.lastEventId === (s.events.at(-1)?.eventId || null), 'INVARIANT', 'Broken event sequence.');
  const eventIds = new Set(); let priorTime = -Infinity;
  for (let n = 0; n < s.events.length; n++) { const e = s.events[n]; check(e.sequence === n + 1 && e.eventId === `E-${String(n + 1).padStart(7, '0')}` && e.worldTime >= priorTime && e.worldTime <= s.worldTime, 'INVARIANT', 'Event ordering or time is invalid.'); check(e.commandId === null || !!s.commands[e.commandId], 'INVARIANT', 'Applied command ledger is missing.'); eventIds.add(e.eventId); priorTime = e.worldTime; }
  const occupied = new Set(), reservations = new Set(), activeItems = new Set(), tags = new Set();
  for (const [slotId, slot] of Object.entries(s.slots)) {
    const spec = getSlot(slotId); check(slot.slotId === slotId && stable(slot.dimensions) === stable(spec.dimensions) && stable(slot.categories) === stable(spec.categories) && slot.kind === spec.kind, 'INVARIANT', 'Slot specification changed.');
    if (slot.occupiedBy) { const i = s.items[slot.occupiedBy]; check(i && !occupied.has(i.itemId) && i.location.type === 'slot' && i.location.slotId === slotId && fitsSlot(i, { ...slot, disabled: false }), 'INVARIANT', 'Duplicate/incompatible occupancy or item location mismatch.'); occupied.add(i.itemId); }
    if (slot.reservedBy) { const task = s.tasks[slot.reservedBy]; check(!slot.occupiedBy && !slot.disabled && task && ACTIVE.has(task.status) && task.to.slotId === slotId && fitsSlot(s.items[task.itemId], slot) && !reservations.has(task.taskId), 'INVARIANT', 'Invalid or duplicate target reservation.'); reservations.add(task.taskId); }
  }
  let local = 0, delivered = 0;
  for (const [itemId, i] of Object.entries(s.items)) {
    check(itemId === i.itemId && CATEGORIES.includes(i.category) && positiveSize(i.dimensions) && Number.isInteger(i.version) && i.version >= 1, 'INVARIANT', 'Invalid item identity, size or version.');
    check(Number.isFinite(i.receivedAt) && i.receivedAt <= s.worldTime && (i.foundAt === null || Number.isFinite(i.foundAt) && i.foundAt <= i.receivedAt), 'INVARIANT', 'Invalid receipt/found date.');
    check(i.retention && (i.retention.reviewAt === null || Number.isFinite(i.retention.reviewAt)), 'INVARIANT', 'Invalid retention review time.');
    check(Array.isArray(i.eventIds) && i.eventIds.length > 0 && i.eventIds.every(e => eventIds.has(e) && s.events[+e.slice(2) - 1].itemId === itemId) && stable(i.eventIds) === stable(s.events.filter(e => e.itemId === itemId).map(e => e.eventId)), 'INVARIANT', 'Broken custody event chain.');
    check(Array.isArray(i.tagAliases) && i.tagAliases.length && i.tagAliases.filter(t => t.retiredAt === null).length === 1, 'INVARIANT', 'Exactly one current tag is required.');
    for (const t of i.tagAliases) { check(!tags.has(t.tag) && Number.isFinite(t.activeFrom) && t.activeFrom <= s.worldTime && (t.retiredAt === null || t.retiredAt >= t.activeFrom && t.retiredAt <= s.worldTime), 'INVARIANT', 'Tag identity/time conflict.'); tags.add(t.tag); }
    if (i.state === 'delivered') { delivered++; check(i.location.type === 'recipient' && s.receipts[i.location.receiptId]?.itemId === itemId && s.receipts[i.location.receiptId]?.type === 'handover' && !i.activeTaskId && !i.activeClaimId && !occupied.has(itemId), 'INVARIANT', 'Delivered item lacks an exclusive handover receipt.'); }
    else { local++; check(['stored', 'receiving', 'awaiting_storage', 'quarantined', 'in_transit', 'pick_transit', 'handover'].includes(i.state), 'INVARIANT', 'Unknown custody state.');
      if (i.location.type === 'slot') { check(occupied.has(itemId), 'INVARIANT', 'Item has no occupied position.'); const kind = s.slots[i.location.slotId].kind; check(i.state !== 'in_transit' && i.state !== 'pick_transit' && (i.state !== 'stored' || ['rack', 'vault', 'oversize'].includes(kind)) && (i.state !== 'handover' || kind === 'handover'), 'INVARIANT', 'Custody state disagrees with position.'); }
      else if (i.location.type === 'carrier') { const carrier = s.carriers[i.location.carrierId]; check(carrier?.itemId === itemId && i.activeTaskId && carrier.activeTaskId === i.activeTaskId && ['in_transit', 'pick_transit'].includes(i.state), 'INVARIANT', 'Transported item lost its carrier.'); }
      else fail('INVARIANT', 'Local item must have exactly one slot or carrier position.');
    }
    if (i.activeClaimId) { const claim = s.claims[i.activeClaimId]; check(claim?.itemId === itemId && ['approved', 'picking', 'ready'].includes(claim.status) && !i.holdReason, 'INVARIANT', 'Invalid sole release authority.'); }
    if (i.activeTaskId) check(s.tasks[i.activeTaskId]?.itemId === itemId && ACTIVE.has(s.tasks[i.activeTaskId].status), 'INVARIANT', 'Dangling active task.');
  }
  for (const [taskId, task] of Object.entries(s.tasks)) {
    check(taskId === task.taskId && s.items[task.itemId] && ['reserved', 'moving', 'blocked', 'completed', 'cancelled'].includes(task.status), 'INVARIANT', 'Unknown task identity/state.');
    if (ACTIVE.has(task.status)) {
      const i = s.items[task.itemId], carrier = s.carriers[task.carrierId];
      check(!activeItems.has(i.itemId) && i.activeTaskId === taskId && reservations.has(taskId) && carrier?.activeTaskId === taskId, 'INVARIANT', 'Task/item/carrier reservation conflict.'); activeItems.add(i.itemId);
      const phase = task.status === 'blocked' ? task.previousStatus : task.status;
      check(phase === 'reserved' ? equalPosition(i.location, task.from) && carrier.itemId === null : phase === 'moving' && i.location.type === 'carrier' && i.location.carrierId === task.carrierId && carrier.itemId === i.itemId && Number.isFinite(task.startedAt) && Number.isFinite(task.dueAt), 'INVARIANT', 'Task phase does not match actual custody.');
    }
  }
  for (const [carrierId, carrier] of Object.entries(s.carriers)) { check(carrier.carrierId === carrierId && (!carrier.activeTaskId || ACTIVE.has(s.tasks[carrier.activeTaskId]?.status) && s.tasks[carrier.activeTaskId].carrierId === carrierId), 'INVARIANT', 'Carrier holds a missing/finished task.'); if (carrier.itemId) check(s.items[carrier.itemId]?.location.type === 'carrier' && s.items[carrier.itemId].location.carrierId === carrierId, 'INVARIANT', 'Carrier has a phantom item.'); }
  const authorizedItems = new Set();
  for (const [claimId, claim] of Object.entries(s.claims)) { check(claim.claimId === claimId && s.items[claim.itemId], 'INVARIANT', 'Claim has no item.'); if (['approved', 'picking', 'ready'].includes(claim.status)) { check(!authorizedItems.has(claim.itemId) && Object.values(claim.checks).every(Boolean) && s.items[claim.itemId].activeClaimId === claimId, 'INVARIANT', 'Multiple/unchecked release authorities.'); authorizedItems.add(claim.itemId); } }
  check(s.ledger && Object.values(s.ledger).every(n => Number.isInteger(n) && n >= 0) && s.ledger.initial + s.ledger.received - s.ledger.delivered - s.ledger.externallyTransferred - s.ledger.disposed === local && s.ledger.delivered === delivered && Object.keys(s.items).length === s.ledger.initial + s.ledger.received, 'INVARIANT', 'Inventory conservation failed.');
  return { ok: true, inCustody: local, delivered, items: Object.keys(s.items).length, events: s.events.length, activeTasks: activeItems.size, reservations: reservations.size, addressCapacity: ADDRESS_CAPACITY };
}
