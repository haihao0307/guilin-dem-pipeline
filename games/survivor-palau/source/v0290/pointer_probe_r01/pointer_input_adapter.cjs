'use strict';

const { createInteractionProbe } = require('./interaction_probe.cjs');

function installPointerInputAdapter({ target, projectToWorld, readWorldTime, emit, probeOptions = {} }) {
  if (!target || typeof target.addEventListener !== 'function' || typeof target.removeEventListener !== 'function') {
    throw new TypeError('target must support addEventListener/removeEventListener');
  }
  if (typeof projectToWorld !== 'function') throw new TypeError('projectToWorld must be a function');
  if (typeof readWorldTime !== 'function') throw new TypeError('readWorldTime must be a function');
  if (typeof emit !== 'function') throw new TypeError('emit must be a function');

  const probe = createInteractionProbe(probeOptions);

  function sampleEvent(event) {
    const projected = projectToWorld(event.clientX, event.clientY, event);
    if (!projected) return;
    emit(probe.sample({
      worldPosition: projected,
      eventTimeMs: Number.isFinite(event.timeStamp) ? event.timeStamp : 0,
      worldTime: readWorldTime(),
      pointerId: Number.isFinite(event.pointerId) ? event.pointerId : 0,
      pressure: Number.isFinite(event.pressure) ? event.pressure : 0.5,
      confidence: 1,
    }));
  }

  function cancelEvent(event) {
    emit(probe.cancel({
      worldTime: readWorldTime(),
      pointerId: Number.isFinite(event.pointerId) ? event.pointerId : undefined,
    }));
  }

  target.addEventListener('pointerdown', sampleEvent);
  target.addEventListener('pointermove', sampleEvent);
  target.addEventListener('pointerup', cancelEvent);
  target.addEventListener('pointercancel', cancelEvent);
  target.addEventListener('pointerleave', cancelEvent);

  return Object.freeze({
    probe,
    tick({ dt, nowMs }) {
      const state = probe.advance({ dt, nowMs, worldTime: readWorldTime() });
      emit(state);
      return state;
    },
    dispose() {
      target.removeEventListener('pointerdown', sampleEvent);
      target.removeEventListener('pointermove', sampleEvent);
      target.removeEventListener('pointerup', cancelEvent);
      target.removeEventListener('pointercancel', cancelEvent);
      target.removeEventListener('pointerleave', cancelEvent);
    },
  });
}

module.exports = { installPointerInputAdapter };
