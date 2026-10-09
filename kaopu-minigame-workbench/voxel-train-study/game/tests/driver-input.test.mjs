import test from 'node:test';
import assert from 'node:assert/strict';
import {bindDriverButton,updateButtonState} from '../driver-input.mjs';
import {Session} from '../session.mjs';

class Button extends EventTarget{
  constructor(doc){super();this.ownerDocument=doc;this.disabled=false;this.textContent='开门接送';this.attributes=new Map();this.capture=null;}
  getBoundingClientRect(){return{left:100,top:200,right:230,bottom:310};}
  setAttribute(name,value){this.attributes.set(name,value);}
  removeAttribute(name){this.attributes.delete(name);}
  focus(){}
  setPointerCapture(id){this.capture=id;}
  hasPointerCapture(id){return this.capture===id;}
  releasePointerCapture(){this.capture=null;}
}
function fixture(options){
  const doc=new EventTarget();doc.defaultView=new EventTarget();doc.hidden=false;
  const button=new Button(doc),calls=[];
  const control=bindDriverButton(button,options||{activate:()=>calls.push('action')});
  const fire=(target,type,values={})=>{
    const event=new Event(type,{cancelable:true});
    Object.assign(event,{pointerId:1,button:0,buttons:1,clientX:160,clientY:250,detail:1,...values});
    target.dispatchEvent(event);return event;
  };
  const down=values=>fire(button,'pointerdown',values),up=values=>fire(doc,'pointerup',{buttons:0,...values});
  return{doc,button,control,calls,fire,down,up};
}

