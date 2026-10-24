/** Event-driven inspection of the RETAINED KCC lift and design landings.
 * No geometry, actual-floor registration, room inventory or lift stop is made
 * here. One caller owns the clock: do not advance the lift a second time from
 * the old demonstration timer while this journey is active.
 */
export const KCC_JOURNEY_DISCLOSURE = Object.freeze({
  kind: 'retained_design_lift_journey_not_as_built_navigation',
  label: '设计巡检：序号不是现实楼层号；源外壳入口与全楼实户型尚未配准。',
  actualFloorRegistrationVerified: false,
  actualEntranceVerified: false,
  actualRoomReachabilityVerified: false,
  sourceShellEntryTraversed: false,
  sourceHiddenForInteriorInspection: false,
  basementLiftServiceAdded: false,
  geometryGenerated: false,
});

const copy = value => structuredClone(value);
const ACTIVE = new Set(['waiting-for-lift', 'boarding', 'riding', 'exiting']);
const PHASE_TEXT = {
  idle: '停在已有设计层走廊',
  'waiting-for-lift': '已呼梯，等待本层静止平层且双门全开',
  boarding: '沿原人体校验路径走入轿厢',
  riding: '已选层，等待原控制器闭门、锁闭、运行和平层开门',
  exiting: '沿原人体校验路径走出轿厢',
  arrived: '已走出轿厢，到达该设计层走廊',
  cancelled: '后续行程已取消，乘客停在设计层走廊',
  blocked: '行程阻挡，未宣告到达',
};

