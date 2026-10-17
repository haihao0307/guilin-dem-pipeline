// Button-owned pointer gestures survive label refreshes and keep click/keyboard
// activation separate. Session remains the authority for every driving command.
export function updateButtonState(button,{text,disabled}={}){
  // R12 regression: WebKit lost the native click when the door-label press
  // crossed repeated HUD textContent replacements (down/up still reached the
  // enabled button). Chromium did not reproduce that Windows-reported failure.
  // Preserve its text node until the displayed state actually changes.
  if(text!==undefined&&button.textContent!==text)button.textContent=text;
  if(disabled!==undefined&&button.disabled!==disabled)button.disabled=disabled;
}

export function bindDriverButton(button,{activate,hold,enabled=()=>true}={}){
  const doc=button.ownerDocument,win=doc.defaultView;
  let pointer=null,pointerType='',consumedPointer=null,ignorePointerClick=false;
  const keys=new Set(),listeners=[];
  const listen=(target,type,callback,options)=>{
    target.addEventListener(type,callback,options);
    listeners.push(()=>target.removeEventListener(type,callback,options));
  };
  const available=()=>!button.disabled&&enabled();
  const inside=event=>{
    const r=button.getBoundingClientRect();
    return event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom;
  };
  const dropPointer=()=>{
    if(pointer===null)return;
    const id=pointer;consumedPointer={id,type:pointerType};pointer=null;pointerType='';ignorePointerClick=true;
    button.removeAttribute('data-pressed');
    if(hold)hold(false,'pointer:'+id);
    // A capture failure must never prevent braking; document listeners also
    // release outside the button. Older browser/device combinations may throw.
    try{if(button.hasPointerCapture?.(id))button.releasePointerCapture(id);}catch{}
  };
  const release=()=>{
    dropPointer();
    for(const code of keys)hold?.(false,'key:'+code);
    keys.clear();button.removeAttribute('data-pressed');
  };
  listen(button,'pointerdown',event=>{
    if(event.button!==0||pointer!==null||!available())return;
    event.preventDefault();
    ignorePointerClick=false;consumedPointer=null;pointer=event.pointerId;pointerType=event.pointerType||'';
    button.setAttribute('data-pressed','true');
    button.focus?.({preventScroll:true});
    try{button.setPointerCapture(event.pointerId);}catch{}
    hold?.(true,'pointer:'+event.pointerId);
  });
  const move=event=>{
    if(event.pointerId!==pointer)return;
    // Capture retains delivery, not permission to keep holding after dragging
    // away. Re-entry requires a fresh press, just like cancelled activation.
    if(!inside(event)||(event.buttons&1)===0)dropPointer();
  };
  const up=event=>{
    if(event.pointerId!==pointer)return;
    const fire=event.button===0&&!hold&&available()&&inside(event);
    dropPointer();
    if(fire)activate?.(event);
  };
  const cancel=event=>{if(event.pointerId===pointer)dropPointer();};
  listen(doc,'pointermove',move,true);
  listen(doc,'pointerup',up,true);
  listen(doc,'pointercancel',cancel,true);
  listen(button,'lostpointercapture',cancel);
  listen(button,'pointerleave',cancel);
  listen(button,'click',event=>{
    // Chromium touch emits click(detail=0, pointerType=touch) after pointerup;
    // treating every zero-detail click as keyboard toggled Pause twice. Match
    // the consumed physical gesture too. Enter/assistive/.click() have no type
    // and keep their normal activation, even while a pointer click is pending.
    const samePointer=!!event.pointerType&&consumedPointer&&event.pointerId===consumedPointer.id&&event.pointerType===consumedPointer.type;
    if(ignorePointerClick&&(event.detail>0||samePointer)){event.preventDefault();ignorePointerClick=false;consumedPointer=null;return;}
    if(!hold&&available())activate?.(event);
  });
  if(hold){
    listen(button,'keydown',event=>{
      if(!['Space','Enter'].includes(event.code)||!available())return;
      event.preventDefault();event.stopPropagation();
      if(event.repeat||keys.has(event.code))return;
      keys.add(event.code);button.setAttribute('data-pressed','true');
      hold(true,'key:'+event.code);
    });
    listen(doc,'keyup',event=>{
      if(!keys.delete(event.code))return;
      event.preventDefault();hold(false,'key:'+event.code);
      if(pointer===null&&!keys.size)button.removeAttribute('data-pressed');
    },true);
    listen(button,'blur',release);
  }
  listen(win,'blur',release);
  listen(doc,'visibilitychange',()=>{if(doc.hidden)release();});
  return{release,destroy(){release();for(const unlisten of listeners)unlisten();}};
}
