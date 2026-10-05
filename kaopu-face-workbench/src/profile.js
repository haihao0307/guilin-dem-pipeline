export const MODEL_VERSION='GNM Head v3 / official web int8';
export const MODEL_HASH='fd19f46eef6f8bfb725fceab581e1bc8837209997ca3fd43f3c1735003c86961';
export function validateProfile(p){
 if(p?.schema!=='kaopu-face-profile/1'||p.modelHash!==MODEL_HASH||p.modelVersion!==MODEL_VERSION)throw Error('档案格式或 GNM 模型版本不匹配');
 for(const [k,n]of [['identity',253],['expression',383]])if(!Array.isArray(p[k])||p[k].length!==n||p[k].some(v=>typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>3))throw Error(k+' 参数不合法（需正确维数，范围 ±3）');
 if(typeof p.person!=='string'||p.person.length>80)throw Error('人物档案名不合法');
 if(!Array.isArray(p.observations)||p.observations.length>100||p.observations.some(v=>typeof v.note!=='string'||v.note.length>4000||typeof v.name!=='string'||v.name.length>256||!['photo','frame','video'].includes(v.type)||v.timeSeconds!=null&&(!Number.isFinite(v.timeSeconds)||v.timeSeconds<0)))throw Error('观察记录不合法');
 return {schema:p.schema,modelHash:p.modelHash,modelVersion:MODEL_VERSION,sharedRuntimeRequired:true,person:p.person,identity:p.identity.slice(),expression:p.expression.slice(),observations:p.observations.map(({name,type,note,timeSeconds})=>({name,type,note,timeSeconds:timeSeconds??null})),fitStatus:'not-fitted'};
}
export function objText(positions,triangles){let s='# KAOPU face R01: current GNM geometry, not photo reconstruction\n# Coordinate system: Y up, Z front. Source GNM units retained. No texture.\n';for(let i=0;i<positions.length;i+=3)s+='v '+Array.from(positions.subarray(i,i+3),x=>x.toFixed(7)).join(' ')+'\n';for(let i=0;i<triangles.length;i+=3)s+='f '+[triangles[i]+1,triangles[i+1]+1,triangles[i+2]+1].join(' ')+'\n';return s;}
