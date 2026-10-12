// Original KAOPU brow-band adaptation. Private observation data stays outside runtime.
export const BROW_PROFILE={
  "schema": "native-brow-band-profile/1",
  "targetLocalAbsX": [
    0.0135,
    0.0525
  ],
  "targetCenterYCoeff": [
    0.023063507612645855,
    0.020934294793689197,
    -0.03601081230538286
  ],
  "targetHalfWidthCoeff": [
    0.00358127304465216,
    -0.0033153868300632976,
    0.0006735128544348608
  ],
  "sourceAbsX": [
    0.13910000026226044,
    0.5416666865348816
  ],
  "sourceCenterYCoeff": [
    7.401087760925293,
    0.13941283524036407,
    -0.1588815301656723
  ],
  "sourceHalfWidthCoeff": [
    0.021927832194792458,
    -0.0016243330956924266,
    -0.006904565507457394
  ],
  "targetWidthClampM": [
    0.00018,
    0.0045
  ],
  "sourceHalfWidthFloor": 0.004,
  "sourceStyle": 3,
  "sourceSha256": "f8804d51c4e61c4309a0705d33f089986ba5fde0bb46830b48cc75ec7bf392fd",
  "scope": "One shared symmetric eyebrow strip on the frozen native R52 head; derived conditional camera/forehead projection, not measured person geometry. Existing CC0 source fibre variation retained.",
  "fitViews": [
    "E04 visible near brow",
    "U07 both visible brows"
  ],
  "heldOutBrowView": "U05, previously seen for face but not used in this brow fit",
  "notice": "Artistic native brow-band parameters. No source images or image target coordinates. Camera-conditioned; not measured physical person geometry."
};
const poly=(c,t)=>c.reduce((s,a,i)=>s+a*t**i,0),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function mapBrowField(sourcePoint,rootPoint,depth,profile=BROW_PROFILE){
 if([...sourcePoint,...rootPoint,depth].some(x=>!Number.isFinite(x)))throw Error('Invalid brow source point');
 const [a,b]=profile.sourceAbsX,[c,d]=profile.targetLocalAbsX,t=(Math.abs(sourcePoint[0])-a)/(b-a),sourceHalf=Math.max(profile.sourceHalfWidthFloor,poly(profile.sourceHalfWidthCoeff,t)),residual=(sourcePoint[1]-poly(profile.sourceCenterYCoeff,t))/sourceHalf;
 const half=clamp(poly(profile.targetHalfWidthCoeff,t),...profile.targetWidthClampM);
 return[Math.sign(rootPoint[0])*(c+(d-c)*t),poly(profile.targetCenterYCoeff,t)+residual*half,depth];
}
export function browDensity(sourceRootX){const[a,b]=BROW_PROFILE.sourceAbsX,t=clamp((Math.abs(sourceRootX)-a)/(b-a),0,1),smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};return(.55+.45*smooth(t/.15))*(1-.45*smooth((t-.86)/.14));}
