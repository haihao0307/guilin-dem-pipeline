'use strict';
// Preserve an exact copy of legacy user data. This script never rewrites the old key.
(()=>{
  const oldKey='KAOPU_MATERIAL_R16', prefix='KAOPU_MATERIAL_RECOVERY_R16_RAW:';
  const status={found:false,backedUp:false,needsReview:false,backupKey:null};
  try {
    const raw=localStorage.getItem(oldKey);
    if(raw!==null){
      status.found=true;
      try { status.needsReview=JSON.parse(raw)?.version!==16; } catch { status.needsReview=true; }
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i);
        if(key?.startsWith(prefix)&&localStorage.getItem(key)===raw){status.backupKey=key;break;}
      }
      if(!status.backupKey){
        let key=prefix+Date.now(),suffix=0;
        while(localStorage.getItem(key)!==null) key=prefix+Date.now()+':'+(++suffix);
        localStorage.setItem(key,raw);
        if(localStorage.getItem(key)!==raw) throw Error('Legacy backup verification failed');
        status.backupKey=key;
      }
      status.backedUp=true;
    }
  } catch { status.backedUp=false; }
  window.KAOPU_ANCHOR_PROTECTION=Object.freeze(status);
  if(status.found&&status.needsReview){
    const note=document.createElement('p');
    note.id='legacyParameterNotice';
    note.setAttribute('role','status');
    note.style.cssText='margin:8px 14px;padding:8px 10px;border:1px solid #766340;border-radius:6px;color:#d5bd8a;font:12px/1.5 system-ui';
    note.textContent=status.backedUp
      ?'检测到旧版本参数记录，已原样保留副本。若此前的个人参数已经被覆盖，无法自动还原覆盖前的值；新样板独立保存，不会回写旧四例的参数。'
      :'旧版本参数记录仍保留，但本机备份未完成。若此前的个人参数已经被覆盖，无法自动还原覆盖前的值。';
    document.body.prepend(note);
  }
})();
