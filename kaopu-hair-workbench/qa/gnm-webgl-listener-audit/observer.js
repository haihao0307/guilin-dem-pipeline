// QA-only observer appended after the unchanged, pinned Three module.
// It does not wrap event callbacks or alter event dispatch/removal.
const hairNativeAddListener = EventDispatcher.prototype.addEventListener;
const hairObservedDisposableObjects = new Set();
EventDispatcher.prototype.addEventListener = function (...args) {
  const result = hairNativeAddListener.apply(this, args);
  if (args[0] === 'dispose' && (this.isBufferGeometry || this.isMaterial)) hairObservedDisposableObjects.add(this);
  return result;
};
globalThis.__hairDisposeObservation = () => [...hairObservedDisposableObjects].map(object => ({
  key: (object.isBufferGeometry ? 'geometry:' : 'material:') + object.id,
  type: object.type,
  vertices: object.attributes?.position?.count ?? null,
  callbacks: object._listeners?.dispose?.length ?? 0,
  callbackNames: (object._listeners?.dispose ?? []).map(callback => callback.name || '(anonymous)'),
}));
