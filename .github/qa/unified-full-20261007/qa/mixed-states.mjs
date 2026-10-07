import{defaultState}from'../src/State.mjs';
/** Moderate, deliberately bounded combinations; no claim about arbitrary extremes. */
export function mixedState(owners,meta){
 const s=defaultState();s.owners={...s.owners,...owners};
 s.anny.phenotypes.weight=.65;s.anny.localChanges['nose-width1-incr']=.2;
 s.anny.pose={'upperarm01.L':[12,5,-20],head:[6,4,2],'eye.L':[5,-4,0],'eye.R':[5,-4,0]};
 s.anny.facialActions={jawOpen:.35,tongueOut:.1,mouthSmileLeft:.25,mouthSmileRight:.2,eyeBlinkLeft:.15,eyeBlinkRight:.1,eyeLookDownLeft:.2,eyeLookDownRight:.2};
 s.gnm.identity[0]=.3;s.gnm.expression[200]=.4;s.gnm.rotation=[.05,.10,0,0,.03,0,.04,0,0,.04,0,0];s.gnm.translation=[.001,0,0];
 s.mhr.identity[0]=.25;s.mhr.identity[22]=.2;s.mhr.pose[46]=.6;s.mhr.pose[24]=.08;s.mhr.pose[27]=.06;
 for(const[name,value]of Object.entries({jawDrop:.3,eyesClosed_L:.15,eyesClosed_R:.1,eyesLookDown_L:.2,eyesLookDown_R:.2}))s.mhr.expression[meta.expression_names.indexOf(name)]=value;
 return s;
}