export function createKccJourney({building, liftRuntime, onPose = () => {}, onChange = () => {}}) {
  if (building?.caseId !== 'kcc' || !building.buildingId || !building.localModel)
    throw Error('Matching KCC building required');
  for (const name of ['snapshot', 'commandFor', 'beginBoard', 'beginExit', 'advance', 'ridePose'])
    if (typeof liftRuntime?.[name] !== 'function') throw Error('Lift runtime method required: ' + name);

  const initial = liftRuntime.snapshot('kcc');
  if (!initial.available || initial.caseId !== 'kcc' || initial.buildingId !== building.buildingId || !initial.liftId)
    throw Error('KCC lift ownership mismatch');
  const owner = {caseId: 'kcc', buildingId: building.buildingId, liftId: initial.liftId};
  const modelLevels = new Map(building.localModel.levels.map(f => [f.id, f]));
  const floors = initial.floors.map((f, index) => {
    const local = modelLevels.get(f.id);
    if (!local || local.groundExtension || local.componentId === 'basement-design' || /^B\d+$/.test(f.id) ||
        !Number.isFinite(f.elevation) || Math.abs(local.elevation - f.elevation) > 1e-8 ||
        (index && f.elevation <= initial.floors[index - 1].elevation))
      throw Error('Retained above-ground lift floor ownership required');
    return {id: f.id, ordinal: index + 1, label: `设计第 ${index + 1} 层 · ${f.id}`,
      elevation: f.elevation, actualFloorLabel: null, actualFloorRegistrationVerified: false};
  });
  if (floors.length < 2 || new Set(floors.map(f => f.id)).size !== floors.length)
    throw Error('Distinct retained lift floors required');
  const floorSignature = JSON.stringify(initial.floors.map(f => [f.id, f.elevation]));
  let phase = 'idle', paused = false, blockedFrom = null, reason = null, targetFloorId = null;
  let currentFloorId = initial.passenger?.floor ?? initial.current;
  let remaining = [], visitedFloorIds = [], selectedRoomId = null, cancellationRequested = false;
  let revision = 0, eventSerial = 0, rejectedAction = null;
  const events = [];

  const read = () => liftRuntime.snapshot('kcc');
  const matchesOwner = s => s?.available && Object.entries(owner).every(([k, v]) => s[k] === v) &&
    JSON.stringify(s.floors?.map(f => [f.id, f.elevation])) === floorSignature;
  const resolveFloor = value => typeof value === 'number' && Number.isInteger(value)
    ? floors[value - 1] : floors.find(f => f.id === value);
  const active = () => ACTIVE.has(phase);
  const rejection = (code, extra = {}) => ({accepted: false, blocked: true, reason: code, ...extra});
  function record(type, detail = {}) {
    events.push({serial: ++eventSerial, type, phase, ...detail});
    if (events.length > 200) events.shift();
    revision++;
  }
  function transition(next, detail = {}) {
    phase = next; reason = null; record(next, detail);
  }
  function block(code, detail = {}) {
    if (phase !== 'blocked') blockedFrom = phase;
    phase = 'blocked'; reason = code; record('blocked', {reason: code, ...detail});
  }
  function snapshot() {
    const lift = read();
    return {...owner, phase, status: PHASE_TEXT[phase], active: active(), paused,
      currentFloorId, targetFloorId, currentFloor: copy(resolveFloor(currentFloorId) ?? null),
      targetFloor: copy(resolveFloor(targetFloorId) ?? null), floors: copy(floors),
      remainingFloorIds: [...remaining], visitedFloorIds: [...visitedFloorIds], selectedRoomId,
      cancellationRequested, reason, revision, events: copy(events),
      liftState: lift.state, passenger: copy(lift.passenger ?? null),
      waitReason: lift.state === 'OBSTRUCTION_HOLD' && phase === 'riding'
        ? '原光幕仍被占用；不清除障碍、不绕过联锁' : reason,
      disclosure: copy(KCC_JOURNEY_DISCLOSURE)};
  }
  function emit() {
    const s = snapshot();
    if (matchesOwner(read()) && phase !== 'blocked') {
      const pose = liftRuntime.ridePose('kcc');
      if (pose) onPose({...copy(pose), journeyPhase: phase, designInspectionOnly: true,
        actualFloorRegistrationVerified: false, sourceHiddenForInteriorInspection: false});
    }
    onChange(s);
    return s;
  }
  function command(action) {
    const result = liftRuntime.commandFor('kcc', action);
    if (!result?.accepted) { rejectedAction = copy(action); block('lift_command_rejected', {action, detail: result?.reason ?? result?.message}); return false; }
    rejectedAction = null;
    record('command', {action: copy(action)});
    return true;
  }
  const boardable = (s, floorId) => s.current === floorId && s.state !== 'FAULT' &&
    s.guards?.leveled === true && s.guards?.stationary === true && s.v === 0 &&
    s.carDoor === 1 && s.landingDoors?.[floorId] === 1 && s.boardableFloors?.includes(floorId);

  function startLeg() {
    while (remaining.length) {
      targetFloorId = remaining.shift();
      if (targetFloorId === currentFloorId) {
        if (!visitedFloorIds.includes(currentFloorId)) visitedFloorIds.push(currentFloorId);
        record('already-at-design-landing', {floorId: currentFloorId});
        continue;
      }
      transition('waiting-for-lift', {fromFloorId: currentFloorId, targetFloorId});
      const direction = resolveFloor(targetFloorId).elevation > resolveFloor(currentFloorId).elevation ? 1 : -1;
      command({kind: 'hall', floor: currentFloorId, direction});
      return;
    }
    targetFloorId = null;
    transition(cancellationRequested ? 'cancelled' : 'arrived', {floorId: currentFloorId});
  }
  /** Progress is established by retained state and passenger position, never
   * elapsed time. Substeps only prevent missing a short, fully-open stop. */
  function process() {
    if (!active()) return;
    const s = read();
    if (!matchesOwner(s)) return block('building_or_lift_context_changed');
    if (s.state === 'FAULT') return block('lift_fault');
    if (phase === 'waiting-for-lift') {
      if (s.passenger?.mode !== 'outside' || s.passenger.floor !== currentFloorId)
        return block('passenger_context_changed');
      if (!boardable(s, currentFloorId)) return;
      const result = liftRuntime.beginBoard('kcc', currentFloorId);
      if (!result?.accepted) return block('boarding_rejected', {detail: result?.reason, certificate: result?.certificate});
      transition('boarding', {floorId: currentFloorId});
    } else if (phase === 'boarding') {
      if (s.passenger?.mode === 'boarding') return;
      if (s.passenger?.mode !== 'inside' || s.passenger.floor !== currentFloorId)
        return block('boarding_state_changed');
      transition('riding', {targetFloorId});
      command({kind: 'car', floor: targetFloorId});
    } else if (phase === 'riding') {
      if (s.passenger?.mode !== 'inside') return block('passenger_left_car_outside_journey');
      if (!boardable(s, targetFloorId)) return;
      const result = liftRuntime.beginExit('kcc');
      if (!result?.accepted) return block('exit_rejected', {detail: result?.reason, certificate: result?.certificate});
      transition('exiting', {floorId: targetFloorId});
    } else if (phase === 'exiting') {
      if (s.passenger?.mode === 'exiting') return;
      if (s.passenger?.mode !== 'outside' || s.passenger.floor !== targetFloorId)
        return block('exit_state_changed');
      currentFloorId = targetFloorId;
      visitedFloorIds.push(currentFloorId);
      record('arrived-at-design-corridor', {floorId: currentFloorId});
      startLeg();
    }
  }
  function startTour(requested = [1, 2, 3, 4, floors.length]) {
    if (active() || phase === 'blocked') return rejection('journey_busy_or_blocked');
    if (!Array.isArray(requested) || !requested.length || requested.length > 64) return rejection('bounded_floor_itinerary_required');
    const stops = requested.map(resolveFloor);
    if (stops.some(f => !f)) return rejection('unknown_or_unserved_design_floor');
    const s = read();
    if (!matchesOwner(s)) return rejection('building_or_lift_context_changed');
    if (s.state === 'FAULT') return rejection('lift_fault');
    if (s.passenger?.mode !== 'outside' || !resolveFloor(s.passenger.floor)) return rejection('passenger_must_start_at_existing_design_landing');
    currentFloorId = s.passenger.floor;
    remaining = stops.map(f => f.id); visitedFloorIds = []; selectedRoomId = null;
    cancellationRequested = false; paused = false; reason = null; blockedFrom = null; rejectedAction = null;
    try {startLeg(); process();} catch (error) {block('runtime_error', {message: error.message});}
    emit();
    return {accepted: phase !== 'blocked', ...snapshot()};
  }
  function tick(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 60) throw Error('Journey tick must be between 0 and 60 seconds');
    if (paused || !active()) return snapshot();
    try {
      process();
      for (let left = seconds; left > 1e-9 && active() && !paused;) {
        const dt = Math.min(.05, left);
        liftRuntime.advance(dt);
        process();
        left -= dt;
      }
    } catch (error) { block('runtime_error', {message: error.message}); }
    return emit();
  }
  function cancel() {
    cancellationRequested = true; remaining = [];
    if (active()) paused = false;
    const s = read(), safeOutside = matchesOwner(s) && s.passenger?.mode === 'outside' && s.passenger.floor === currentFloorId;
    if (((phase === 'waiting-for-lift' || phase === 'blocked') && safeOutside) || (!active() && phase !== 'blocked')) {
      targetFloorId = null; paused = false; rejectedAction = null; transition('cancelled', {floorId: currentFloorId});
    } else record('cancel-after-safe-exit', {targetFloorId});
    // Never teleport a boarded passenger or clear the retained light curtain.
    emit(); return {accepted: true, safeExitPending: s.passenger?.mode !== 'outside', ...snapshot()};
  }
  function resume() {
    const s = read();
    if (!matchesOwner(s)) return rejection('building_or_lift_context_changed');
    if (s.state === 'FAULT') return rejection('lift_fault');
    if (phase === 'blocked') {
      // Only an explicit resume retries the same phase after external repair.
      if (!ACTIVE.has(blockedFrom)) return rejection('no_resumable_phase');
      phase = blockedFrom; reason = null; blockedFrom = null;
    }
    paused = false; record('resumed');
    try {if (rejectedAction) command(rejectedAction); process();} catch (error) {block('runtime_error', {message: error.message});}
    emit(); return {accepted: phase !== 'blocked', ...snapshot()};
  }
  function selectRoom(roomKey) {
    if (active() || phase === 'blocked') return rejection('finish_floor_journey_first');
    const s = read();
    if (!matchesOwner(s) || s.passenger?.mode !== 'outside' || s.passenger.floor !== currentFloorId)
      return rejection('passenger_or_building_context_changed');
    const floor = building.localModel.completeFloorSystem?.levels?.find(f => f.id === currentFloorId);
    const room = floor?.rooms?.find(r => r.key === roomKey || r.id === roomKey);
    if (!room) return rejection('room_not_generated_or_registered', {floorId: currentFloorId,
      message: '本设计层没有已生成并绑定的房间；不以未配准平面或其他楼层替代。'});
    selectedRoomId = room.id ?? room.key; record('room-selected-not-traversed', {roomId: selectedRoomId}); emit();
    return {accepted: true, roomId: selectedRoomId, floorId: currentFloorId, reached: false,
      navigable: false, reason: 'room_route_not_connected_to_journey'};
  }
  return {snapshot, tick, startTour, goToFloor: floor => startTour([floor]), selectRoom,
    pause() {paused = true; record('paused'); emit(); return snapshot();}, resume, cancel,
    get status() {return snapshot();}};
}
