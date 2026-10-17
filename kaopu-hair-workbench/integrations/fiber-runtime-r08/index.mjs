import {RuntimeController} from './RuntimeController.mjs';
export {photoRuntimePorts} from './F14Backend.mjs';

export function assertPhaseTwoAccepted(profile,receipt,structureSHA256){
 if(!profile?.id||profile.PhysicsProfile?.stage!==2||profile.PhysicsProfile.enabled!==true)throw Error('Physics remains locked by HairStyleProfile');
 if(profile.RestShape?.acceptance!=='accepted')throw Error('Static structure has not been visually accepted');
 if(!/^[a-f0-9]{64}$/.test(structureSHA256||''))throw Error('A structure SHA256 is required');
 if(receipt?.approvedBy!=='user'||receipt.profileId!==profile.id||receipt.structureSHA256!==structureSHA256||!Number.isFinite(Date.parse(receipt.approvedUTC)))throw Error('A matching human visual acceptance receipt is required');
 return true;
}

export function connectHairRuntime({profile,receipt,structureSHA256,ports}){
 assertPhaseTwoAccepted(profile,receipt,structureSHA256);
 // The controller only consumes ports; ownership of roots, guides, rest shape,
 // transported child frames and material stays with the recipient workbench.
 return new RuntimeController(ports);
}
