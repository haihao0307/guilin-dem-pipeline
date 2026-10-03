/* Lazy model startup. The pinned teacher bundle and original host remain archived. */
(function(){'use strict';
let pending=null,teacherPending=null,started=false,status="idle";window.rabbitTeacherStarted=false;
workbench.ensureStarted=function(){
  if(pending)return pending;
  pending=(async()=>{
    status='loading';if(!workbench.errors.length&&$('errorBanner').textContent.startsWith('兔子装载失败：')){$('errorBanner').hidden=true;$('errorBanner').textContent='';}$('globalStatus').textContent='正在载入兔子…';window.catalogUI?.sync();performance.mark('rabbit-requested');
    await window.ensureRabbitBundle();
    performance.mark('rabbit-assets-ready');
    if(platform.module!=='rabbit'&&!started)throw new DOMException('Rabbit selection was cancelled','AbortError');
    if(!started){started=true;createFrame('candidate');}
    await waitForMesh(candidate.mesh);
    status='ready';window.catalogUI?.sync();performance.mark('rabbit-ready');
    return workbench;
  })();
  pending.catch(error=>{if(!started)pending=null;if(error.name==='AbortError'){status='idle';window.catalogUI?.sync();return;}status='error';window.catalogUI?.sync();$('errorBanner').hidden=false;$('errorBanner').textContent='兔子装载失败：'+error.message;$('globalStatus').textContent=started?'兔子启动失败，请刷新页面重试':'资源装载失败，可重新点击兔子重试';});
  return pending;
};
workbench.ensureTeacher=function(options={}){if(teacherPending)return teacherPending;teacherPending=(async()=>{await workbench.ensureStarted();if(options.interactive&&(!document.getElementById('rabbitTeacherDrawer').open||platform.module!=='rabbit'))throw new DOMException('Teacher selection was cancelled','AbortError');if(!window.rabbitTeacherStarted){window.rabbitTeacherStarted=true;createFrame('teacher');}await waitForMesh(candidate.mesh);return workbench;})();teacherPending.catch(()=>{teacherPending=null;});return teacherPending;};
Object.defineProperty(workbench,'teacherStarted',{get:()=>window.rabbitTeacherStarted});
Object.defineProperty(workbench,'started',{get:()=>started});Object.defineProperty(workbench,'startupStatus',{get:()=>status});
})();
