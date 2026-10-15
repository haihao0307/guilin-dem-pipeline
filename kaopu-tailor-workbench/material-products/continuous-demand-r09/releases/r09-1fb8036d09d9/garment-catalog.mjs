export function resolveBoardLook(id,overrides,legacy,current,catalog){
 const old=legacy.find(row=>row.id===id);
 let top=overrides.topPattern||old?.top,bottom=overrides.bottomPattern||old?.bottom;
 if(id.startsWith('B-')){const parts=id.split('-');top=overrides.topPattern||parts[1];bottom=overrides.bottomPattern||parts[2];}
 const a=catalog?.find(row=>row.id===top&&row.role==='top'),b=catalog?.find(row=>row.id===bottom&&row.role==='bottom');if(!a||!b)return null;
 const same=current?.top===top&&current?.bottom===bottom;
 return{...(old||{}),id:old&&!overrides.topPattern&&!overrides.bottomPattern?id:'B-'+top+'-'+bottom,name:a.label+' · '+b.label,top,bottom,topMaterial:overrides.topMaterial||(same?current.topMaterial:old?.topMaterial)||'denim-raw',bottomMaterial:overrides.bottomMaterial||(same?current.bottomMaterial:old?.bottomMaterial)||'denim-raw'};
}
