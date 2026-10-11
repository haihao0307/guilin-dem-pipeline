// Original fictional neighbourhood recipe. Image coordinates are never used as metres.
export const VERSION='walled-neighbours/1';
export const HUMAN={radius:.24,height:1.82,minimumPortalWidth:.82,minimumPortalHeight:2.02};
export const BRICK={length:.24,height:.06115,depth:.11077,bed:.008822619047619,head:.0088};
const copy=x=>JSON.parse(JSON.stringify(x));
function hash(s){let x=2166136261;for(const c of s)x=Math.imul(x^c.charCodeAt(0),16777619);return x>>>0;}
export function makeNeighbourhoodRecipe({seed=198107}={}){
 if(!Number.isSafeInteger(seed))throw Error('Integer seed required');
 const p={schema:VERSION,seed,units:[
  {id:'A',use:'住户兼小修理作坊',box:[-4,-3.6,-.4,0],floor:.04,height:2.44},
  {id:'B',use:'上层住户与有条件借道走廊',box:[-4,-3.6,-.4,0],floor:2.67,height:2.44},
  {id:'C',use:'经邻楼借道进入的住户',box:[.65,-3.35,3.85,.4],floor:2.67,height:2.68}],walls:[],wood:[],metal:[],floors:[],doors:[],routes:[],nodes:[],edges:[],sourcePolicy:{brick:'Original R3.12 brick field and material; cache exact seed tuples',wood:'Library timber v3 original geometry/material',metal:'Existing FH88 original material function',garments:'No validated garment inserted'},notHistoricalReconstruction:true};
 const wood=(id,size,position,rotation=[0,0,0],group='structure')=>p.wood.push({id,size,position,rotation:rotation.length?rotation:[0,0,0],group,presetId:'yunnan_light_weathered_v2',seed:seed+(hash(id)%10000)});
 const metal=(id,kind,data,role='iron',color='#3d4844',group='services')=>p.metal.push({id,kind,...data,role,color,group});
 const floor=(id,x0,z0,x1,z1,y,material='wood')=>p.floors.push({id,x0,z0,x1,z1,y,thickness:.09,material});
 const portal=(id,unit,side,center,width,height,bottom,kind=id.includes('window')?'window':'door')=>({id,unit,side,center,width,height,bottom,kind});
 const openings={
  A:{front:[portal('A-entry','A','front',-1.50,1.8,2.18,0)],back:[portal('A-back-window','A','back',-2.8,.98,.75,1.1)]},
  B:{front:[portal('B-entry','B','front',-1.05,1.12,2.18,0),portal('B-front-window','B','front',-2.8,1.15,1.12,.86)],right:[portal('B-borrow','B','right',-1.5,1.12,2.18,0)],left:[portal('B-side-window','B','left',-1.7,.98,1.04,.92)]},
  C:{left:[portal('C-entry','C','left',-1.5,1.12,2.18,0)],front:[portal('C-window','C','front',2.2,1.32,1.16,.92)],back:[portal('C-back-window','C','back',2.6,.82,.84,1.16)]}
 };
 for(const u of p.units){const [x0,z0,x1,z1]=u.box;floor(u.id+'-floor',x0,z0,x1,z1,u.floor,u.id==='A'?'mortar':'wood');
  for(const side of ['front','back','left','right']){
   const alongX=side==='front'||side==='back',start=alongX?x0:z0,end=alongX?x1:z1,fixed=side==='front'?z1:side==='back'?z0:side==='left'?x0:x1;
   const wall={id:u.id+'-'+side,unit:u.id,side,alongX,start,end,fixed,bottom:u.floor,height:u.height,openings:openings[u.id][side]||[],group:u.id+'-walls'};p.walls.push(wall);
   for(const o of wall.openings){const at=t=>alongX?[t,u.floor+o.bottom,fixed]:[fixed,u.floor+o.bottom,t],rot=alongX?[0,0,0]:[0,Math.PI/2,0];
    for(const sg of [-1,1])wood(o.id+'-jamb'+sg,[.12,o.height,.15],at(o.center+sg*(o.width/2-.06)).map((v,i)=>i===1?v+o.height/2:v),rot,'frames');
    wood(o.id+'-lintel',[o.width,.12,.17],at(o.center).map((v,i)=>i===1?v+o.height-.06:v),rot,'frames');
    if(o.kind==='door'&&o.id!=='A-entry'){p.doors.push({id:o.id,wallId:wall.id,hinge:at(o.center-o.width/2+.12),yaw:alongX?0:-Math.PI/2,width:o.width-.24,height:o.height-.12,open:true,borrowed:o.id==='B-borrow'});}
    else if(o.kind!=='door'){wood(o.id+'-sill',[o.width,.10,.25],at(o.center).map((v,i)=>i===1?v+.03:v),rot,'frames');
     for(let j=0;j<5;j++){const t=o.center-o.width/2+.13+j*(o.width-.26)/4,A=at(t),B=at(t);A[1]+=.10;B[1]+=o.height-.12;metal(o.id+'-bar'+j,'pipe',{points:[A,B],radius:.009},'iron','#34413d','window-cages');}}
   }
  }
  // Roof beams and rear timber storage loft are generated with their original material.
  floor(u.id+'-roof',x0-.08,z0-.1,x1+.08,z1+.1,u.floor+u.height+.10,'wood');
 }
 // Visible support posts and beams below the adjoining upper home.
 for(const x of [.80,3.70])for(const z of [-3.20,.25])wood('C-support-'+x+'-'+z,[.16,2.54,.16],[x,1.31,z],[],'structure');
 for(const z of [-3.20,.25])wood('C-cross-beam-'+z,[3.25,.18,.16],[2.25,2.49,z],[],'structure');
 // Shared courtyard/service floor is not assigned private ownership by the reference.
 floor('shared-ground',-4.25,-3.9,4.15,4.3,0,'mortar');
 floor('stair-mid',-3.98,.2,-1.88,1.2,1.355,'wood');floor('stair-top',-3.08,3.2,-.53,4.18,2.67,'wood');
 floor('upper-walk',-1.53,0,-.53,3.2,2.67,'wood');floor('borrow-bridge',-.45,-2.01,.70,-.99,2.67,'wood');
 const rise=(2.67-.04)/16;
 for(let i=0;i<8;i++){const y=.04+(i+1)*rise,z=3.2-(i+.5)*.25;wood('stair-out-'+i,[.94,.055,.255],[-3.48,y-.0275,z],[],'stairs');p.floors.push({id:'stair-out-'+i,x0:-3.95,x1:-3.01,z0:z-.125,z1:z+.125,y,thickness:.055,material:'existing-wood-step'});}
 for(let i=0;i<8;i++){const y=1.355+(i+1)*rise,z=1.2+(i+.5)*.25;wood('stair-return-'+i,[.94,.055,.255],[-2.39,y-.0275,z],[],'stairs');p.floors.push({id:'stair-return-'+i,x0:-2.86,x1:-1.92,z0:z-.125,z1:z+.125,y,thickness:.055,material:'existing-wood-step'});}
 for(const [i,A,B]of [[0,[-3.98,.09,3.3],[-3.98,1.42,1.1]],[1,[-2.98,.09,3.3],[-2.98,1.42,1.1]],[2,[-2.89,1.38,1.1],[-2.89,2.73,3.3]],[3,[-1.89,1.38,1.1],[-1.89,2.73,3.3]]])metal('stair-stringer'+i,'pipe',{points:[A,B],radius:.045},'steel','#56615d','stairs');
 // Continuous flight handrails; the route remains between their inner faces.
 for(const [i,A,B]of [[0,[-3.98,.09,3.3],[-3.98,1.42,1.1]],[1,[-2.98,.09,3.3],[-2.98,1.42,1.1]],[2,[-2.89,1.38,1.1],[-2.89,2.73,3.3]],[3,[-1.89,1.38,1.1],[-1.89,2.73,3.3]]]){
  metal('stair-handrail-'+i,'pipe',{points:[A.map((v,k)=>k===1?v+.98:v),B.map((v,k)=>k===1?v+.98:v)],radius:.018},'iron','#3d4844','stairs');
  for(const f of [0,.5,1]){const P=A.map((v,k)=>v+(B[k]-v)*f);metal('stair-rail-post-'+i+'-'+f,'pipe',{points:[P,P.map((v,k)=>k===1?v+.98:v)],radius:.012},'iron','#3d4844','stairs');}
 }
 const rail=(id,a,b,y)=>{metal(id+'-rail','pipe',{points:[[...a.slice(0,1),y,a[1]],[...b.slice(0,1),y,b[1]]],radius:.018});const n=Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/.55);for(let j=0;j<=n;j++){const x=a[0]+(b[0]-a[0])*j/n,z=a[1]+(b[1]-a[1])*j/n;metal(id+'-post'+j,'pipe',{points:[[x,y-.98,z],[x,y,z]],radius:.013});}};
 rail('top-outer',[-3.08,4.18],[-.53,4.18],3.68);rail('top-side',[-3.08,3.2],[-3.08,4.18],3.68);rail('mid-rear',[-3.98,.20],[-1.88,.20],2.365);
 rail('walk-left',[-1.53,.25],[-1.53,3.2],3.68);rail('walk-right',[-.53,.25],[-.53,4.18],3.68);rail('bridge-back',[-.42,-2.01],[.67,-2.01],3.68);rail('bridge-front',[-.42,-.99],[.67,-.99],3.68);
 function table(id,x,y,z,w=.8,d=.55){wood(id+'-top',[w,.05,d],[x,y+.70,z],[],'furniture');for(const sx of [-1,1])for(const sz of [-1,1])wood(id+'-leg'+sx+sz,[.045,.68,.045],[x+sx*(w/2-.05),y+.34,z+sz*(d/2-.05)],[],'furniture');}
 function bed(id,x,y,z){wood(id+'-base',[1.06,.08,1.92],[x,y+.40,z],[],'furniture');for(const sx of [-1,1])for(const sz of [-1,1])wood(id+'-post'+sx+sz,[.065,.68,.065],[x+sx*.5,y+.34,z+sz*.88],[],'furniture');wood(id+'-head',[1.06,.38,.06],[x,y+.63,z-.94],[],'furniture');}
 bed('B-bed',-3.20,2.67,-2.40);bed('C-bed',3.0,2.67,-2.18);table('B-table',-2.38,2.67,-.58);table('C-table',1.53,2.67,-.20);table('A-workbench',-2.5,.04,-2.6,1.8,.70);table('shared-prep',2.2,.04,-2.7,1.25,.58);
 for(const [id,x,y,z]of [['B-seat',-2.25,2.67,-1.23],['C-seat',1.55,2.67,-.92]]){wood(id,[.38,.07,.38],[x,y+.41,z],[],'furniture');for(const sx of [-1,1])for(const sz of [-1,1])wood(id+sx+sz,[.035,.38,.035],[x+sx*.14,y+.19,z+sz*.14],[],'furniture');}
 for(let k=0;k<3;k++){wood('A-shelf'+k,[1.45,.045,.32],[-3.12,.6+k*.46,-3.28],[],'furniture');for(let j=0;j<3;j++)metal('A-parts-can'+k+j,'cylinder',{position:[-3.65+j*.48,.70+k*.46,-3.25],radius:.08,height:.18},'steel',['#716e5f','#505852','#898572'][j],'objects');}
 for(const [id,x,y,z]of [['B-basin',-2.30,3.44,-.58],['C-pot',1.50,3.44,-.20],['ground-kettle',2.12,.81,-2.68]])metal(id,'bowl',{position:[x,y,z],radius:.14,height:.12},'steel','#89948d','objects');
 metal('roof-tank','cylinder',{position:[3.28,5.79,-2.7],radius:.36,height:.7},'steel','#626e68');
 metal('supply-main','pipe',{points:[[3.60,5.7,-2.7],[3.93,5.7,-2.7],[3.93,.55,-2.7],[2.62,.55,-2.7],[2.62,.88,-2.7]],radius:.024},'iron','#5c7069');
 metal('waste-main','pipe',{points:[[1.52,3.2,-.20],[.76,3.2,-.20],[.76,.18,-.20],[.76,.18,3.9]],radius:.044},'iron','#454c40');
 for(const x of [-3.55,2.7]){metal('antenna-mast'+x,'pipe',{points:[[x,5.20,-2.9],[x,6.10,-2.9]],radius:.009},'steel','#78857e');for(let j=0;j<4;j++)metal('antenna-cross'+x+j,'pipe',{points:[[x-.30,5.63+j*.11,-2.9],[x+.3,5.63+j*.11,-2.9]],radius:.006},'steel','#78857e');}
 const node=(id,at)=>p.nodes.push({id,at});node('street',[-1,.04,4.1]);node('A',[-2.05,.04,-.7]);node('stairs-bottom',[-3.48,.04,3.35]);node('mid',[-2.94,1.355,.72]);node('stairs-top',[-2.39,2.67,3.4]);node('B-door',[-1.05,2.67,.15]);node('B-home',[-1.05,2.67,-.65]);node('borrow-B',[-.20,2.67,-1.5]);node('borrow-C',[.79,2.67,-1.5]);node('C-home',[1.48,2.67,-1.5]);node('shared-service',[2.2,.04,-1.8]);
 const edge=(from,to,points,door=null)=>p.edges.push({from,to,points,door,minWidth:door?.88:.94,minHeight:2.06});
 edge('street','A',[[-1,.04,4.1],[-1.05,.04,.10],[-1.05,.04,-.7],[-2.05,.04,-.7]]);edge('street','stairs-bottom',[[-1,.04,4.1],[-3.48,.04,4.1],[-3.48,.04,3.35]]);
 edge('stairs-bottom','mid',[[-3.48,.04,3.35],...Array.from({length:8},(_,i)=>[-3.48,.04+(i+1)*rise,3.2-(i+.5)*.25]),[-3.48,1.355,.72],[-2.94,1.355,.72]]);
 edge('mid','stairs-top',[[-2.94,1.355,.72],[-2.39,1.355,.72],...Array.from({length:8},(_,i)=>[-2.39,1.355+(i+1)*rise,1.2+(i+.5)*.25]),[-2.39,2.67,3.4]]);
 edge('stairs-top','B-door',[[-2.39,2.67,3.4],[-1.05,2.67,3.4],[-1.05,2.67,.15]]);edge('B-door','B-home',[[-1.05,2.67,.15],[-1.05,2.67,-.65]],'B-entry');edge('B-home','borrow-B',[[-1.05,2.67,-.65],[-1.05,2.67,-1.5],[-.20,2.67,-1.5]],'B-borrow');edge('borrow-B','borrow-C',[[-.20,2.67,-1.5],[.79,2.67,-1.5]],'C-entry');edge('borrow-C','C-home',[[.79,2.67,-1.5],[1.48,2.67,-1.5]]);edge('street','shared-service',[[-1,.04,4.1],[2.2,.04,4.1],[2.2,.04,-1.8]]);
 p.declaredOmissions=['No generated residents or population claims','No unvalidated hanging garments or bedding material','Building structure and fire regulations are not certified'];return p;
}
export function wallCells(wall,seed=0){const b=BRICK,px=b.length+b.head,py=b.height+b.bed,out=[];const rows=Math.floor((wall.height+b.bed)/py);for(let row=0;row<rows;row++){const y=wall.bottom+b.height/2+row*py,shift=(row%2)*px/2;for(let i=0;i<Math.ceil((wall.end-wall.start)/px)+1;i++){const u=wall.start+b.length/2+i*px-shift;if(u-b.length/2<wall.start-.001||u+b.length/2>wall.end+.001)continue;const localY=y-wall.bottom;if(wall.openings.some(o=>Math.abs(u-o.center)<o.width/2+b.length/2+.004&&localY+b.height/2>o.bottom-.004&&localY-b.height/2<o.bottom+o.height+.004))continue;out.push({id:wall.id+'/'+row+'/'+i,position:wall.alongX?[u,y,wall.fixed]:[wall.fixed,y,u],yaw:wall.alongX?0:Math.PI/2,template:hash(seed+':'+wall.id+':'+row+':'+i)%8});}}return out;}
export function wallRegions(w){const xs=[w.start,w.end,...w.openings.flatMap(o=>[o.center-o.width/2,o.center+o.width/2])].sort((a,b)=>a-b),ys=[0,w.height,...w.openings.flatMap(o=>[o.bottom,o.bottom+o.height])].sort((a,b)=>a-b),out=[];for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++){const a=xs[i],b=xs[i+1],c=ys[j],d=ys[j+1];if(b-a<1e-6||d-c<1e-6)continue;const x=(a+b)/2,y=(c+d)/2;if(w.openings.some(o=>Math.abs(x-o.center)<o.width/2&&y>o.bottom&&y<o.bottom+o.height))continue;out.push({u0:a,u1:b,y0:w.bottom+c,y1:w.bottom+d});}return out;}
export function reachable(recipe,closed=[]){const seen=new Set(['street']);let change=true;while(change){change=false;for(const e of recipe.edges){if(e.door&&closed.includes(e.door))continue;if(seen.has(e.from)&&!seen.has(e.to)){seen.add(e.to);change=true;}if(seen.has(e.to)&&!seen.has(e.from)){seen.add(e.from);change=true;}}}return [...seen];}
export function cloneRecipe(p){return copy(p);}
