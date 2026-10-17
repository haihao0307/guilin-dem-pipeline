/** E1-R research candidate. Dimensions are explicit; artistic fits are not measurements. */
export const VERSION='kaopu/native-eye-optics@E1-R';
export const EVIDENCE={
 capture:'https://studios.disneyresearch.com/2014/11/19/high-quality-capture-of-eyes/',
 irisMorphology:'https://pmc.ncbi.nlm.nih.gov/articles/PMC3155193/',
 pigment:'https://pubmed.ncbi.nlm.nih.gov/8602783/',
 cornea:'https://pmc.ncbi.nlm.nih.gov/articles/PMC2795748/',
 tear:'https://www.ngs.noaa.gov/RESEARCH/RSD/main/products/tearfilm.html',
 teacher:'https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/bbd6de3ed7904429c7720e74c2297d1f04862314/skin-quality-lab/emily-transfer/eyes/EyeSystem.js'
};
export const PARAMETER_SCHEMA=Object.freeze({
 pupilDiameterMM:{unit:'mm',default:3.4,min:2,max:7.6,evidence:'teacher',confidence:'ET08 artist range, not a physiological bound'},
 irisRadiusMM:{unit:'mm',default:5.5,min:4,max:7,evidence:'capture',confidence:'must be replaced by native GNM bind measurement; 5.5 is fallback QA size'},
 limbusWidthMM:{unit:'mm',default:.36,min:.08,max:.8,evidence:'capture',confidence:'artist fit; no person-specific measurement'},
 irisReliefMM:{unit:'mm',default:.14,min:0,max:.28,evidence:'capture',confidence:'artist-fit mesostructure amplitude; not scan reconstruction'},
 corneaRadiusMM:{unit:'mm',default:7.8,min:7.5,max:8,evidence:'cornea',confidence:'typical central zone only; full surface is not spherical'},
 corneaThicknessMM:{unit:'mm',default:.55,min:.45,max:.7,evidence:'cornea',confidence:'typical approximation; varies spatially'},
 aqueousDepthMM:{unit:'mm',default:3.0,min:2,max:4,evidence:'capture',confidence:'unmeasured illustrative anterior chamber depth'},
 corneaIOR:{unit:'ratio',default:1.376,min:1.35,max:1.40,evidence:'cornea',confidence:'nominal visible-band value, not dispersion'},
 aqueousIOR:{unit:'ratio',default:1.336,min:1.32,max:1.35,evidence:'teacher',confidence:'nominal visible-band value; verify against calibrated target'},
 tearFilmMicrometres:{unit:'µm',default:3,min:1,max:6,evidence:'tear',confidence:'small-sample optical measurement reference; no simulated film geometry'},
 wetRoughness:{unit:'dimensionless GGX artist control',default:.09,min:.04,max:.3,evidence:'teacher',confidence:'uncalibrated microfacet roughness; not tear thickness'},
 scleraVesselWidthMM:{unit:'mm',default:.035,min:.01,max:.09,evidence:'capture',confidence:'appearance fit, not individual vessel measurement'}
});
export const PRESETS=Object.freeze({
 'dense-brown':{label:'Dense brown / compact anterior border',seed:7813,outerLinear:[.12,.054,.017],innerLinear:[.17,.075,.021],fiberScale:1.22,cryptCount:11,cryptDepth:.5,collarettePosition:.25,collaretteRelief:.60,furrowStrength:.50,pigmentVariation:.35},
 'open-hazel':{label:'Open hazel / irregular collarette',seed:18473,outerLinear:[.17,.18,.075],innerLinear:[.27,.125,.025],fiberScale:.87,cryptCount:29,cryptDepth:1,collarettePosition:.33,collaretteRelief:1,furrowStrength:.75,pigmentVariation:.72},
 'radial-blue':{label:'Radial blue / visible stromal trabeculae',seed:31519,outerLinear:[.105,.19,.225],innerLinear:[.14,.17,.14],fiberScale:1.03,cryptCount:20,cryptDepth:.85,collarettePosition:.28,collaretteRelief:.80,furrowStrength:.35,pigmentVariation:.24}
});
export function settings(overrides={}){const result=Object.fromEntries(Object.entries(PARAMETER_SCHEMA).map(([k,v])=>[k,v.default]));for(const[k,v]of Object.entries(overrides)){if(k==='preset'){if(!PRESETS[v])throw Error('Unknown iris preset');result.preset=v;continue;}if(!PARAMETER_SCHEMA[k])throw Error('Unknown eye parameter: '+k);const s=PARAMETER_SCHEMA[k];if(!Number.isFinite(v)||v<s.min||v>s.max)throw RangeError(k+' outside '+s.min+'..'+s.max+' '+s.unit);result[k]=v;}result.preset??='dense-brown';if(result.pupilDiameterMM>=result.irisRadiusMM*2-.4)throw RangeError('Pupil must leave at least 0.2 mm iris annulus');return result;}

