const physical=document.getElementById('physical');
const reset=document.getElementById('reset');
let autoHidden=false;

function hideWholeGunScaleForLocalFocus(){
  if(physical?.getAttribute('aria-pressed')==='true'){
    autoHidden=true;
    physical.click();
  }
}
function restoreWholeGunScale(){
  if(autoHidden&&physical?.getAttribute('aria-pressed')==='false'){
    physical.click();
  }
  autoHidden=false;
}

document.querySelectorAll('[data-focus]').forEach(button=>{
  button.addEventListener('click',()=>{
    if(button.dataset.focus==='all')restoreWholeGunScale();
    else hideWholeGunScaleForLocalFocus();
  });
});
reset?.addEventListener('click',restoreWholeGunScale);
