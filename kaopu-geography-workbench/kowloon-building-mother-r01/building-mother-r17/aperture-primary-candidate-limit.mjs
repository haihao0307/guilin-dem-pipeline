/** Candidate scheduling only, for the existing previous-hit acceptance test.
 * Keep t=1e20, found=false, old candidate order, own/coverage queries, EPS tie
 * arbitration, and the caller's final t+lo<=hi unchanged.
 *
 * Float32 argument: if fl(candidate+lo)<=hi, then candidate is below an
 * outward-rounded nextUp(hi)-lo. A rejected candidate can still affect a later
 * winner through the old abs(candidate-t)<EPS / ID rule. One EPS is NOT enough:
 * this influence can propagate along a chain of tie-neighbouring endpoints.
 * There are at most 4*primitiveCount endpoints. In the graph joining endpoints
 * whose original subtraction can pass that tie test, every simple path has
 * fewer than that many edges, each shorter than nextUp(EPS). Keep the entire
 * cumulative band. Components above it cannot affect an accepted endpoint.
 *
 * Proof assumes the existing finite highp Float32 arithmetic. Abnormal ranges,
 * subnormal-scale camera bounds, invalid counts and non-primary rays fail open.
 * Actual native GPU buffer equality remains a required integration test.
 */
const F=Math.fround,MAX_PARTS=4096,SAFE_MIN=2**-100,UNBOUNDED=F(1e20),EPS=F(.000002);
const float=new Float32Array(1),bits=new Uint32Array(float.buffer);
function nextUpPositive(value){float[0]=value;if(!(float[0]>=0)||!Number.isFinite(float[0]))return Infinity;bits[0]++;return float[0];}
const outward=value=>nextUpPositive(nextUpPositive(F(value)));

export function conservativeApertureCandidateLimit({lo,hi,primitiveCount,enabled=true,primaryRay=true}={}){
 const open=reason=>({enabled:false,limit:UNBOUNDED,reason});
 if(!enabled||!primaryRay)return open('disabled-or-non-primary');
 lo=F(lo);hi=F(hi);
 if(!Number.isFinite(lo)||!Number.isFinite(hi)||lo<0||hi<lo||hi<SAFE_MIN||hi>=F(1e19)||(lo>0&&lo<SAFE_MIN))return open('unproved-bound-range');
 if(!Number.isInteger(primitiveCount)||primitiveCount<1||primitiveCount>MAX_PARTS)return open('invalid-primitive-count');
 const visibleUpper=outward(F(nextUpPositive(hi)-lo)),endpointBudget=4*primitiveCount;
 const tieBand=outward(F(endpointBudget*nextUpPositive(EPS))),limit=outward(F(visibleUpper+tieBand));
 if(!Number.isFinite(limit)||!(limit>=visibleUpper&&visibleUpper>=0))return open('unproved-outward-arithmetic');
 return{enabled:true,limit,visibleUpper,tieBand,endpointBudget};
}

export const APERTURE_PRIMARY_LIMIT_GLSL=`
uniform bool uAperturePrimaryLimitEnabled;
float aperturePrimaryCandidateLimit=1e20;
float apertureLimitNextUp(float x){return uintBitsToFloat(floatBitsToUint(x)+1u);}
float apertureLimitOutward(float x){return apertureLimitNextUp(apertureLimitNextUp(x));}
void apertureSetPrimaryCandidateLimit(float lo,float hi,bool primaryRay){
 aperturePrimaryCandidateLimit=1e20;
 if(!uAperturePrimaryLimitEnabled||!primaryRay)return;
 const float safeMin=7.888609052210118054117285652827862296732064351090230047702789306640625e-31;
 if(isnan(lo)||isnan(hi)||isinf(lo)||isinf(hi)||lo<0.||hi<lo||hi<safeMin||hi>=1e19||(lo>0.&&lo<safeMin))return;
 float count=apertureRecord(0).x;if(!(count>=1.&&count<=4096.&&floor(count)==count))return;
 float visibleUpper=apertureLimitOutward(apertureLimitNextUp(hi)-lo);
 float tieBand=apertureLimitOutward((4.*count)*apertureLimitNextUp(apertureEPS));
 float limit=apertureLimitOutward(visibleUpper+tieBand);
 if(isnan(limit)||isinf(limit)||!(limit>=visibleUpper&&visibleUpper>=0.))return;
 aperturePrimaryCandidateLimit=limit;
}
`;
const ORIGINAL_REJECT='if(candidate<0.0||candidate>t||candidate>1e19)continue;';
export const APERTURE_PRIMARY_LIMIT_REJECT='if(uAperturePrimaryLimitEnabled&&candidate>aperturePrimaryCandidateLimit)continue;';

/** Wrap the existing local-cap or original bounded-recovery library. Integration:
 * 1. Uniform uAperturePrimaryLimitEnabled = internal QA/runtime option.
 * 2. After unchanged clipInterval, immediately before the existing trace call:
 *    apertureSetPrimaryCandidateLimit(lo,hi,uRayMode==0);
 * No helper call, disabled uniform or failed guard means original traversal.
 * Never initialize t from this bound, restrict union neighbours, or replace the
 * original final t+lo<=hi test with this outward scheduling bound.
 */
export function withAperturePrimaryCandidateLimit(source){
 if(typeof source!=='string'||source.includes('apertureSetPrimaryCandidateLimit('))throw Error('Unwrapped aperture source required');
 const anchor='bool apertureTraceRayFiltered(';
 if(source.split(anchor).length!==2||source.split(ORIGINAL_REJECT).length!==2)throw Error('Frozen aperture trace candidate contract changed');
 return source.replace(anchor,APERTURE_PRIMARY_LIMIT_GLSL+'\n'+anchor).replace(ORIGINAL_REJECT,ORIGINAL_REJECT+APERTURE_PRIMARY_LIMIT_REJECT);
}
