// Public preview controls only. The source field and six material mothers stay unchanged.
export function previewResolution(params) {
  const finite = (name, fallback, min, max) => {
    const input = Number(params.get(name));
    return Number.isFinite(input) && input > 0 ? Math.round(Math.min(max, Math.max(min, input))) : fallback;
  };
  const width = finite('width', 960, 240, 960);
  const height = finite('height', Math.round(width * 2 / 3), 160, 640);
  return { width, height };
}
export function initialView(params, views) {
  const name = params.get('view');
  return Object.hasOwn(views, name) ? name : 'street';
}
