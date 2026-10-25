/* Pure whole-installation gates. Numeric inputs are inference, not A4 dimensions.
 * Positive scalar margins are geometric gates only, never strength acceptance.
 */
(function(root){'use strict';
function lateralFamily(p={}){
 const d={powerBoreRadius:.23495,powerOuterRadius:.26,valveBoreRadius:.1143,chestOuterRadius:.14,frameInnerX:.525,clearance:.005,minimumChosenWall:.020,...p};
 const disjointLow=d.powerOuterRadius+d.chestOuterRadius+d.clearance;
 const fusedLow=Math.max(d.powerBoreRadius+d.chestOuterRadius+d.clearance,d.powerOuterRadius+d.valveBoreRadius+d.clearance);
 const high=d.frameInnerX-d.chestOuterRadius-d.clearance;
 return {parameters:d,maximumDisjointShellRadius:(d.frameInnerX-d.powerOuterRadius-2*d.clearance)/2,
  disjointStationaryShells:{absoluteMiddleXInterval:[disjointLow,high],nonempty:disjointLow<=high},
  sharedCastingWithSeparateUncutBores:{absoluteMiddleXInterval:[fusedLow,high],nonempty:fusedLow<=high},
  totalBoreToOuterWall:d.chestOuterRadius-d.valveBoreRadius,chosenWallThresholdMet:d.chestOuterRadius-d.valveBoreRadius>=d.minimumChosenWall,
  signsAllowedByCurrentEvidence:[-1,1],wholeAcceptance:false,actualUnionConnected:false};
}
function lateralMargins(m,p={}){const F=lateralFamily(p),d=F.parameters,x=Math.abs(m);return {...F,
 absoluteMiddleX:x,margins:{chestToFrame:d.frameInnerX-x-d.chestOuterRadius,chestToPowerBore:x-d.chestOuterRadius-d.powerBoreRadius,powerShellToValveBore:x-d.valveBoreRadius-d.powerOuterRadius,distinctBoreWebProjection:x-d.valveBoreRadius-d.powerBoreRadius,disjointOuterShells:x-d.chestOuterRadius-d.powerOuterRadius},
 note:'Non-negative x-projection gaps are sufficient despite power-axis inclination. Negative outer-shell gap may be intentional common casting, but is NOT a connectivity proof.'};}
function powerCoordinates(p,beta){const c=Math.cos(beta),s=Math.sin(beta);return {transverse:[p[0],c*(p[1]-1.016)-s*p[2]],axial:s*(p[1]-1.016)+c*p[2]};}
function powerAxisAtWorldZ(z,beta){return [0,1.016+Math.tan(beta)*z,z];}
function connectionWeb(p,{middleX=.38,planeY=1.48,beta=.126,zStart=4.5,zEnd=4.9,halfY=.08,innerX=.18,powerBoreRadius=.23495,valveBoreRadius=.1143}={}){
 const x=Math.sign(middleX)*p[0],ymid=powerAxisAtWorldZ(p[2],beta)[1],loY=Math.min(planeY,ymid)-halfY,hiY=Math.max(planeY,ymid)+halfY;
 const raw=Math.max(innerX-x,x-Math.abs(middleX),loY-p[1],p[1]-hiY,zStart-p[2],p[2]-zEnd);
 const q=powerCoordinates(p,beta),powerVoid=Math.hypot(...q.transverse)-powerBoreRadius,valveVoid=Math.hypot(p[0]-middleX,p[1]-planeY)-valveBoreRadius;
 return Math.max(raw,-powerVoid,-valveVoid);
}
function cycleGates(solver,{samples=1441,guideEnd=5.17,eyeRadius=.033,clearance=.005,rearGlandStart=4.228,frontGlandEnd=5.132,spindleEndReserve=.005,chestCenterZ=4.68,linerHalfLength=.43,headOutermostHalfExtent=.24,linerRear=4.25,linerFront=5.11,headCentres=[4.48,4.88],headHalfLength=.04}={}){
 let Mlo=Infinity,Mhi=-Infinity,qlo=Infinity,qhi=-Infinity,minH=Infinity,maxResidual=0,maxFiniteError=0;
 for(let i=0;i<samples;i++){const p=solver.pose(.4+i*2*Math.PI/(samples-1));Mlo=Math.min(Mlo,p.pins.M[2]);Mhi=Math.max(Mhi,p.pins.M[2]);qlo=Math.min(qlo,p.qMiddle);qhi=Math.max(qhi,p.qMiddle);minH=Math.min(minH,p.diagnostics.middleHeightSquared,p.diagnostics.leftCircle.heightSquared,p.diagnostics.rightCircle.heightSquared);maxResidual=Math.max(maxResidual,p.diagnostics.maxLengthError);maxFiniteError=Math.max(maxFiniteError,Math.abs(p.finiteMinusIdeal));}
 const l=solver.reference.lengths.middleSpindle;
 return {samples,absoluteThetaRange:[.4,.4+2*Math.PI],middleFrontZ:[Mlo,Mhi],middleDisplacement:[qlo,qhi],spindleRearZ:[Mlo-l,Mhi-l],maxLengthResidual:maxResidual,minimumSampledRadicand:minH,maxFiniteMinusIdeal:maxFiniteError,
  margins:{terminalEyeToGuide:Mlo-eyeRadius-guideEnd,terminalEyeToGuideAfterAllowance:Mlo-eyeRadius-guideEnd-clearance,rearSpindleBeyondGland:rearGlandStart-(Mhi-l),rearSpindleBeyondGlandAfterReserve:rearGlandStart-(Mhi-l)-spindleEndReserve,frontSpindleBeyondGland:Mlo-frontGlandEnd,headsInsideLiner:Math.min(Math.min(...headCentres)+qlo-headHalfLength-linerRear,linerFront-Math.max(...headCentres)-qhi-headHalfLength)},
  minimumSpindleLengthFromRearGland:Mhi-rearGlandStart+spindleEndReserve,
  constraints:['Mminimum - eyeRadius >= guideEnd + clearance','spindleLength >= Mmaximum - rearGlandStart + spindleEndReserve','min(headCentres) + qminimum - headHalfLength >= linerRear; max(headCentres) + qmaximum + headHalfLength <= linerFront'],
  sourceNotes:'Guide, reserves, valve head and liner dimensions are chosen candidates; no valve event/port timing proof.',continuousPhaseProof:false,wholeAcceptance:false};
}
const api={lateralFamily,lateralMargins,powerCoordinates,powerAxisAtWorldZ,connectionWeb,cycleGates};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.R29_INSTALLATION_CONSTRAINTS=api;
})(typeof window!=='undefined'?window:globalThis);
