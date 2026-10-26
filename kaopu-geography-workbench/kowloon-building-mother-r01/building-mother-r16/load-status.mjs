// Display-only lifecycle. A stopped/failed attempt never restarts itself.
export const loading={stopped:false,hasPresented:false,phase:'modules',onStop:null};
const el=id=>document.getElementById(id);
export function phase(text){if(loading.stopped)return;loading.phase=text;el('loading').hidden=loading.hasPresented;el('loading').textContent=text;el('status').textContent=text;el('loadMessage').textContent=text;}
export async function paintPhase(text){phase(text);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));if(loading.stopped)throw new Error('Loading stopped');}
export function stopLoading(){if(loading.stopped)return;loading.stopped=true;loading.phase='stopped';loading.onStop?.();el('loading').hidden=loading.hasPresented;el('loading').textContent='已停止本次加载或绘制。页面不会自动重开；需要时手动刷新。';el('status').textContent='已停止';el('loadMessage').textContent='已停止加载 / 绘制；保留已完成画面，不自动重开。';el('stopLoading').disabled=true;}
export function failLoading(error){if(loading.stopped)return;loading.stopped=true;loading.phase='error';loading.onStop?.();const message='未完成：'+(error?.message??String(error))+'。页面不会反复刷新。';el('loading').hidden=loading.hasPresented;el('loading').textContent=message;el('loading').setAttribute('role','alert');el('status').textContent=message;el('loadMessage').textContent=message;el('loadMessage').setAttribute('role','alert');el('stopLoading').disabled=true;}
export function bindStop(){el('stopLoading').onclick=stopLoading;}
export function markPresented(){if(loading.stopped)return;loading.hasPresented=true;el('loading').hidden=true;el('loadMessage').textContent='已显示完整首帧';}
