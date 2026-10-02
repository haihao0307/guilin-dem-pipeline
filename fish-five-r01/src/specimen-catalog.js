// Six measured specimens; thumbnail images use the existing standalone render, never new WebGL contexts.
export function mountSpecimenCatalog({items,labels,onSelect}) {
 const host=document.getElementById('fishList');
 if(!host)throw new Error('Specimen catalog host is missing');
 if(typeof onSelect!=='function')throw new Error('Specimen catalog requires a selection callback');
 const carrier=document.getElementById('specimenThumbnails');
 const thumbnails=carrier?JSON.parse(carrier.textContent):{items:[]};
 const images=new Map((thumbnails.items||[]).map(item=>[item.id,item]));
 const descriptions={barracuda:'海狼鱼 · 既有制作基线',herring:'鲱鱼 · 连续脊椎与群游','tuna-yellow-label':'金枪鱼素材 · 黄鳍标签','tuna-blue-label':'金枪鱼素材 · 蓝鳍标签',colorful:'彩色珊瑚鱼 · 深体形',picasso:'毕加索素材标签 · 独立鳍'};
 const buttons=new Map();
 host.replaceChildren();
 for(const item of items){
  const label=labels[item.id]?.[0]||labels[item.id]||item.label||item.id;
  const shot=images.get(item.id);
  if(!shot?.uri?.startsWith('data:image/'))throw new Error('Actual specimen thumbnail is missing: '+item.id);
  const button=document.createElement('button');
  button.type='button';button.className='fish-choice';button.dataset.fish=item.id;
  button.setAttribute('aria-label','显示'+label+'的三维模型');button.setAttribute('aria-pressed','false');
  const image=document.createElement('img');image.className='specimen-preview';image.src=shot.uri;image.alt='';
  image.width=shot.width||512;image.height=shot.height||256;image.decoding='async';image.draggable=false;
  const name=document.createElement('span');name.className='name';name.textContent=label;
  const description=document.createElement('small');description.textContent=descriptions[item.id]||item.subtitle||'原表面重构';
  button.append(image,name,description);
  button.addEventListener('click',()=>{
   try{const result=onSelect(item.id);if(result?.catch)result.catch(error=>console.error('Specimen selection failed',error));}
   catch(error){console.error('Specimen selection failed',error);}
  });
  buttons.set(item.id,button);host.appendChild(button);
 }
 function setActive(id){for(const [key,button] of buttons){const active=key===id;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}}
 // Existing selectors may update classes; reflect only committed class changes in accessible state.
 const observer=new MutationObserver(changes=>{for(const change of changes){const b=change.target;b.setAttribute('aria-pressed',String(b.classList.contains('active')));}});
 for(const button of buttons.values())observer.observe(button,{attributes:true,attributeFilter:['class']});
 return {setActive,destroy(){observer.disconnect();host.replaceChildren();},count:buttons.size};
}
