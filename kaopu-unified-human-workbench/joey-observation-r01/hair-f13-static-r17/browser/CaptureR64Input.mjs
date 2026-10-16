const R64='8e1a19c8e55d938c546e111783126c73378cb37739152c378e0497debcd4bfc8';
const hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
export async function captureCurrentR64Input(api){
 const {controller,viewer:v}=api.motion(),m=controller.model,g=m.gnm,native=m.positions.slice(),archive=structuredClone(m.archive()),archiveText=JSON.stringify(archive),nativeSHA=await hash(native.buffer);
 if(nativeSHA!==R64)throw Error('F13 capture requires exact unchanged R64');
 const positions=Array.from(v.geometry.attributes.position.array.slice(0,m.vertexCount*3));
 for(let i=0;i<native.length;i+=3)if(positions[i]!==native[i]||positions[i+1]!==native[i+2]||positions[i+2]!==-native[i+1])throw Error('F13 viewer positions are stale or use an unsupported coordinate transform');
 const input={positions,triangles:Array.from(m.faces),chart:{positions:Array.from(g.template),triangles:Array.from(g.triangles),components:Array.from(g.componentId),landmarkIndices:Array.from(g.landmarkIndices),landmarkWeights:Array.from(g.landmarkWeights)},recipes:m.canonical.gnmRecipes,bodyCount:m.bodyCount,topology:m.canonical.topologySha256,adapter:m.adapterFingerprint};
 if(!native.every((x,i)=>Object.is(x,m.positions[i]))||JSON.stringify(m.archive())!==archiveText)throw Error('Native state changed during capture');
 return{input,archive,nativeSHA,nativeIdentityUnchanged:true};
}
