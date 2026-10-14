module.exports=()=>{
 const v=window.__IDENTITY_QA__.viewer(),m=window.__IDENTITY_QA__.model(),T=window.__SSG_THREE__,a=v.geometry.attributes,rect=document.getElementById('canvas').getBoundingClientRect();
 const keys=['fRest','fA','fB','csRest','csRegion','csType','position','eOwned','lpRest','lpRegions'],stats={};
 for(const k of keys){const attr=a[k];if(!attr)continue;const min=Array(attr.itemSize).fill(Infinity),max=Array(attr.itemSize).fill(-Infinity);for(let i=0;i<attr.array.length;i++){const c=i%attr.itemSize;min[c]=Math.min(min[c],attr.array[i]);max[c]=Math.max(max[c],attr.array[i]);}stats[k]={count:attr.count,itemSize:attr.itemSize,min,max};}
 const best=[[610,650],[390,598],[500,487],[400,830],[525,310],[797,553]].map(([x,y])=>({x,y,d:Infinity})),p=new T.Vector3();
 for(let i=0;i<a.position.count;i++){p.fromBufferAttribute(a.position,i).project(v.camera);if(p.z>1||p.z<-1)continue;const x=rect.x+(p.x*.5+.5)*rect.width,y=rect.y+(-p.y*.5+.5)*rect.height;for(const b of best){const d=(x-b.x)**2+(y-b.y)**2;if(d<b.d)Object.assign(b,{d,id:i,depth:p.z});}}
 for(const b of best){b.values={};for(const k of keys){const attr=a[k];if(attr)b.values[k]=Array.from(attr.array.slice(b.id*attr.itemSize,(b.id+1)*attr.itemSize));}}
 return{attributes:Object.keys(a),bodyCount:m.bodyCount,vertexCount:m.vertexCount,stats,samples:best};
};