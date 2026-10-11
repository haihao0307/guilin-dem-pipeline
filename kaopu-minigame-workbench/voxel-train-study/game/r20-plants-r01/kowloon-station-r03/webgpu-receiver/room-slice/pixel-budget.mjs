// Host sampling budget only. No world-domain, age, material or tracing parameter changes.
export const MAX_INTERNAL_PIXELS = 480 * 320;
export function internalSize(viewWidth, viewHeight, requestedScale = .67) {
  if (![viewWidth, viewHeight, requestedScale].every(Number.isFinite) || viewWidth <= 0 || viewHeight <= 0 || requestedScale <= 0) throw Error('Invalid viewport or render scale');
  const scale = Math.min(1, requestedScale);
  let width = Math.max(160, Math.floor(viewWidth * scale));
  let height = Math.max(120, Math.floor(viewHeight * scale));
  const limit = Math.min(1, Math.sqrt(MAX_INTERNAL_PIXELS / (width * height)));
  width = Math.max(1, Math.floor(width * limit));
  height = Math.max(1, Math.floor(height * limit));
  return {width, height, pixels: width * height, limit: MAX_INTERNAL_PIXELS};
}
