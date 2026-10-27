// New rule demonstration, not recovered measured-building door/window source.
export function growPort(p,e){
 const {id,hostId,floorId,origin,u,w,width,height,kind,open=0}=p;if(!['door','window'].includes(kind)||!Number.isFinite(open)||open<0||open>1)throw Error('Explicit port/open parameter required');
 const v=[0,1,0],f=.055,depth=.09,part=id+':assembly',point=(x,y,z,U=u)=>origin.map((a,k)=>a+U[k]*x+v[k]*y+w[k]*z),opts={owner:part,floorId,stage:7};
 e.node(part,kind,kind==='door'?'规则示范门组件':'规则示范可开玻璃窗',id,{floorId,stage:7,source:'new_rule_demonstration'});e.edge(part,hostId,'hostedBy');e.edge(part,id,'fills');
 const side={left:'左竖框',right:'右竖框',head:'上横框',sill:'下横框'};
 const label=key=>key.startsWith('frame-')?(kind==='door'?'门框':'固定窗框')+' · '+side[key.slice(6)]:key.startsWith('sash-')?'可开窗扇框 · '+side[key.slice(5)]:({leaf:'实体门扇','inset-panel':'门扇内嵌板',glass:'窗扇玻璃'})[key]??key;
 function panel(key,type,x0,y0,x1,y1,range,frame,supports=[]){return e.prism(part+':'+key,type,[[[x0,y0],[x1,y0],[x1,y1],[x0,y1]]],range,{...opts,...frame,label:label(key),partRole:key==='glass'?'glass':key.startsWith('frame')?'frame':key.startsWith('sash')?'sash':'leaf',supports});}
 e.frame(part,origin,[u,v,w]);const fixed={origin,u,v,w};for(const[k,a]of Object.entries({left:[0,0,f,height],right:[width-f,0,width,height],head:[f,height-f,width-f,height],sill:[f,0,width-f,f]}))if(kind!=='door'||k!=='sill')panel('frame-'+k,kind,...a,[-depth/2,depth/2],fixed,[hostId]);
 const a=open*Math.PI*4/9,U=u.map((x,k)=>x*Math.cos(a)+w[k]*Math.sin(a)),W=w.map((x,k)=>x*Math.cos(a)-u[k]*Math.sin(a)),frame={origin:point(f,kind==='door'?.015:f,0),u:U,v,w:W},Wleaf=width-2*f,Hleaf=height-f-(kind==='door'?.015:f);
 const hinge=part+':hinge-frame';e.coordinateFrame(hinge,part,frame.origin,[U,v,W]);frame.frameParent=hinge;
 if(kind==='door'){panel('leaf','door',0,0,Wleaf,Hleaf,[-.018,.018],frame,[part+':frame-left']);panel('inset-panel','door',.08,.12,Wleaf-.08,Hleaf-.16,[.018,.025],frame,[part+':leaf']);}
 else {for(const[k,b]of Object.entries({left:[0,0,f,Hleaf],right:[Wleaf-f,0,Wleaf,Hleaf],head:[f,Hleaf-f,Wleaf-f,Hleaf],sill:[f,0,Wleaf-f,f]}))panel('sash-'+k,'window',...b,[-.025,.025],frame,[part+':frame-left']);Object.assign(panel('glass','glass',f,f,Wleaf-f,Hleaf-f,[-.004,.004],frame,[part+':sash-sill']),{opacity:.25,partRole:'glass'});}
 const at=(x,y,z)=>frame.origin.map((a,k)=>a+U[k]*x+v[k]*y+W[k]*z),support=part+(kind==='door'?':leaf':':sash-right'),y=Hleaf*.52;
 e.roundMember(part+':handle','handrail',at(Wleaf-.035,y-.06,.05),at(Wleaf-.035,y+.06,.05),.018,{...opts,frameParent:hinge,label:kind==='door'?'门把手':'窗执手',supports:[support]});
 e.roundMember(part+':handle-stem','handrail',at(Wleaf-.035,y,.015),at(Wleaf-.035,y,.05),.015,{...opts,frameParent:hinge,label:'把手连接杆',supports:[support]});
 return{...p,componentId:part,angle:a,openingDirection:'outward',geometryEvidence:'new_rule_demonstration_not_measured'};
}
