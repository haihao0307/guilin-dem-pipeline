/** R03.1 adult art-directed bony surface study.
 * Original code, informed by NCI/BodyParts3D surface anatomy references.
 * These are bounded skin ridges/depressions, not replacement bone meshes or a
 * medical tissue-thickness model. All offsets are applied before full CSR skinning.
 */
export const BONY_SCHEMA='r031-anatomical-surface-study/1';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),gauss=x=>Math.exp(-.5*x*x),smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
export function installBonyLandmarkLayer(model){if(model.r031Bony)throw Error('Bone surface layer already installed');const original=model.applyBodyDriver.bind(model),settings={amount:0},cache=new Map();model.r031Bony={schema:BONY_SCHEMA,settings,set(amount){if(!Number.isFinite(amount)||amount<0||amount>1.2)throw Error('Bone study outside adult pilot bounds');settings.amount=amount;}};
 model.applyBodyDriver=context=>{original(context);if(!settings.amount)return;const s=model.effectiveState;if(s.owners.rig!=='anny'||s.anny.phenotypes.age<.52)throw Error('Bone study requires adult Anny');if(s.anny.phenotypes.weight>.20)throw Error('Bone study limited to low-adiposity adults');const r=model.lastBodyDriver,key=JSON.stringify([s.anny.phenotypes,s.anny.localChanges]);let field=cache.get(key);
 if(!field){const p=r.sharedRestVertices,n=p.length/3,norm=new Float64Array(p.length),delta=new Float64Array(p.length),labels=r.rig.names,joint=name=>{const i=labels.indexOf(name);if(i<0)throw Error('Missing anatomical rig anchor '+name);const m=r.rig.restMatrices[i];return[m[3],m[7],m[11]]};
  for(let k=0;k<model.faces.length;k+=3){const a=model.faces[k],b=model.faces[k+1],c=model.faces[k+2];if(a>=n||b>=n||c>=n)continue;const u=[0,1,2].map(j=>p[b*3+j]-p[a*3+j]),v=[0,1,2].map(j=>p[c*3+j]-p[a*3+j]),q=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];for(const i of[a,b,c])for(let j=0;j<3;j++)norm[i*3+j]+=q[j];}
  const shoulder=joint('upperarm01.L'),clav=joint('shoulder01.L'),spine=joint('spine01'),waist=joint('spine03'),h=clav[2]-joint('pelvis.L')[2],scale=h/.557,half=shoulder[0],leftKnee=joint('lowerleg01.L'),leftAnkle=joint('foot.L'),leftElbow=joint('lowerarm01.L');let maxMM=0;
  for(let i=0;i<n;i++){const x=p[i*3],y=p[i*3+1],z=p[i*3+2],nx=norm[i*3],ny=norm[i*3+1],nz=norm[i*3+2],len=Math.hypot(nx,ny,nz)||1,N=[nx/len,ny/len,nz/len],ax=Math.abs(x),front=smooth(.05,.7,-N[1]),back=smooth(.05,.7,N[1]);let d=0;
   // Shoulder girdle: shallow S-like clavicular crest with soft adjacent hollows.
   const t=(ax-.018*scale)/(half*.92-.018*scale),clavZ=clav[2]-.004*scale+.010*scale*Math.sin(Math.PI*clamp(t));const lateral=smooth(0,.13,t)*(1-smooth(.90,1.04,t));
   d+=front*lateral*(.0055*scale*gauss((z-clavZ)/(.0105*scale))-.0028*scale*gauss((z-clavZ-.024*scale)/(.016*scale))-.0016*scale*gauss((z-clavZ+.024*scale)/(.017*scale)));
   d+=.003*scale*gauss((ax-half*1.01)/(.025*scale))*gauss((z-clav[2]-.003*scale)/(.025*scale))*smooth(-.05,.5,N[2]);
   // Costal margin: paired oblique arches; lateral ribs softly vanish medially.
   const u=(ax-.025*scale)/(.132*scale),costal=spine[2]-.070*scale-.080*scale*Math.sin(Math.PI*.65*clamp(u)),ribGate=smooth(0,.2,u)*(1-smooth(.84,1.08,u));
   d+=front*ribGate*(.0040*scale*gauss((z-costal)/(.011*scale))-.0024*scale*gauss((z-costal+.019*scale)/(.016*scale)));
   const sideGate=smooth(.06*scale,.10*scale,ax)*(1-smooth(.15*scale,.185*scale,ax));for(const off of [.014,-.030,-.070]){const ribZ=spine[2]+off*scale+.12*(ax-.10*scale);d+=front*sideGate*.0020*scale*gauss((z-ribZ)/(.009*scale));}
   d-=front*.0012*scale*gauss(x/(.013*scale))*gauss((z-spine[2])/(.09*scale));
   // Scapular spine, preserving the soft back rather than embossing a triangle.
   const scapZ=clav[2]-.050*scale+.12*(ax-.10*scale);d+=back*.0025*scale*gauss((ax-.115*scale)/(.054*scale))*gauss((z-scapZ)/(.014*scale));
   // Patella and tibial anterior crest, anchored to the current rig proportions.
   const kz=leftKnee[2],kx=leftKnee[0];d+=front*.0028*scale*gauss((ax-kx)/(.021*scale))*gauss((z-kz)/(.027*scale));const shinT=(kz-z)/(kz-leftAnkle[2]),shinX=kx+(leftAnkle[0]-kx)*clamp(shinT),shinGate=smooth(.09,.20,shinT)*(1-smooth(.80,.96,shinT));d+=front*.0022*scale*shinGate*gauss((ax-shinX)/(.009*scale));
   // Olecranon at the posterior elbow; no wrist/hand or adult cranium edits.
   d+=back*.0022*scale*gauss((ax-leftElbow[0])/(.023*scale))*gauss((z-leftElbow[2])/(.026*scale));
   d=clamp(d,-.006*scale,.007*scale);maxMM=Math.max(maxMM,Math.abs(d)*1000);for(let c=0;c<3;c++)delta[i*3+c]=N[c]*d;
  }
  field={delta,maxMM,anchors:{clavicle:clav,shoulder,spine,waist,knee:leftKnee,ankle:leftAnkle,elbow:leftElbow}};cache.set(key,field);
 }
 const w=r.packet.weights,points=r.packet.restPositionsPerInfluence;for(let i=0;i<model.bodyCount;i++){for(let k=w.ptr[i];k<w.ptr[i+1];k++)for(let c=0;c<3;c++)points[k*3+c]+=field.delta[i*3+c]*settings.amount;for(let c=0;c<3;c++)r.sharedRestVertices[i*3+c]+=field.delta[i*3+c]*settings.amount;}
 const posed=model.bodyDriver.skinAnnyPacket(r.packet,r.rig.skinMatrices);context.pos.set(posed);r.vertices=posed;r.positions=posed;r.rig.restPositionsPerInfluence=points;model.r031Bony.last={maxDisplacementMM:field.maxMM*settings.amount,anchors:field.anchors,topologyUnchanged:true,weightsUnchanged:true,restJointsUnchanged:true};
 };return model.r031Bony;
}
