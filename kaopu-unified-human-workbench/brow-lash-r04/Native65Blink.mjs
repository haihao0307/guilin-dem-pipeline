import {FocusedBlink as NativeBlink} from '../brow-lash-r02/FocusedBlink.mjs';
import {closureWeight,NATIVE_CLOSURE_LIMIT} from './Profiles.mjs';
// The rejected R03 corrective is not imported, baked, or allocated a channel.
export class FocusedBlink extends NativeBlink{
 constructor(groom){super(groom);this.uiWeights=[0,0];this.maxObservedNativeWeight=0;}
 set(left,right=left){const l=closureWeight(left),r=closureWeight(right);this.uiWeights=[left,right];const result=super.set(l,r);this.maxObservedNativeWeight=Math.max(this.maxObservedNativeWeight,l,r);return result;}
 report(){return {...super.report(),version:'NATIVE-65-ENDPOINT-R04',uiWeights:[...this.uiWeights],nativeClosureLimit:NATIVE_CLOSURE_LIMIT,maxObservedNativeWeight:this.maxObservedNativeWeight,correctiveTargetCount:0,userCalibration:'100% control = retained native 65%',biologicalUniversal:false};}
}
