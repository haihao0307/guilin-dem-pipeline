export async function resolveSide() {
  const hidden = await import('./hidden-runtime-wrapper.mjs');
  return hidden.side();
}
