/* Final consolidated 1.5625 m field compiler. It bypasses all earlier experimental wrappers. */
parcelGrammar=function(easting,northing){
  const warpX=fbm2(easting*.00135,northing*.00135,SEEDS.field+31,2)*40;
  const warpZ=fbm2(easting*.00135+7.4,northing*.00135-5.1,SEEDS.field+73,2)*40;
  const angle=.27,ca=Math.cos(angle),sa=Math.sin(angle);
  const rx=easting*ca+northing*sa+warpX;
  const rz=-easting*sa+northing*ca+warpZ;
  const cellX=132,cellZ=94;
  const gx=Math.floor(rx/cellX),gz=Math.floor(rz/cellZ);
  const fu=fract(rx/cellX),fv=fract(rz/cellZ);
  const edge=Math.min(fu,1-fu,fv,1-fv);
  const boundary=1-smoothstep(.012,.078,edge);
  const fieldSeed=hash2(gx,gz,SEEDS.field+277);
  const ditchWarp=(valueNoise2(easting*.0027,northing*.0027,SEEDS.field+333)-.5)*20;
  const lineA=Math.abs(Math.sin((rx+ditchWarp)*.0122));
  const lineB=Math.abs(Math.sin((rz-ditchWarp)*.0155));
  const ditchA=1-smoothstep(.00,.115,lineA);
  const ditchB=1-smoothstep(.00,.095,lineB);
  return{boundary,fieldSeed,channel:Math.max(ditchA,ditchB*.55)};
};

