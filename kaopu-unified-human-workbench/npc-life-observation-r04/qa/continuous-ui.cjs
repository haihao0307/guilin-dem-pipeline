'use strict';
const assert=require('node:assert/strict');
const {assertContinuousRun}=require('./audit-r03-continuous-contract.cjs');
/** This driver only clicks actual UI controls. Evaluation reads state and waits
 * for an actual native frame; it never ticks physics, sets poses, or pauses. */
async function runContinuousUI({page,clickCommand,evaluate,waitFor,bounded,put,stage,maxWallMS=600000,frameMS=60000,onCompleted=async()=>({})}){
  const started=Date.now(),deadline=started+maxWallMS;
  const report={schema:'kaopu/r03-continuous-ui@1',actualUI:true,usedPause:false,usedExternalTick:false,
    startedAt:new Date(started).toISOString(),maxWallMS,operations:[],completed:false};
  const save=()=>put('continuous-ui.json',report);
  const budget=(cap=maxWallMS)=>{const remaining=deadline-Date.now();assert(remaining>0,'Continuous real-UI group exceeded its 10-minute wall deadline');return Math.min(cap,remaining);};
  async function readCompleted(label){
    return evaluate('completed native frame: '+label,async()=>{
      const app=window.__NPC_OBSERVATION__;
      if(!app?.ready||app.errors.length)throw Error('Observation app is not healthy: '+JSON.stringify(app?.errors));
      await app.awaitFrame({fresh:true});
      // Keep these synchronous reads in this Promise continuation. The product
      // reader barrier prevents changing the world before this exact read.
      return {observation:app.observation(),renderStatus:app.renderStatus(),snapshot:app.snapshot(),capturedAtMS:performance.now()};
    },undefined,budget(frameMS));
  }
  try{
    stage('continuous real-UI actions without intermediate pause');save();
    await bounded('select A through actual UI',()=>clickCommand('[data-person="0"]'),budget(frameMS));
    await bounded('select actual contact camera',()=>page.click('[data-camera="contact"]'),budget(30000));
    for(const action of [{kind:'bottle',label:'A-continuous-pick-place',buttonId:'npc-pick'},
      {kind:'window',operation:'open',label:'A-continuous-window-open',buttonId:'npc-window-open'},
      {kind:'window',operation:'close',label:'A-continuous-window-close',buttonId:'npc-window-close'}]){
      stage(action.label);
      const before=await readCompleted(action.label+' before');
      const actionStartedAtMS=await evaluate('record UI action start '+action.label,()=>performance.now(),undefined,budget(30000));
      await bounded('click #'+action.buttonId,()=>clickCommand('#'+action.buttonId),budget(frameMS));
      await waitFor('wait for actual completed image of '+action.label,({kind,operation})=>{
        const app=window.__NPC_OBSERVATION__;
        if(!app?.ready||app.errors.length||document.documentElement.dataset.npcReady==='failed')return true;
        const s=app.state(),m=app.observation().lastCompleted?.metadata;
        const a=(kind==='bottle'?s.agents:s.window.agents).find(item=>item.id==='A');
        if(a?.phase==='failed'||a?.phase==='cancelled')return true;
        const drawn=(kind==='bottle'?m?.agents:m?.windowAgents)?.find(item=>item.id==='A');
        if(a?.phase!=='done'||a.recovery!==null||a.result?.result!=='completed'||drawn?.phase!=='done'||drawn.recovery!==null||m?.paused!==false||m?.mode!=='observation')return false;
        if(kind==='bottle')return s.object.heldBy===null&&s.object.constraintCount===0;
        return a.result.operation===operation&&drawn.taskToken===a.result.taskToken&&s.window.object.heldBy===null&&s.window.object.gripConstraintCount===0;
      },action,{timeout:budget(),polling:100});
      const after=await readCompleted(action.label+' after');
      const entry={...action,actorId:'A',before,after,ui:{buttonId:action.buttonId,actionStartedAtMS,
        actionFinishedAtMS:after.capturedAtMS,usedPause:false,usedExternalTick:false}};
      report.operations.push(entry);save();
      entry.contract=assertContinuousRun(entry);save();
      entry.nativeGeometry=await bounded('completed native evidence: '+action.label,()=>onCompleted(entry),budget());
      entry.accepted=true;save();
      if(action.operation==='close'){
        const opened=report.operations.find(op=>op.operation==='open');
        assert.equal(entry.contract.sceneEpoch,opened.contract.sceneEpoch,'Closing uses the same physical window; no station reset');
        assert.notEqual(entry.contract.taskToken,opened.contract.taskToken,'Close has its own actual task token');
        assert.equal(before.snapshot.window.agents.find(a=>a.id==='A').result.taskToken,opened.contract.taskToken,'Opening result remains authoritative immediately before Close');
        assert.equal(before.snapshot.window.object.goalOpen,true,'Close starts from the actual released open window');
      }
    }
    assert.equal(report.operations.length,3);assert(report.operations.every(op=>op.accepted===true));
    report.elapsedMS=Date.now()-started;
    assert(report.elapsedMS<=maxWallMS,'Continuous real-UI group exceeded its 10-minute wall deadline');
    report.completed=true;return report;
  }catch(error){report.failure={message:error.message,stack:String(error.stack)};throw error;}
  finally{if(!report.completed)report.elapsedMS=Date.now()-started;save();}
}
module.exports={runContinuousUI};
