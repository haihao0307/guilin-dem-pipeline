/** R03.1 adult art-directed bony surface study.
 * Original code, informed by NCI/BodyParts3D surface anatomy references.
 * These are bounded skin ridges/depressions, not replacement bone meshes or a
 * medical tissue-thickness model. All offsets are applied before full CSR skinning.
 */
export const THORAX_SCHEMA='r033-thoracic-volume-study/1';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),gauss=x=>Math.exp(-.5*x*x),smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
export function installThoracicVolumeLayer(model){if(model.r033Thorax)throw Error('Bone surface layer already installed');const original=model.applyBodyDriver.bind(model),settings={amount:0},cache=new Map();model.r033Thorax={schema:THORAX_SCHEMA,settings,set(amount){if(!Number.isFinite(amount)||amount<0||amount>1.2)throw Error('Bone study outside adult pilot bounds');settings.amount=amount;}};
 model.applyBodyDriver=context=>{original(context);if(!settings.amount)return;const s=model.effectiveState;if(s.owners.rig!=='anny'||s.anny.phenotypes.age<.52)throw Error('Bone study requires adult Anny');if(s.anny.phenotypes.weight>.20)throw Error('Bone study limited to low-adiposity adults');const r=model.lastBodyDriver,key=JSON.stringify([s.anny.phenotypes,s.anny.localChanges]);let field=cache.get(key);
 if(!field){const p=r.sharedRestVertices,n=p.length/3,norm=new Float64Array(p.length),delta=new Float64Array(p.length),labels=r.rig.names,joint=name=>{const i=labels.indexOf(name);if(i<0)throw Error('Missing anatomical rig anchor '+name);const m=r.rig.restMatrices[i];return[m[3],m[7],m[11]]};
  for(let k=0;k<model.faces.length;k+=3){const a=model.faces[k],b=model.faces[k+1],c=model.faces[k+2];if(a>=n||b>=n||c>=n)continue;const u=[0,1,2].map(j=>p[b*3+j]-p[a*3+j]),v=[0,1,2].map(j=>p[c*3+j]-p[a*3+j]),q=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];for(const i of[a,b,c])for(let j=0;j<3;j++)norm[i*3+j]+=q[j];}
  const shoulder=joint('upperarm01.L'),clav=joint('shoulder01.L'),spine=joint('spine01'),waist=joint('spine03'),h=clav[2]-joint('pelvis.L')[2],scale=h/.557,half=shoulder[0],leftKnee=joint('lowerleg01.L'),leftAnkle=joint('foot.L'),leftElbow=joint('lowerarm01.L');let maxMM=0;
  for(let i=0;i<n;i++){const x=p[i*3],y=p[i*3+1],z=p[i*3+2],nx=norm[i*3],ny=norm[i*3+1],nz=norm[i*3+2],len=Math.hypot(nx,ny,nz)||1,N=[nx/len,ny/len,nz/len],ax=Math.abs(x),front=smooth(.05,.7,-N[1]),back=smooth(.05,.7,N[1]);let d=0;
   // Original anatomy-informed volume study. Public professional references
   // inform spatial relationships only; no scan vertices/textures were transferred.
   // Shoulder line descends laterally into the acromion, rather than tracing a rig joint.
   const t=clamp((ax-.020*scale)/(half*.90-.020*scale));
   const clavZ=clav[2]-.042*scale-.034*scale*t+.008*scale*Math.sin(2*Math.PI*t);
   const shoulderGate=smooth(.012*scale,.038*scale,ax)*(1-smooth(half*.87,half*1.01,ax));
   const crestWidth=(.012+.007*(1-t))*scale;
   d+=front*shoulderGate*(.008*scale*gauss((z-clavZ)/crestWidth)
      -.006*scale*gauss((z-clavZ+.036*scale)/(.027*scale))
      -.004*scale*gauss((z-clavZ-.025*scale)/(.020*scale)));
   // A broad pectoral covering thins over the rib cage; this is a plane change, not a groove.
   d-=front*.010*scale*gauss((ax-.085*scale)/(.060*scale))*gauss((z-(spine[2]+.050*scale))/(.055*scale));
   // Sternum is a restrained broad central plane, continuing toward xiphoid.
   d+=front*.003*scale*gauss(x/(.023*scale))*gauss((z-(spine[2]+.025*scale))/(.085*scale));
   // Paired convex lower thoracic masses and broad infra-sternal soft-tissue hollow.
   d+=front*.0065*scale*gauss((ax-.100*scale)/(.050*scale))*gauss((z-(spine[2]-.060*scale))/(.069*scale));
   d-=front*.012*scale*gauss(x/(.060*scale))*gauss((z-(spine[2]-.135*scale))/(.068*scale));
   // Broad shallow rib surfaces blend into sternum and flank. Not sharp costal outlines.
   const ribGate=smooth(.045*scale,.083*scale,ax)*(1-smooth(.155*scale,.205*scale,ax));
   for(let j=0;j<3;j++){
    const rz=spine[2]+.012*scale-j*.041*scale-.030*scale*Math.pow(clamp(ax/(.18*scale)),1.4);
    d+=front*ribGate*.0024*scale*gauss((z-rz)/(.0135*scale));
   }
   // Deltoid shoulder-cap transition and acromion prominence, localized with wide falloff.
   d+=.0038*scale*gauss((ax-half*.89)/(.031*scale))*gauss((z-(shoulder[2]+.009*scale))/(.026*scale))*smooth(-.1,.6,N[2]);
   d=clamp(d,-.017*scale,.013*scale);maxMM=Math.max(maxMM,Math.abs(d)*1000);for(let c=0;c<3;c++)delta[i*3+c]=N[c]*d;
  }
  field={delta,maxMM,anchors:{clavicle:clav,shoulder,spine,waist,knee:leftKnee,ankle:leftAnkle,elbow:leftElbow}};cache.set(key,field);
 }
 const w=r.packet.weights,points=r.packet.restPositionsPerInfluence;for(let i=0;i<model.bodyCount;i++){for(let k=w.ptr[i];k<w.ptr[i+1];k++)for(let c=0;c<3;c++)points[k*3+c]+=field.delta[i*3+c]*settings.amount;for(let c=0;c<3;c++)r.sharedRestVertices[i*3+c]+=field.delta[i*3+c]*settings.amount;}
 const posed=model.bodyDriver.skinAnnyPacket(r.packet,r.rig.skinMatrices);context.pos.set(posed);r.vertices=posed;r.positions=posed;r.rig.restPositionsPerInfluence=points;model.r033Thorax.last={maxDisplacementMM:field.maxMM*settings.amount,anchors:field.anchors,topologyUnchanged:true,weightsUnchanged:true,restJointsUnchanged:true};
 };return model.r033Thorax;
}