test('mouse release activates once even when the browser also sends click',()=>{
  const f=fixture();f.down();assert.equal(f.calls.length,0);f.up();f.fire(f.button,'click');
  assert.deepEqual(f.calls,['action']);assert.equal(f.button.capture,null);
});
test('rapid complete clicks each activate once without a deduplication timeout',()=>{
  const f=fixture();for(let i=0;i<20;i++){f.down();f.up();f.fire(f.button,'click');}
  assert.equal(f.calls.length,20);
});
test('touch tap and boundary points use the complete button target once',()=>{
  for(const point of [{clientX:100,clientY:200},{clientX:229.9,clientY:309.9},{clientX:160,clientY:250}]){
    const f=fixture();f.down({...point,pointerType:'touch'});f.up({...point,pointerType:'touch'});f.fire(f.button,'click');
    assert.equal(f.calls.length,1);
  }
});
test('label replacement during a long press cannot lose its button-owned release',()=>{
  const f=fixture();f.down();for(let i=0;i<5;i++)f.button.textContent='开门接送';f.up();
  assert.deepEqual(f.calls,['action']);
});
test('dragging outside cancels; dragging back cannot silently re-arm',()=>{
  const f=fixture();f.down();f.fire(f.doc,'pointermove',{clientX:80});f.fire(f.doc,'pointermove');f.up();f.fire(f.button,'click');
  assert.equal(f.calls.length,0);f.down();f.up();assert.equal(f.calls.length,1);
});
test('release outside cancels even if no intermediate move was delivered',()=>{
  const f=fixture();f.down();f.up({clientY:350});f.fire(f.button,'click');assert.equal(f.calls.length,0);
});
test('capture exceptions fall back to document release without losing action',()=>{
  const f=fixture();f.button.setPointerCapture=()=>{throw new Error('capture unsupported');};f.down();f.up();assert.equal(f.calls.length,1);
});
test('right click, disabled buttons and changed availability cannot issue commands',()=>{
  const f=fixture();f.down({button:2});f.up({button:2});assert.equal(f.calls.length,0);
  f.button.disabled=true;f.down();f.up();f.fire(f.button,'click',{detail:0});assert.equal(f.calls.length,0);
  f.button.disabled=false;f.down();f.button.disabled=true;f.up();assert.equal(f.calls.length,0);
});
test('releasing the primary button while another mouse button remains cancels the gesture',()=>{
  const f=fixture();f.down();f.fire(f.doc,'pointermove',{buttons:2});f.up({button:2});assert.equal(f.calls.length,0);
});
test('native keyboard/assistive activation and programmatic clicks remain available',()=>{
  const f=fixture();f.down();f.up(); // Its native pointer click need not arrive.
  f.fire(f.button,'click',{detail:0});f.fire(f.button,'click',{detail:0});assert.equal(f.calls.length,3);
});
test('window blur, hidden page and explicit reset cancel pending activation',()=>{
  for(const reason of ['blur','hidden','reset']){
    const f=fixture();f.down();
    if(reason==='blur')f.fire(f.doc.defaultView,'blur');
    if(reason==='hidden'){f.doc.hidden=true;f.fire(f.doc,'visibilitychange');}
    if(reason==='reset')f.control.release();
    f.up();f.fire(f.button,'click');assert.equal(f.calls.length,0,reason);
  }
});
test('brake releases on drag-out, cancellation, capture loss, blur and missing mouse buttons',()=>{
  for(const reason of ['drag','cancel','capture','blur','buttons']){
    const held=new Set(),f=fixture({hold:(pressed,source)=>pressed?held.add(source):held.delete(source)});
    f.down();assert.equal(held.size,1);
    if(reason==='drag')f.fire(f.doc,'pointermove',{clientX:80});
    if(reason==='cancel')f.fire(f.doc,'pointercancel');
    if(reason==='capture')f.fire(f.button,'lostpointercapture');
    if(reason==='blur')f.fire(f.doc.defaultView,'blur');
    if(reason==='buttons')f.fire(f.doc,'pointermove',{buttons:0});
    assert.equal(held.size,0,reason);f.up();assert.equal(held.size,0);
  }
});
test('mouse and keyboard brake sources cannot release one another',()=>{
  const held=new Set(),f=fixture({hold:(pressed,source)=>pressed?held.add(source):held.delete(source)});
  f.down();f.fire(f.button,'keydown',{code:'Space',repeat:false});f.fire(f.button,'keydown',{code:'Space',repeat:true});
  assert.equal(held.size,2);f.up();assert.equal(held.size,1);f.fire(f.doc,'keyup',{code:'Space'});assert.equal(held.size,0);
  f.fire(f.button,'keydown',{code:'Enter',repeat:false});assert.equal(held.size,1);f.fire(f.button,'blur');assert.equal(held.size,0);
});
test('unrelated pointer release does not interrupt the finger holding the brake',()=>{
  const held=new Set(),f=fixture({hold:(pressed,source)=>pressed?held.add(source):held.delete(source)});
  f.down({pointerId:8});f.up({pointerId:9});assert.equal(held.size,1);f.up({pointerId:8});assert.equal(held.size,0);
});
test('unchanged HUD state does not replace the label or rewrite disabled',()=>{
  let label='开门接送',disabled=false,writes=0;
  const button={get textContent(){return label;},set textContent(value){label=value;writes++;},get disabled(){return disabled;},set disabled(value){disabled=value;writes++;}};
  for(let i=0;i<30;i++)updateButtonState(button,{text:'开门接送',disabled:false});assert.equal(writes,0);
  updateButtonState(button,{text:'正在打开车门…',disabled:true});assert.equal(writes,2);
});
test('the photographed Shatin stop opens by actual input without weakening stop rules',()=>{
  const game=new Session({line:'kcr1',seed:'R12-INPUT'});game.command('start');game.activateStation(2);game.distance=game.station.target-.2;game.stepTicks(30);
  assert.equal(game.view().speedKmh,0);assert.equal(game.view().station.canOpen,true);
  const f=fixture({activate:()=>game.command('station-action')});f.down();game.stepTicks(5);f.up();f.fire(f.button,'click');
  assert.equal(game.phase,'doors-opening');assert.equal(game.inputLog.filter(i=>i.type==='station-action').length,1);
  assert.equal(game.command('throttle-up').accepted,false);
  const moving=new Session({line:'kcr1',seed:'R12-MOVING'});moving.command('start');moving.distance=moving.station.target-.2;moving.velocity=1;moving.stopStable=1;
  assert.equal(moving.command('station-action').accepted,false);
  moving.velocity=0;moving.stopStable=.3;assert.equal(moving.command('station-action').accepted,false);
  moving.stopStable=1;moving.distance=moving.station.target-20;assert.equal(moving.command('station-action').accepted,false);
});
