const body=document.body;
const buttons=[...document.querySelectorAll('[data-mode]')];
const treeFrame=document.querySelector('#treeFrame');
const teacherFrame=document.querySelector('#teacherFrame');
const state=document.querySelector('#state');
let mode='compare';
let treeReady=false,teacherReady=false;
function setMode(value){mode=value;body.dataset.mode=value;for(const button of buttons)button.classList.toggle('on',button.dataset.mode===value);update();}
for(const button of buttons)button.addEventListener('click',()=>setMode(button.dataset.mode));
function childReady(frame,marker){try{return Boolean(frame.contentWindow&&frame.contentWindow[marker]);}catch(_){return false;}}
function update(){
  treeReady=childReady(treeFrame,'__teacherArchitectureR06Ready');
  teacherReady=childReady(teacherFrame,'__branchGrowthTeacherR02Ready');
  const teacherState=teacherReady?teacherFrame.contentWindow.BranchGrowthTeacherR02.getState():null;
  state.textContent=`R06 ${treeReady?'已就绪':'加载中'} · R02 ${teacherReady?'已就绪':'加载中'}${teacherState?` · ${teacherState.params.stage} · Backward ${teacherState.signature.backwardSegments}`:''}`;
  const ready=treeReady&&teacherReady;
  window.__branchTeacherIntegratedR08Ready=ready;
  window.BranchTeacherIntegratedR08={setMode,setTeacherStage(value){try{teacherFrame.contentWindow.BranchGrowthTeacherR02.setStage(value);}catch(_){}},setTeacherScore(value){try{teacherFrame.contentWindow.BranchGrowthTeacherR02.setScore(value);}catch(_){}},getState(){return{mode,treeReady,teacherReady,teacher:teacherReady?teacherFrame.contentWindow.BranchGrowthTeacherR02.getState():null,tree:treeReady?treeFrame.contentWindow.TeacherArchitectureR06.getState():null};}};
  document.documentElement.dataset.ready=ready?'true':'false';
}
treeFrame.addEventListener('load',update);teacherFrame.addEventListener('load',update);setMode('compare');setInterval(update,700);