deriveTerrainFields=function(dense,segments){
  const count=dense.length;
  const broad=boxBlur(dense,RENDER_GRID,RENDER_GRID,68);
  const medium=boxBlur(dense,RENDER_GRID,RENDER_GRID,26);
  const small=boxBlur(dense,RENDER_GRID,RENDER_GRID,6);
  const ordered=detectKarstPeaks(dense).sort((a,b)=>(b.score-Math.hypot(b.x,b.z)*.035)-(a.score-Math.hypot(a.x,a.z)*.035));
  const central=ordered.filter(peak=>Math.abs(peak.x)<430&&Math.abs(peak.z)<430);
  state.peaks=(central.length>=6?central:ordered).slice(0,8);

  const slope=new Float32Array(count),curvature=new Float32Array(count),karst=new Float32Array(count),rock=new Float32Array(count),paddy=new Float32Array(count),wet=new Float32Array(count),bund=new Float32Array(count),channel=new Float32Array(count),karstDelta=new Float32Array(count),fieldDelta=new Float32Array(count),unitSeed=new Float32Array(count),flow=new Float32Array(count),talus=new Float32Array(count),cliff=new Float32Array(count),terrace=new Float32Array(count),enhanced=new Float32Array(count);
  let karstMinimum=Infinity,karstMaximum=-Infinity,fieldMinimum=Infinity,fieldMaximum=-Infinity,paddySum=0,bundSum=0,channelSum=0;
  const elevationRange=Math.max(1,state.maximum-state.minimum);

  for(let row=0;row<RENDER_GRID;row++){
    for(let column=0;column<RENDER_GRID;column++){
      const index=row*RENDER_GRID+column;
      const truth=dense[index];
      const x=column*RENDER_SPACING-SIDE_M*.5,z=row*RENDER_SPACING-SIDE_M*.5;
      const easting=CENTER_E+x,northing=CENTER_N-z;
      const left=dense[row*RENDER_GRID+Math.max(0,column-1)],right=dense[row*RENDER_GRID+Math.min(RENDER_GRID-1,column+1)],down=dense[Math.max(0,row-1)*RENDER_GRID+column],up=dense[Math.min(RENDER_GRID-1,row+1)*RENDER_GRID+column];
      const dx=Math.max(RENDER_SPACING,(Math.min(RENDER_GRID-1,column+1)-Math.max(0,column-1))*RENDER_SPACING),dz=Math.max(RENDER_SPACING,(Math.min(RENDER_GRID-1,row+1)-Math.max(0,row-1))*RENDER_SPACING);
      const slopeDegrees=Math.atan(Math.hypot((right-left)/dx,(up-down)/dz))*180/Math.PI;
      const slopeNorm=clamp(slopeDegrees/62);
      const curv=clamp((small[index]-medium[index])/9,-1,1);
      const relief=truth-broad[index],mediumRelief=truth-medium[index];
      const baseWarp=fbm2(easting*.0047,northing*.0047,SEEDS.shape+101,2);
      let strongest=-Infinity,second=-Infinity,towerInfluence=0,wallInfluence=0,footInfluence=0;

      for(const peak of state.peaks){
        const ca=Math.cos(peak.angle),sa=Math.sin(peak.angle),px=x-peak.x,pz=z-peak.z;
        const rx=(px*ca+pz*sa)/peak.ellipse,rz=(-px*sa+pz*ca)*peak.ellipse;
        const theta=Math.atan2(rz,rx);
        const localWarp=baseWarp*.82+Math.sin(theta*4+peak.phase*17)*.07;
        const angularRadius=clamp(1+.17*Math.sin(theta*3+peak.phase*11)+.10*Math.sin(theta*5-peak.phase*17)+localWarp*.13,.69,1.34);
        const radius=peak.radius*(.86+.14*peak.phase);
        const normalizedRadius=Math.hypot(rx,rz)/(radius*angularRadius);
        const body=Math.pow(Math.max(0,1-smoothstep(.24,1.0,normalizedRadius)),.30);
        const crown=Math.pow(Math.max(0,1-normalizedRadius/.30),.58);
        const crownNotch=Math.pow(Math.abs(Math.sin(theta*3+peak.phase*19)),7)*crown;
        const offsetA=Math.hypot(rx-radius*.10*Math.cos(peak.phase*23),rz-radius*.10*Math.sin(peak.phase*23))/radius;
        const offsetB=Math.hypot(rx+radius*.12*Math.cos(peak.phase*31),rz+radius*.12*Math.sin(peak.phase*31))/radius;
        const spireA=Math.pow(Math.max(0,1-offsetA/.24),.72),spireB=Math.pow(Math.max(0,1-offsetB/.21),.76);
        const shoulderCut=Math.exp(-Math.pow((normalizedRadius-.58)/.15,2)),footCut=Math.exp(-Math.pow((normalizedRadius-.88)/.105,2));
        const grooves=Math.pow(Math.abs(Math.sin(theta*6+peak.phase*29+localWarp*4.2)),8)*body;
        const realGate=smoothstep(2.5,18,relief+body*18),amplitude=clamp(peak.amplitude*1.16,24,58);
        const local=realGate*(amplitude*(body*.66+crown*.28+spireA*.12+spireB*.09-crownNotch*.10-shoulderCut*.16-footCut*.22)-grooves*(2.2+amplitude*.055));
        if(local>strongest){second=strongest;strongest=local;}else if(local>second)second=local;
        towerInfluence=Math.max(towerInfluence,body);
        wallInfluence=Math.max(wallInfluence,smoothstep(.27,.48,normalizedRadius)*(1-smoothstep(.76,1.03,normalizedRadius))*body*2.5);
        footInfluence=Math.max(footInfluence,smoothstep(.70,.82,normalizedRadius)*(1-smoothstep(.96,1.15,normalizedRadius)));
      }

      const realHill=smoothstep(5,25,relief);
      const profileCut=-9.5*Math.pow(Math.sin(clamp((relief+2)/Math.max(22,Math.abs(relief)+27),0,1)*Math.PI),2)*realHill*smoothstep(.08,.54,slopeNorm);
      const wallGroove=(ridged2(easting*.031,northing*.031,SEEDS.weather+71,3)-.54)*5.2*wallInfluence;
      const karstValue=clamp(Math.max(0,strongest)+Math.max(0,second)*.15+profileCut+wallGroove,-16,58);
      const karstLikelihood=clamp(Math.max(towerInfluence,smoothstep(6,27,relief)*smoothstep(.06,.60,slopeNorm)),0,1);
      let cliffValue=clamp(smoothstep(.25,.66,slopeNorm)*(.35+.65*karstLikelihood)+wallInfluence*.76+smoothstep(8,30,mediumRelief)*.16,0,1);
      let talusValue=clamp(footInfluence*smoothstep(.07,.45,slopeNorm)*(1-cliffValue*.50),0,1);

      const waterDistance=nearestWaterDistance(x,z,segments),waterCore=1-smoothstep(8,28,waterDistance),waterInfluence=Math.exp(-waterDistance/104);
      const elev=(truth-state.minimum)/elevationRange,lowland=1-smoothstep(.085,.66,elev),flat=1-smoothstep(3.2,15.5,slopeDegrees),concavity=smoothstep(-.05,.55,-curv);
      const wetness=clamp(waterInfluence*.62+lowland*.20+concavity*.18+smoothstep(.43,.82,valueNoise2(easting*.0031,northing*.0031,SEEDS.water+7))*.09,0,1);
      const parentScore=lowland*flat*(.53+.47*wetness)*(1-waterCore*.96)*(1-cliffValue*.96)*(1-talusValue*.58);
      const parentMask=smoothstep(.075,.50,parentScore);
      const parcel=parcelGrammar(easting,northing),parcelUse=smoothstep(.035,.17,parcel.fieldSeed);
      const paddyValue=parentMask*mix(.82,1.0,parcelUse);
      const bundValue=paddyValue*Math.pow(parcel.boundary,.58),channelValue=paddyValue*parcel.channel*(1-parcel.boundary*.72);
      const terraceStep=.26+parcel.fieldSeed*.15,terraceTarget=Math.round(truth/terraceStep)*terraceStep,flatten=clamp((terraceTarget-truth)*.46,-.15,.15);
      const fieldValue=clamp(paddyValue*flatten+bundValue*(.44+parcel.fieldSeed*.22)-channelValue*(.26+parcel.fieldSeed*.15),-.42,.69);
      cliffValue*=1-paddyValue*.98;talusValue*=1-paddyValue*.88;
      const rockValue=clamp((cliffValue*.83+karstLikelihood*.34+talusValue*.20)*(1-paddyValue*.97),0,1);
      const flowValue=clamp(waterInfluence*.52+wetness*.29+channelValue*.46,0,1);

      slope[index]=slopeNorm;curvature[index]=curv;karst[index]=karstLikelihood;rock[index]=rockValue;paddy[index]=paddyValue;wet[index]=wetness;bund[index]=bundValue;channel[index]=channelValue;karstDelta[index]=karstValue;fieldDelta[index]=fieldValue;unitSeed[index]=parcel.fieldSeed;flow[index]=flowValue;talus[index]=talusValue;cliff[index]=cliffValue;terrace[index]=paddyValue*flat;enhanced[index]=truth+karstValue+fieldValue;
      karstMinimum=Math.min(karstMinimum,karstValue);karstMaximum=Math.max(karstMaximum,karstValue);fieldMinimum=Math.min(fieldMinimum,fieldValue);fieldMaximum=Math.max(fieldMaximum,fieldValue);paddySum+=paddyValue;bundSum+=bundValue;channelSum+=channelValue;
    }
  }

  state.karstRange=[karstMinimum,karstMaximum];state.fieldRange=[fieldMinimum,fieldMaximum];state.fieldStats={paddyFraction:paddySum/count,bundMean:bundSum/count,channelMean:channelSum/count};
  return{slope,curvature,karst,rock,paddy,wet,bund,channel,karstDelta,fieldDelta,unitSeed,flow,talus,cliff,terrace,truthNormals:buildNormalArray(dense),enhancedNormals:buildNormalArray(enhanced),enhanced};
};
