const body=document.body;
const buttons=[...document.querySelectorAll('[data-mode]')];
const treeFrame=document.querySelector('#treeFrame');
const teacherFrame=document.querySelector('#teacherFrame');
const state=document.querySelector('#state');
let mode='compare';
let treeReady=false,teacherReady=false;

function setMode(value){
  mode=value;body.dataset.mode=value;
  for(const button of buttons)button.classList.toggle('on',button.dataset.mode===value);
  update();
}
for(const button of buttons)button.addEventListener('click',()=>setMode(button.dataset.mode));

function childReady(frame,marker){
  try{return Boolean(frame.contentWindow&&frame.contentWindow[marker]);}catch(_){return false;}
}
function update(){
  treeReady=childReady(treeFrame,'__teacherArchitectureR06Ready');
  teacherReady=childReady(teacherFrame,'__branchGrowthTeacherR01Ready');
  state.textContent=`R06 ${treeReady?'已就绪':'加载中'} · 分叉老师 ${teacherReady?'已就绪':'加载中'} · ${mode==='compare'?'并排验证':mode==='tree'?'树结构观察':mode==='teacher'?'老师观察':'知识映射'}`;
  const ready=treeReady&&teacherReady;
  window.__branchTeacherIntegratedR07Ready=ready;
  window.BranchTeacherIntegratedR07={
    setMode,
    setTeacherScore(value){try{teacherFrame.contentWindow.BranchGrowthTeacherR01.setScore(value);}catch(_){}},
    getState(){return {mode,treeReady,teacherReady,teacher:teacherReady?teacherFrame.contentWindow.BranchGrowthTeacherR01.getState():null,tree:treeReady?treeFrame.contentWindow.TeacherArchitectureR06.getState():null};}
  };
  document.documentElement.dataset.ready=ready?'true':'false';
}
treeFrame.addEventListener('load',update);
teacherFrame.addEventListener('load',update);
setMode('compare');
setInterval(update,700);
