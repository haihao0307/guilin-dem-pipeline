// Bound cleanup of only the Chromium process owned by this QA case. A page
// timeout cannot by itself stop a GPU-blocked browser.close(). No unrelated
// process lookup, process-group kill, or machine-wide termination is used.
const {setTimeout:delay}=require('node:timers/promises');
async function closeOwnedBrowser(browser,owner,{closeMs=3000,killMs=3000}={}){
 if(![closeMs,killMs].every(x=>Number.isFinite(x)&&x>0))throw Error('Positive browser cleanup limits required');
 let closeError=null;
 const closing=Promise.resolve().then(()=>owner?.close?owner.close():browser?.close()).catch(e=>{closeError=String(e);});
 const graceful=await Promise.race([closing.then(()=>true),delay(closeMs,false)]);
 const child=owner?.process?.();let forced=false;
 if(child&&child.exitCode===null&&child.signalCode===null){
  forced=true;
  await Promise.race([Promise.resolve().then(()=>owner.kill()).catch(e=>{closeError=closeError||String(e);}),delay(killMs)]);
  if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');
 }
 return{graceful,forced,closeError,exitCode:child?.exitCode??null,signalCode:child?.signalCode??null};
}
module.exports={closeOwnedBrowser};
