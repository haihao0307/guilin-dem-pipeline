struct Params{eye:vec3<f32>,age:f32,forward:vec3<f32>,fov:f32,right:vec3<f32>,aspect:f32,up:vec3<f32>,debug:f32,resolution:vec2<f32>,pad:vec2<f32>}
struct KpSurface { height:f32, albedo:vec3<f32>, roughness:f32, }
struct KpWoodParams {
  seed:f32,
  ringFrequency:f32,
  ringScale:f32,
  ringWarp:f32,
  fiberFrequency:f32,
  fineFiberFrequency:f32,
  poreFrequency:f32,
  fiberStrength:f32,
  colorBias:f32,
  roughness:f32,
  angleOffset:f32,
  textureScale:f32,
  grainContrast:f32,
  detailFineness:f32,
  microReliefM:f32,
  parallaxM:f32,
  macroDisplacementM:f32,
  reliefScale:f32,
  reliefQuality:f32,
  parallaxSteps:f32,
  clearcoat:f32,
  clearcoatRoughness:f32,
  specularLevel:f32,
  distanceFadeStart:f32,
  distanceFadeEnd:f32,
  toolPhase:f32,
  crackPhase:f32,
  knotPhase:f32,
  pithOffset:vec2<f32>,
  darkGrainColor:vec3<f32>,
  lightGrainColor:vec3<f32>,
  agedSurfaceColor:vec3<f32>,
  weatheredColor:vec3<f32>,
  freshCutColor:vec3<f32>,
  cavityColor:vec3<f32>,
}
struct KpWoodSample {
  surface:KpSurface,
  cavity:f32,
  clearcoat:f32,
  clearcoatRoughness:f32,
  specularLevel:f32,
  macroHeightM:f32,
  parallaxHeight01:f32,
}
struct KpPlasterParams {
 centerM:vec2<f32>, halfM:vec2<f32>, thicknessM:f32, reliefM:f32,
 geometryMicroM:f32, minThicknessM:f32, maxThicknessM:f32, microM:f32,
 paletteDark:vec3<f32>, paletteLight:vec3<f32>,
 grainWavelengthM:f32, grainHeightM:f32, grainColor:f32,
}
struct KpPlasterField {macroTone:f32,micro:f32,thicknessM:f32,surface:KpSurface,}
struct HitField { d:f32, id:u32, q:vec3<f32>, seed:f32, baseD:f32, extent:vec3<f32>, sourceSeed:f32, }
struct StationCandidates {count:u32,items:array<HitField,64>,}
struct StationState{age:f32,wet:f32,repair:f32,retained:f32,}
struct StationMatter{d:f32,surface:KpSurface,metal:f32,cavity:f32,specular:f32,microHeight:f32,layer:u32,}
struct StationGeometry{d:f32,loss:f32,thickness:f32,}
const KP_BRICK_PI:f32=3.14159265359;
const KP_BRICK_SCALE:f32=0.1153846154;
const KP_WOOD_PI:f32=3.141592653589793;
const KP_WOOD_TAU:f32=6.283185307179586;
const KP_STONE_SCALE_M:f32 = 0.12352941176470589;
const KP_STONE_KIND:i32 = 0;
const KP_STONE_MASTER_SEED:u32 = 8231u;
const KP_STONE_COLOR_SEED:f32 = 8632.0;
const KP_STONE_PORE_SEED:f32 = 8538.0;
const KP_STONE_WEATHER_SEED:f32 = 8832.0;
const SHED_FRONT:f32=-10.;
const SHED_LENGTH:f32=135.;
const SHED_HALF:f32=67.5;
const SHED_CENTER:f32=-77.5;
const SHED_BACK:f32=-145.;
const SHED_BAYS:f32=18.;
const BENCH_WOOD_SCALE:f32=4.;
const BENCH_WOOD_CONTRAST:f32=0.36;
const SHORE_X:f32=60.;
const GOODS_X:f32=41.5;
const GOODS_HALF:f32=42.;
const GOODS_CENTER:f32=-58.;
@group(0)@binding(0)var<uniform>u:Params;
fn br_h11(p:f32)->f32 {return fract(sin(p*127.1+311.7)*43758.5453123);}
fn br_roundBox(p:vec3<f32>,b:vec3<f32>,r:f32)->f32 {let q=abs(p)-b+vec3<f32>(r);return length(max(q,vec3<f32>(0.0)))+min(max(q.x,max(q.y,q.z)),0.0)-r;}
fn br_mid_x_m_m(tIn:f32)->f32 { var t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.01800174*cos(3.0*KP_BRICK_PI*t)+0.00862492*sin(3.0*KP_BRICK_PI*t)-0.00032245*cos(4.0*KP_BRICK_PI*t)-0.00199262*sin(4.0*KP_BRICK_PI*t); }
fn br_high_x_m_m(tIn:f32)->f32 { var t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.01471101*cos(5.0*KP_BRICK_PI*t)-0.00611511*sin(5.0*KP_BRICK_PI*t)+0.00505069*cos(6.0*KP_BRICK_PI*t)-0.01129023*sin(6.0*KP_BRICK_PI*t)+0.00016204*cos(7.0*KP_BRICK_PI*t)-0.00678541*sin(7.0*KP_BRICK_PI*t)+0.00910669*cos(8.0*KP_BRICK_PI*t)-0.00372102*sin(8.0*KP_BRICK_PI*t)+0.00386620*cos(9.0*KP_BRICK_PI*t)+0.00169141*sin(9.0*KP_BRICK_PI*t)+0.00255569*cos(10.0*KP_BRICK_PI*t)+0.00429621*sin(10.0*KP_BRICK_PI*t)-0.00149008*cos(11.0*KP_BRICK_PI*t)+0.00421699*sin(11.0*KP_BRICK_PI*t)-0.00482651*cos(12.0*KP_BRICK_PI*t)+0.00371242*sin(12.0*KP_BRICK_PI*t)-0.00518212*cos(13.0*KP_BRICK_PI*t)-0.00028101*sin(13.0*KP_BRICK_PI*t)-0.00483069*cos(14.0*KP_BRICK_PI*t)-0.00165143*sin(14.0*KP_BRICK_PI*t)-0.00203463*cos(15.0*KP_BRICK_PI*t)-0.00399068*sin(15.0*KP_BRICK_PI*t)+0.00089974*cos(16.0*KP_BRICK_PI*t)-0.00264073*sin(16.0*KP_BRICK_PI*t); }
fn br_mid_x_m_p(tIn:f32)->f32 { var t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.01135424*cos(3.0*KP_BRICK_PI*t)-0.00403594*sin(3.0*KP_BRICK_PI*t)+0.01141619*cos(4.0*KP_BRICK_PI*t)-0.00155239*sin(4.0*KP_BRICK_PI*t); }
fn br_high_x_m_p(tIn:f32)->f32 { var t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.01111828*cos(5.0*KP_BRICK_PI*t)-0.00524976*sin(5.0*KP_BRICK_PI*t)+0.00926048*cos(6.0*KP_BRICK_PI*t)-0.00196252*sin(6.0*KP_BRICK_PI*t)-0.01080133*cos(7.0*KP_BRICK_PI*t)-0.00236667*sin(7.0*KP_BRICK_PI*t)+0.00682428*cos(8.0*KP_BRICK_PI*t)+0.00034784*sin(8.0*KP_BRICK_PI*t)-0.00988528*cos(9.0*KP_BRICK_PI*t)-0.00067851*sin(9.0*KP_BRICK_PI*t)+0.00392564*cos(10.0*KP_BRICK_PI*t)+0.00248324*sin(10.0*KP_BRICK_PI*t)-0.00639717*cos(11.0*KP_BRICK_PI*t)-0.00103361*sin(11.0*KP_BRICK_PI*t)+0.00224399*cos(12.0*KP_BRICK_PI*t)+0.00279355*sin(12.0*KP_BRICK_PI*t)-0.00234379*cos(13.0*KP_BRICK_PI*t)-0.00034023*sin(13.0*KP_BRICK_PI*t)+0.00154531*cos(14.0*KP_BRICK_PI*t)+0.00135488*sin(14.0*KP_BRICK_PI*t)-0.00041372*cos(15.0*KP_BRICK_PI*t)+0.00081121*sin(15.0*KP_BRICK_PI*t)+0.00176690*cos(16.0*KP_BRICK_PI*t)-0.00017177*sin(16.0*KP_BRICK_PI*t); }
fn br_mid_x_p_m(tIn:f32)->f32 { var t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.01106844*cos(3.0*KP_BRICK_PI*t)+0.00366009*sin(3.0*KP_BRICK_PI*t)+0.00491573*cos(4.0*KP_BRICK_PI*t)-0.00304459*sin(4.0*KP_BRICK_PI*t); }
fn br_high_x_p_m(tIn:f32)->f32 { var t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.00968863*cos(5.0*KP_BRICK_PI*t)+0.00804842*sin(5.0*KP_BRICK_PI*t)-0.00023933*cos(6.0*KP_BRICK_PI*t)-0.00159630*sin(6.0*KP_BRICK_PI*t)-0.00533428*cos(7.0*KP_BRICK_PI*t)+0.00562751*sin(7.0*KP_BRICK_PI*t)-0.00301718*cos(8.0*KP_BRICK_PI*t)-0.00124667*sin(8.0*KP_BRICK_PI*t)-0.00068517*cos(9.0*KP_BRICK_PI*t)+0.00175252*sin(9.0*KP_BRICK_PI*t)-0.00175606*cos(10.0*KP_BRICK_PI*t)-0.00053161*sin(10.0*KP_BRICK_PI*t)+0.00314901*cos(11.0*KP_BRICK_PI*t)-0.00221809*sin(11.0*KP_BRICK_PI*t)-0.00002768*cos(12.0*KP_BRICK_PI*t)-0.00050747*sin(12.0*KP_BRICK_PI*t)+0.00322590*cos(13.0*KP_BRICK_PI*t)-0.00372527*sin(13.0*KP_BRICK_PI*t)+0.00009642*cos(14.0*KP_BRICK_PI*t)+0.00051161*sin(14.0*KP_BRICK_PI*t)+0.00137602*cos(15.0*KP_BRICK_PI*t)-0.00204386*sin(15.0*KP_BRICK_PI*t)-0.00040926*cos(16.0*KP_BRICK_PI*t)+0.00184796*sin(16.0*KP_BRICK_PI*t); }
fn br_mid_x_p_p(tIn:f32)->f32 { var t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.01568166*cos(3.0*KP_BRICK_PI*t)-0.00042124*sin(3.0*KP_BRICK_PI*t)+0.00873786*cos(4.0*KP_BRICK_PI*t)+0.00638691*sin(4.0*KP_BRICK_PI*t); }
fn br_high_x_p_p(tIn:f32)->f32 { var t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.01295239*cos(5.0*KP_BRICK_PI*t)-0.00380655*sin(5.0*KP_BRICK_PI*t)+0.00244597*cos(6.0*KP_BRICK_PI*t)+0.00179228*sin(6.0*KP_BRICK_PI*t)-0.00822504*cos(7.0*KP_BRICK_PI*t)-0.00912719*sin(7.0*KP_BRICK_PI*t)+0.00818194*cos(8.0*KP_BRICK_PI*t)-0.00226580*sin(8.0*KP_BRICK_PI*t)+0.00200288*cos(9.0*KP_BRICK_PI*t)-0.00217961*sin(9.0*KP_BRICK_PI*t)+0.00524195*cos(10.0*KP_BRICK_PI*t)+0.00335884*sin(10.0*KP_BRICK_PI*t)-0.00236021*cos(11.0*KP_BRICK_PI*t)+0.00141195*sin(11.0*KP_BRICK_PI*t)+0.00291234*cos(12.0*KP_BRICK_PI*t)+0.00156187*sin(12.0*KP_BRICK_PI*t)-0.00192814*cos(13.0*KP_BRICK_PI*t)+0.00280991*sin(13.0*KP_BRICK_PI*t)-0.00040794*cos(14.0*KP_BRICK_PI*t)+0.00126868*sin(14.0*KP_BRICK_PI*t)-0.00433065*cos(15.0*KP_BRICK_PI*t)-0.00021126*sin(15.0*KP_BRICK_PI*t)+0.00012984*cos(16.0*KP_BRICK_PI*t)-0.00208270*sin(16.0*KP_BRICK_PI*t); }
fn br_mid_y_m_m(tIn:f32)->f32 { var t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.00630336*cos(3.0*KP_BRICK_PI*t)+0.00827031*sin(3.0*KP_BRICK_PI*t)+0.00566717*cos(4.0*KP_BRICK_PI*t)+0.00042867*sin(4.0*KP_BRICK_PI*t); }
fn br_high_y_m_m(tIn:f32)->f32 { var t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.00616945*cos(5.0*KP_BRICK_PI*t)+0.00614401*sin(5.0*KP_BRICK_PI*t)+0.00276823*cos(6.0*KP_BRICK_PI*t)-0.00324009*sin(6.0*KP_BRICK_PI*t)-0.00277462*cos(7.0*KP_BRICK_PI*t)+0.00419118*sin(7.0*KP_BRICK_PI*t)+0.00129222*cos(8.0*KP_BRICK_PI*t)-0.00251670*sin(8.0*KP_BRICK_PI*t)-0.00017492*cos(9.0*KP_BRICK_PI*t)+0.00320414*sin(9.0*KP_BRICK_PI*t)-0.00060079*cos(10.0*KP_BRICK_PI*t)-0.00079424*sin(10.0*KP_BRICK_PI*t)+0.00099889*cos(11.0*KP_BRICK_PI*t)+0.00100195*sin(11.0*KP_BRICK_PI*t)-0.00147204*cos(12.0*KP_BRICK_PI*t)+0.00019719*sin(12.0*KP_BRICK_PI*t)+0.00147029*cos(13.0*KP_BRICK_PI*t)-0.00057325*sin(13.0*KP_BRICK_PI*t)-0.00105959*cos(14.0*KP_BRICK_PI*t)+0.00146526*sin(14.0*KP_BRICK_PI*t)+0.00110262*cos(15.0*KP_BRICK_PI*t)-0.00092602*sin(15.0*KP_BRICK_PI*t)-0.00024836*cos(16.0*KP_BRICK_PI*t)+0.00177536*sin(16.0*KP_BRICK_PI*t); }
fn br_mid_y_m_p(tIn:f32)->f32 { var t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.00456362*cos(3.0*KP_BRICK_PI*t)+0.00232485*sin(3.0*KP_BRICK_PI*t)+0.00364059*cos(4.0*KP_BRICK_PI*t)-0.00296393*sin(4.0*KP_BRICK_PI*t); }
fn br_high_y_m_p(tIn:f32)->f32 { var t=tIn; t=clamp(t,-0.95,0.95);return 0.0+0.00058035*cos(5.0*KP_BRICK_PI*t)+0.00351213*sin(5.0*KP_BRICK_PI*t)-0.00311119*cos(6.0*KP_BRICK_PI*t)-0.00082560*sin(6.0*KP_BRICK_PI*t)+0.00447520*cos(7.0*KP_BRICK_PI*t)-0.00080438*sin(7.0*KP_BRICK_PI*t)-0.00625696*cos(8.0*KP_BRICK_PI*t)+0.00100661*sin(8.0*KP_BRICK_PI*t)+0.00468255*cos(9.0*KP_BRICK_PI*t)-0.00231942*sin(9.0*KP_BRICK_PI*t)-0.00397357*cos(10.0*KP_BRICK_PI*t)+0.00223223*sin(10.0*KP_BRICK_PI*t)+0.00344591*cos(11.0*KP_BRICK_PI*t)-0.00145876*sin(11.0*KP_BRICK_PI*t)-0.00081874*cos(12.0*KP_BRICK_PI*t)+0.00036113*sin(12.0*KP_BRICK_PI*t)+0.00095928*cos(13.0*KP_BRICK_PI*t)+0.00022236*sin(13.0*KP_BRICK_PI*t)+0.00016248*cos(14.0*KP_BRICK_PI*t)-0.00163296*sin(14.0*KP_BRICK_PI*t)-0.00041686*cos(15.0*KP_BRICK_PI*t)+0.00173083*sin(15.0*KP_BRICK_PI*t)+0.00042056*cos(16.0*KP_BRICK_PI*t)-0.00171078*sin(16.0*KP_BRICK_PI*t); }
fn br_mid_y_p_m(tIn:f32)->f32 { var t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.00568083*cos(3.0*KP_BRICK_PI*t)+0.00059518*sin(3.0*KP_BRICK_PI*t)+0.00165756*cos(4.0*KP_BRICK_PI*t)-0.00265243*sin(4.0*KP_BRICK_PI*t); }
fn br_high_y_p_m(tIn:f32)->f32 { var t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.00237719*cos(5.0*KP_BRICK_PI*t)+0.00155711*sin(5.0*KP_BRICK_PI*t)-0.00174800*cos(6.0*KP_BRICK_PI*t)-0.00034580*sin(6.0*KP_BRICK_PI*t)+0.00109223*cos(7.0*KP_BRICK_PI*t)-0.00076205*sin(7.0*KP_BRICK_PI*t)-0.00183915*cos(8.0*KP_BRICK_PI*t)+0.00169373*sin(8.0*KP_BRICK_PI*t)+0.00166788*cos(9.0*KP_BRICK_PI*t)-0.00197430*sin(9.0*KP_BRICK_PI*t)+0.00023726*cos(10.0*KP_BRICK_PI*t)+0.00209990*sin(10.0*KP_BRICK_PI*t)-0.00013690*cos(11.0*KP_BRICK_PI*t)-0.00204928*sin(11.0*KP_BRICK_PI*t)+0.00149101*cos(12.0*KP_BRICK_PI*t)+0.00080592*sin(12.0*KP_BRICK_PI*t)-0.00168845*cos(13.0*KP_BRICK_PI*t)-0.00052462*sin(13.0*KP_BRICK_PI*t)+0.00199706*cos(14.0*KP_BRICK_PI*t)-0.00016703*sin(14.0*KP_BRICK_PI*t)-0.00114543*cos(15.0*KP_BRICK_PI*t)+0.00067098*sin(15.0*KP_BRICK_PI*t)+0.00132124*cos(16.0*KP_BRICK_PI*t)-0.00060376*sin(16.0*KP_BRICK_PI*t); }
fn br_mid_y_p_p(tIn:f32)->f32 { var t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.01472244*cos(3.0*KP_BRICK_PI*t)+0.00196068*sin(3.0*KP_BRICK_PI*t)+0.00837774*cos(4.0*KP_BRICK_PI*t)-0.00049031*sin(4.0*KP_BRICK_PI*t); }
fn br_high_y_p_p(tIn:f32)->f32 { var t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.00814206*cos(5.0*KP_BRICK_PI*t)-0.00053856*sin(5.0*KP_BRICK_PI*t)+0.00257906*cos(6.0*KP_BRICK_PI*t)-0.00127762*sin(6.0*KP_BRICK_PI*t)-0.00086120*cos(7.0*KP_BRICK_PI*t)+0.00165010*sin(7.0*KP_BRICK_PI*t)-0.00324482*cos(8.0*KP_BRICK_PI*t)-0.00230772*sin(8.0*KP_BRICK_PI*t)+0.00531309*cos(9.0*KP_BRICK_PI*t)+0.00285670*sin(9.0*KP_BRICK_PI*t)-0.00601731*cos(10.0*KP_BRICK_PI*t)-0.00308967*sin(10.0*KP_BRICK_PI*t)+0.00756770*cos(11.0*KP_BRICK_PI*t)+0.00401337*sin(11.0*KP_BRICK_PI*t)-0.00704240*cos(12.0*KP_BRICK_PI*t)-0.00363779*sin(12.0*KP_BRICK_PI*t)+0.00672339*cos(13.0*KP_BRICK_PI*t)+0.00366736*sin(13.0*KP_BRICK_PI*t)-0.00539581*cos(14.0*KP_BRICK_PI*t)-0.00292112*sin(14.0*KP_BRICK_PI*t)+0.00379057*cos(15.0*KP_BRICK_PI*t)+0.00280410*sin(15.0*KP_BRICK_PI*t)-0.00302659*cos(16.0*KP_BRICK_PI*t)-0.00189233*sin(16.0*KP_BRICK_PI*t); }
fn br_mid_z_m_m(tIn:f32)->f32 { var t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.03445430*cos(3.0*KP_BRICK_PI*t)-0.00282014*sin(3.0*KP_BRICK_PI*t)+0.03501842*cos(4.0*KP_BRICK_PI*t)+0.00267835*sin(4.0*KP_BRICK_PI*t); }
fn br_high_z_m_m(tIn:f32)->f32 { var t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.03134970*cos(5.0*KP_BRICK_PI*t)-0.00507503*sin(5.0*KP_BRICK_PI*t)+0.02759835*cos(6.0*KP_BRICK_PI*t)+0.00467492*sin(6.0*KP_BRICK_PI*t)-0.02453092*cos(7.0*KP_BRICK_PI*t)-0.00547356*sin(7.0*KP_BRICK_PI*t)+0.02023931*cos(8.0*KP_BRICK_PI*t)+0.00660731*sin(8.0*KP_BRICK_PI*t)-0.01699690*cos(9.0*KP_BRICK_PI*t)-0.00634397*sin(9.0*KP_BRICK_PI*t)+0.01361088*cos(10.0*KP_BRICK_PI*t)+0.00712487*sin(10.0*KP_BRICK_PI*t)-0.01008559*cos(11.0*KP_BRICK_PI*t)-0.00675053*sin(11.0*KP_BRICK_PI*t)+0.00780155*cos(12.0*KP_BRICK_PI*t)+0.00722028*sin(12.0*KP_BRICK_PI*t)-0.00529194*cos(13.0*KP_BRICK_PI*t)-0.00638835*sin(13.0*KP_BRICK_PI*t)+0.00336004*cos(14.0*KP_BRICK_PI*t)+0.00624403*sin(14.0*KP_BRICK_PI*t)-0.00209103*cos(15.0*KP_BRICK_PI*t)-0.00553015*sin(15.0*KP_BRICK_PI*t)+0.00084286*cos(16.0*KP_BRICK_PI*t)+0.00479951*sin(16.0*KP_BRICK_PI*t); }
fn br_mid_z_m_p(tIn:f32)->f32 { var t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.01307475*cos(3.0*KP_BRICK_PI*t)+0.00450446*sin(3.0*KP_BRICK_PI*t)+0.00682105*cos(4.0*KP_BRICK_PI*t)+0.00639899*sin(4.0*KP_BRICK_PI*t); }
fn br_high_z_m_p(tIn:f32)->f32 { var t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.00571077*cos(5.0*KP_BRICK_PI*t)+0.00346485*sin(5.0*KP_BRICK_PI*t)+0.00609629*cos(6.0*KP_BRICK_PI*t)+0.00059963*sin(6.0*KP_BRICK_PI*t)-0.00710636*cos(7.0*KP_BRICK_PI*t)-0.00381479*sin(7.0*KP_BRICK_PI*t)+0.00135812*cos(8.0*KP_BRICK_PI*t)+0.00135282*sin(8.0*KP_BRICK_PI*t)-0.00506045*cos(9.0*KP_BRICK_PI*t)-0.00360239*sin(9.0*KP_BRICK_PI*t)+0.00308686*cos(10.0*KP_BRICK_PI*t)+0.00261325*sin(10.0*KP_BRICK_PI*t)-0.00270687*cos(11.0*KP_BRICK_PI*t)-0.00449361*sin(11.0*KP_BRICK_PI*t)+0.00262569*cos(12.0*KP_BRICK_PI*t)+0.00311502*sin(12.0*KP_BRICK_PI*t)-0.00162438*cos(13.0*KP_BRICK_PI*t)-0.00306571*sin(13.0*KP_BRICK_PI*t)+0.00251715*cos(14.0*KP_BRICK_PI*t)+0.00290793*sin(14.0*KP_BRICK_PI*t)-0.00087650*cos(15.0*KP_BRICK_PI*t)-0.00290014*sin(15.0*KP_BRICK_PI*t)+0.00095675*cos(16.0*KP_BRICK_PI*t)+0.00161494*sin(16.0*KP_BRICK_PI*t); }
fn br_mid_z_p_m(tIn:f32)->f32 { var t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.00543148*cos(3.0*KP_BRICK_PI*t)-0.01245624*sin(3.0*KP_BRICK_PI*t)+0.01205722*cos(4.0*KP_BRICK_PI*t)+0.00758454*sin(4.0*KP_BRICK_PI*t); }
fn br_high_z_p_m(tIn:f32)->f32 { var t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.01318042*cos(5.0*KP_BRICK_PI*t)-0.01120445*sin(5.0*KP_BRICK_PI*t)+0.00622728*cos(6.0*KP_BRICK_PI*t)+0.00643460*sin(6.0*KP_BRICK_PI*t)-0.00641567*cos(7.0*KP_BRICK_PI*t)-0.00656035*sin(7.0*KP_BRICK_PI*t)+0.00075536*cos(8.0*KP_BRICK_PI*t)+0.00936163*sin(8.0*KP_BRICK_PI*t)-0.00227068*cos(9.0*KP_BRICK_PI*t)-0.00692473*sin(9.0*KP_BRICK_PI*t)+0.00018661*cos(10.0*KP_BRICK_PI*t)+0.00740915*sin(10.0*KP_BRICK_PI*t)-0.00009489*cos(11.0*KP_BRICK_PI*t)-0.00591066*sin(11.0*KP_BRICK_PI*t)-0.00047542*cos(12.0*KP_BRICK_PI*t)+0.00438750*sin(12.0*KP_BRICK_PI*t)+0.00034270*cos(13.0*KP_BRICK_PI*t)-0.00324690*sin(13.0*KP_BRICK_PI*t)-0.00151968*cos(14.0*KP_BRICK_PI*t)+0.00176894*sin(14.0*KP_BRICK_PI*t)+0.00166849*cos(15.0*KP_BRICK_PI*t)-0.00123680*sin(15.0*KP_BRICK_PI*t)-0.00146369*cos(16.0*KP_BRICK_PI*t)+0.00149355*sin(16.0*KP_BRICK_PI*t); }
fn br_mid_z_p_p(tIn:f32)->f32 { var t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.00388179*cos(3.0*KP_BRICK_PI*t)+0.00390139*sin(3.0*KP_BRICK_PI*t)+0.00238573*cos(4.0*KP_BRICK_PI*t)-0.00329681*sin(4.0*KP_BRICK_PI*t); }
fn br_high_z_p_p(tIn:f32)->f32 { var t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.00010459*cos(5.0*KP_BRICK_PI*t)+0.00147038*sin(5.0*KP_BRICK_PI*t)+0.00066299*cos(6.0*KP_BRICK_PI*t)-0.00479755*sin(6.0*KP_BRICK_PI*t)+0.00106469*cos(7.0*KP_BRICK_PI*t)+0.00323743*sin(7.0*KP_BRICK_PI*t)-0.00034190*cos(8.0*KP_BRICK_PI*t)-0.00098051*sin(8.0*KP_BRICK_PI*t)+0.00303712*cos(9.0*KP_BRICK_PI*t)+0.00124931*sin(9.0*KP_BRICK_PI*t)-0.00262919*cos(10.0*KP_BRICK_PI*t)-0.00150538*sin(10.0*KP_BRICK_PI*t)+0.00194169*cos(11.0*KP_BRICK_PI*t)-0.00037848*sin(11.0*KP_BRICK_PI*t)-0.00197504*cos(12.0*KP_BRICK_PI*t)+0.00095933*sin(12.0*KP_BRICK_PI*t)+0.00272261*cos(13.0*KP_BRICK_PI*t)-0.00108356*sin(13.0*KP_BRICK_PI*t)-0.00067581*cos(14.0*KP_BRICK_PI*t)+0.00082625*sin(14.0*KP_BRICK_PI*t)+0.00043735*cos(15.0*KP_BRICK_PI*t)-0.00193681*sin(15.0*KP_BRICK_PI*t)-0.00039229*cos(16.0*KP_BRICK_PI*t)+0.00197941*sin(16.0*KP_BRICK_PI*t); }
fn br_midX(t:f32,sy:f32,sz:f32)->f32 {if(sy<0.0){if(sz<0.0){return br_mid_x_m_m(t);}return br_mid_x_m_p(t);}if(sz<0.0){return br_mid_x_p_m(t);}return br_mid_x_p_p(t);}
fn br_midY(t:f32,sx:f32,sz:f32)->f32 {if(sx<0.0){if(sz<0.0){return br_mid_y_m_m(t);}return br_mid_y_m_p(t);}if(sz<0.0){return br_mid_y_p_m(t);}return br_mid_y_p_p(t);}
fn br_midZ(t:f32,sx:f32,sy:f32)->f32 {if(sx<0.0){if(sy<0.0){return br_mid_z_m_m(t);}return br_mid_z_m_p(t);}if(sy<0.0){return br_mid_z_p_m(t);}return br_mid_z_p_p(t);}
fn br_highX(t:f32,sy:f32,sz:f32)->f32 {if(sy<0.0){if(sz<0.0){return br_high_x_m_m(t);}return br_high_x_m_p(t);}if(sz<0.0){return br_high_x_p_m(t);}return br_high_x_p_p(t);}
fn br_highY(t:f32,sx:f32,sz:f32)->f32 {if(sx<0.0){if(sz<0.0){return br_high_y_m_m(t);}return br_high_y_m_p(t);}if(sz<0.0){return br_high_y_p_m(t);}return br_high_y_p_p(t);}
fn br_highZ(t:f32,sx:f32,sy:f32)->f32 {if(sx<0.0){if(sy<0.0){return br_high_z_m_m(t);}return br_high_z_m_p(t);}if(sy<0.0){return br_high_z_p_m(t);}return br_high_z_p_p(t);}
fn br_nf(c:f32,h:f32,s:f32,band:f32)->f32 {return smoothstep(h-band,h+0.003,s*c);}
fn br_chipWear(vIn:f32)->f32 {let v=max(vIn-0.0018,0.0);return 0.020*tanh(v/0.020)*smoothstep(0.0010,0.0060,v);}
fn br_contour(v:f32)->f32 {return 0.0048*tanh(v/0.030);}
fn br_contourLong(v:f32)->f32 {let s=br_contour(v);if(s>=-0.0022){return s;}return -0.0022+0.00045*tanh((s+0.0022)/0.00045);}
fn br_mx(q:vec3<f32>,b:vec3<f32>,sy:f32,sz:f32)->f32{return br_nf(q.y,b.y,sy,0.042)*br_nf(q.z,b.z,sz,0.054);}
fn br_my(q:vec3<f32>,b:vec3<f32>,sx:f32,sz:f32)->f32{return br_nf(q.x,b.x,sx,0.062)*br_nf(q.z,b.z,sz,0.054);}
fn br_mz(q:vec3<f32>,b:vec3<f32>,sx:f32,sy:f32)->f32{return br_nf(q.x,b.x,sx,0.062)*br_nf(q.y,b.y,sy,0.042);}
fn br_ck(q:vec3<f32>,b:vec3<f32>,sx:f32,sy:f32,sz:f32)->f32{return br_nf(q.x,b.x,sx,0.080)*br_nf(q.y,b.y,sy,0.052)*br_nf(q.z,b.z,sz,0.064);}
fn br_ax(q:vec3<f32>,b:vec3<f32>,sy:f32,sz:f32)->vec3<f32>{let m=br_mx(q,b,sy,sz);let t=q.x/b.x;let md=br_midX(t,sy,sz);return vec3<f32>(br_chipWear(md+br_highX(t,sy,sz))*m,br_contourLong(md)*m,m);}
fn br_ay(q:vec3<f32>,b:vec3<f32>,sx:f32,sz:f32)->vec3<f32>{let m=br_my(q,b,sx,sz);let t=q.y/b.y;let md=br_midY(t,sx,sz);return vec3<f32>(br_chipWear(md+br_highY(t,sx,sz))*m,br_contour(md)*m,m);}
fn br_az(q:vec3<f32>,b:vec3<f32>,sx:f32,sy:f32)->vec3<f32>{let m=br_mz(q,b,sx,sy);let t=q.z/b.z;let md=br_midZ(t,sx,sy);return vec3<f32>(br_chipWear(md+br_highZ(t,sx,sy))*m,br_contour(md)*m,m);}
fn br_surfaceDelta(q:vec3<f32>,b:vec3<f32>)->f32 {
 var sum=vec3<f32>(0.0);
 sum+=br_ax(q,b,-1.0,-1.0);sum+=br_ax(q,b,-1.0,1.0);sum+=br_ax(q,b,1.0,-1.0);sum+=br_ax(q,b,1.0,1.0);
 sum+=br_ay(q,b,-1.0,-1.0);sum+=br_ay(q,b,-1.0,1.0);sum+=br_ay(q,b,1.0,-1.0);sum+=br_ay(q,b,1.0,1.0);
 sum+=br_az(q,b,-1.0,-1.0);sum+=br_az(q,b,-1.0,1.0);sum+=br_az(q,b,1.0,-1.0);sum+=br_az(q,b,1.0,1.0);
 sum.x+=0.0017*br_ck(q,b,-1.0,-1.0,1.0);sum.x+=0.0220*br_ck(q,b,-1.0,1.0,1.0);sum.x+=0.0140*br_ck(q,b,1.0,1.0,-1.0);sum.x+=0.0070*br_ck(q,b,1.0,1.0,1.0);
 return 0.038*tanh(sum.x*1.10/0.038)+sum.y/max(1.0,sum.z);
}
fn br_variant(qIn:vec3<f32>,variant:i32)->vec3<f32>{var q=qIn;if((variant&1)==1){q.x=-q.x;}if((variant&2)==2){q.z=-q.z;}return q;}
fn kpBrickBaseDistance(pLocalM:vec3<f32>,seed:f32,variant:i32,variation:f32)->f32 {
 let q=br_variant(pLocalM/KP_BRICK_SCALE,variant);let b=vec3<f32>(1.04,0.265,0.480);
 let gain=mix(1.0,0.90+0.20*br_h11(seed+7.1),variation);
 return KP_BRICK_SCALE*(br_roundBox(q,b,0.055)+br_surfaceDelta(q,b)*gain);
}
fn kpBrickAnalyticBoundDistance(pLocalM:vec3<f32>)->f32 {return KP_BRICK_SCALE*br_roundBox(pLocalM/KP_BRICK_SCALE,vec3<f32>(1.04,0.265,0.480),0.055);}
fn kpWoodDefaultParams()->KpWoodParams {
  var p:KpWoodParams;
  p.seed=0.7598925376683223;
  p.ringFrequency=22.0;
  p.ringScale=1.1240120360301806;
  p.ringWarp=1.174825141889602;
  p.fiberFrequency=8.73036012029089;
  p.fineFiberFrequency=72.0;
  p.poreFrequency=280.0;
  p.fiberStrength=0.34;
  p.colorBias=-0.015293409994337707;
  p.roughness=0.892843876922503;
  p.angleOffset=0.7194436165372647;
  p.textureScale=1.0;
  p.grainContrast=0.20902697160467504;
  p.detailFineness=1.0188769673019646;
  p.microReliefM=0.00028000000000000003;
  p.parallaxM=0.0010500000000000002;
  p.macroDisplacementM=0.0005600000000000001;
  p.reliefScale=0.7741619322448968;
  p.reliefQuality=3.0;
  p.parallaxSteps=12.0;
  p.clearcoat=0.0;
  p.clearcoatRoughness=1.0;
  p.specularLevel=0.13;
  p.distanceFadeStart=9.0;
  p.distanceFadeEnd=28.0;
  p.toolPhase=0.2499335163798811;
  p.crackPhase=1.1871775190974605;
  p.knotPhase=1.4286763223548267;
  p.pithOffset=vec2<f32>(0.04244730153121054,-0.07805894820950925);
  p.darkGrainColor=vec3<f32>(0.10224173308810132,0.06480326669290577,0.04091519690685319);
  p.lightGrainColor=vec3<f32>(0.31398871337571754,0.1946178304415758,0.11443537382697373);
  p.agedSurfaceColor=vec3<f32>(0.18782077230067787,0.13563332965520566,0.09758734714186246);
  p.weatheredColor=vec3<f32>(0.23455058216100522,0.21586050011389926,0.18782077230067787);
  p.freshCutColor=vec3<f32>(0.39157247774972326,0.26225065752969623,0.162029375639111);
  p.cavityColor=vec3<f32>(0.04091519690685319,0.027320891639074894,0.0202885630566524);
  return p;
}
fn kwVertexHash(pIn:vec3<f32>, wp:KpWoodParams, fp:f32)->f32 {
  var p=pIn;
  p = fract(p * 0.1031 + wp.seed * vec3<f32>(17.17, 41.73, 83.11));
  p += vec3<f32>(dot(p, p.yzx + vec3<f32>(31.32)));
  return fract((p.x + p.y) * p.z);
}
fn kwVertexNoise(p:vec3<f32>, wp:KpWoodParams, fp:f32)->f32 {
  var i:vec3<f32> = floor(p);
  var f:vec3<f32> = fract(p);
  f = f * f * (vec3<f32>(3.0) - 2.0 * f);
  return mix(
    mix(mix(kwVertexHash(i + vec3<f32>(0,0,0), wp, fp), kwVertexHash(i + vec3<f32>(1,0,0), wp, fp), f.x),
        mix(kwVertexHash(i + vec3<f32>(0,1,0), wp, fp), kwVertexHash(i + vec3<f32>(1,1,0), wp, fp), f.x), f.y),
    mix(mix(kwVertexHash(i + vec3<f32>(0,0,1), wp, fp), kwVertexHash(i + vec3<f32>(1,0,1), wp, fp), f.x),
        mix(kwVertexHash(i + vec3<f32>(0,1,1), wp, fp), kwVertexHash(i + vec3<f32>(1,1,1), wp, fp), f.x), f.y),
    f.z
  );
}
fn kwMacroField(pIn:vec3<f32>, wp:KpWoodParams, fp:f32)->f32 {
  var p=pIn;
  var result:f32 = 0.0;
  var amplitude:f32 = 0.58;
  for (var i = 0; i < 3; i++) {
    result += amplitude * kwVertexNoise(p, wp, fp);
    p = p * 2.07 + vec3<f32>(5.2, 9.1, 3.7);
    amplitude *= 0.45;
  }
  return result / 0.94;
}
fn kpWoodMacroDisplacement(pSourceM:vec3<f32>, surfaceClass:f32, wp:KpWoodParams)->f32 {
  let fp=0.0;
  let grain=pSourceM*max(wp.textureScale,0.001);
    var broad:f32 = kwMacroField(grain * vec3<f32>(0.28, 1.15, 1.15) + vec3<f32>(wp.seed * 7.0), wp, fp);
    var longWave:f32 = 0.5 + 0.5 * sin(grain.x * 0.82 + wp.seed * 29.0 + broad * 1.55);
    var macroHeight:f32 = (broad - 0.5) * 0.78 + (longWave - 0.5) * 0.22;
    var classWeight:f32 = 1.0;
    if (surfaceClass > 0.5 && surfaceClass < 2.5) { classWeight = 0.0; }
    else if (surfaceClass > 2.5 && surfaceClass < 3.5) { classWeight = 1.08; }
  return macroHeight * wp.macroDisplacementM * wp.reliefScale * classWeight;
}
fn st_hash33(pIn:vec3<f32>)->vec3<f32> {
 var p=fract(pIn*vec3<f32>(0.1031,0.1030,0.0973));
 p+=vec3<f32>(dot(p,p.yxz+vec3<f32>(33.33)));
 return fract((p.xxy+p.yxx)*p.zyx);
}
fn st_valueNoise3(p:vec3<f32>)->f32 {
 let i=floor(p);var f=fract(p);
 f=f*f*f*(f*(f*6.0-vec3<f32>(15.0))+vec3<f32>(10.0));
 return mix(mix(mix(st_hash33(i).x,st_hash33(i+vec3<f32>(1,0,0)).x,f.x),mix(st_hash33(i+vec3<f32>(0,1,0)).x,st_hash33(i+vec3<f32>(1,1,0)).x,f.x),f.y),mix(mix(st_hash33(i+vec3<f32>(0,0,1)).x,st_hash33(i+vec3<f32>(1,0,1)).x,f.x),mix(st_hash33(i+vec3<f32>(0,1,1)).x,st_hash33(i+vec3<f32>(1,1,1)).x,f.x),f.y),f.z);
}
fn st_seedVector(seed:f32,salt:f32)->vec3<f32> {
 return st_hash33(vec3<f32>(seed*0.001,salt,seed*0.00013))*49.0;
}
fn st_sf(p:vec3<f32>)->f32 {
 return st_valueNoise3(p)*0.57+st_valueNoise3(p*2.07+vec3<f32>(13.7))*0.28+st_valueNoise3(p*4.11+vec3<f32>(27.2))*0.15;
}
fn st_warp(p:vec3<f32>,seed:vec3<f32>)->vec3<f32> {
 return p+vec3<f32>(st_sf(p*0.8+seed),st_sf(p*0.8+seed+vec3<f32>(7.0)),st_sf(p*0.8+seed+vec3<f32>(19.0)))*0.25;
}
fn st_line(q:vec3<f32>,seed:vec3<f32>)->f32 {
 return abs(sin((q.x*0.84+q.y*0.37+q.z*0.51+st_sf(q*1.7+seed)*0.44)*12.0));
}
fn mt_kh(pIn:vec3<f32>)->f32{var p=fract(pIn*.1031);p+=vec3<f32>(dot(p,p.yzx+vec3<f32>(33.33)));return fract((p.x+p.y)*p.z);}
fn mt_kn(p:vec3<f32>)->f32{let i=floor(p);var f=fract(p);f=f*f*(vec3<f32>(3.)-2.*f);return mix(mix(mix(mt_kh(i),mt_kh(i+vec3<f32>(1,0,0)),f.x),mix(mt_kh(i+vec3<f32>(0,1,0)),mt_kh(i+vec3<f32>(1,1,0)),f.x),f.y),mix(mix(mt_kh(i+vec3<f32>(0,0,1)),mt_kh(i+vec3<f32>(1,0,1)),f.x),mix(mt_kh(i+vec3<f32>(0,1,1)),mt_kh(i+vec3<f32>(1,1,1)),f.x),f.y),f.z);}
fn kpMetalCorrosion(p:vec3<f32>,age:f32,wet:f32,repair:f32)->f32{let contact=(1.-smoothstep(.02,.07,abs(p.y-1.07)))*.7;let joint=(1.-smoothstep(.06,.18,p.y))+(1.-smoothstep(.01,.08,abs(p.y-.98)))*.28;return clamp(age*(1.-repair)*(wet*.7+joint*.55)*(1.-contact),0.,1.);}
fn pl_rotate(v:vec3<f32>,axis:vec3<f32>,a:f32)->vec3<f32>{let c=cos(a);let s=sin(a);return v*c+cross(axis,v)*s+axis*dot(axis,v)*(1.0-c);}
fn pl_warp(p:vec3<f32>,phase:vec3<f32>)->vec3<f32>{let c1=vec3<f32>(0.12,1.42,0.04)+0.035*phase;let a1=normalize(vec3<f32>(0.38,0.82,0.42));let v1=p-c1;let t1=0.65*exp(-dot(v1,v1)/(2.4*2.4))*sin(1.45*dot(a1,v1)+0.7+phase.x);let q=c1+pl_rotate(v1,a1,t1);let c2=vec3<f32>(-0.16,1.63,-0.06)+0.025*phase;let a2=normalize(vec3<f32>(-0.67,0.15,0.73));let v2=q-c2;let t2=0.20*exp(-dot(v2,v2)/(2.1*2.1))*sin(4.1*dot(a2,v2)+2.0+phase.y);return c2+pl_rotate(v2,a2,t2);}
fn pl_xi(p:vec3<f32>,phase:vec3<f32>)->vec3<f32>{let q=pl_warp(p,phase)+vec3<f32>(2.73,0.91,1.37);let r=max(length(q),1e-4);return vec3<f32>(log2(r)-2.0,-q.z/r,atan2(q.x,q.y));}
fn pl_cell(xi:vec3<f32>,sc:f32)->f32{let a=cos(sc*xi.z)*cos(sc*xi.x)+cos(sc*xi.y)*cos(sc*xi.y)+cos(sc*xi.y)*cos(sc*xi.x);return cos(a)-0.6556965458313674;}
fn pl_macroFast(p:vec3<f32>)->f32{let xi=pl_xi(p,vec3<f32>(0.7,-1.3,2.1));let s=pl_cell(xi,1.0)+pl_cell(xi,2.0)*0.5+pl_cell(xi,4.0)*0.25+pl_cell(xi,8.0)*0.125+pl_cell(xi,16.0)*0.0625;return tanh(0.78*s);}
fn pl_q(p:vec3<f32>,a:KpPlasterParams)->vec3<f32>{return vec3<f32>((p.xy-a.centerM)/max(a.halfM,vec2<f32>(0.08)),p.z*2.0);}
fn kpPlasterMacro(p:vec3<f32>,a:KpPlasterParams)->f32{let low=pl_macroFast(pl_q(p,a)+vec3<f32>(-0.17,0.31,0.09));let coarse=sin(p.x*2.7+p.y*0.9)*sin(p.y*3.2-p.x*0.7);return clamp(0.48*low+0.52*coarse,-1.0,1.0);}
fn stationPlasterParams(extent:vec3<f32>)->KpPlasterParams{return KpPlasterParams(vec2<f32>(0.),max(extent.xy,vec2<f32>(.08)),.0165,.0012+.0018*u.age,0.,.013,.020,.0001,vec3<f32>(.48,.44,.35),vec3<f32>(.82,.76,.64),.0008,.000008,.018);}
fn box(p:vec3<f32>,b:vec3<f32>)->f32{let q=abs(p)-b;return length(max(q,vec3<f32>(0.)))+min(max(q.x,max(q.y,q.z)),0.);}
fn cyl(p:vec3<f32>,r:f32,h:f32)->f32{let q=vec2<f32>(length(p.xz)-r,abs(p.y)-h);return min(max(q.x,q.y),0.)+length(max(q,vec2<f32>(0.)));}
fn segment(p:vec3<f32>,a:vec3<f32>,b:vec3<f32>,r:f32)->f32{let v=b-a;return length(p-a-v*clamp(dot(p-a,v)/dot(v,v),0.,1.))-r;}
fn recordPart(list:ptr<function,StationCandidates>,p:vec3<f32>,d:f32,id:u32,q:vec3<f32>,seed:f32){(*list).items[(*list).count]=HitField(d,id,q,seed,d,vec3<f32>(1.),0.);(*list).count+=1u;}
fn recordCoated(list:ptr<function,StationCandidates>,p:vec3<f32>,d:f32,q:vec3<f32>,extent:vec3<f32>,seed:f32){(*list).items[(*list).count]=HitField(d,13u,q,seed,d,extent,0.);(*list).count+=1u;}
fn recordTimber(list:ptr<function,StationCandidates>,p:vec3<f32>,d:f32,q:vec3<f32>,extent:vec3<f32>,role:f32,sourceSeed:f32){(*list).items[(*list).count]=HitField(d,4u,q,role,d,extent,sourceSeed);(*list).count+=1u;}
fn resolveCandidates(list:ptr<function,StationCandidates>,p:vec3<f32>)->HitField{var h=HitField(10000.,0u,p,0.,10000.,vec3<f32>(1.),0.);let st=resolveStationState(p);for(var i=0u;i<(*list).count;i++){var candidate=(*list).items[i];let d=candidate.d;let id=candidate.id;let native=id==1u||id==2u||id==3u||id==4u||id==12u||id==13u||id==15u||id==17u;if(native&&d-.03<h.d){if(abs(d)<.045){candidate.d=evaluateStationGeometry(candidate,p,st).d;}else{candidate.d=sign(d)*max(abs(d)-.03,0.);}}if(candidate.d<h.d){h=candidate;}}return h;}
fn rep(x:f32,pitch:f32,lo:f32,hi:f32)->f32{return x-clamp(round(x/pitch),lo,hi)*pitch;}
fn archHole(x:f32,y:f32,r:f32,spring:f32)->f32{return max(abs(x)-r,select(y-(spring+r),length(vec2<f32>(x,y-spring))-r,y>spring));}
fn stateWet(p:vec3<f32>)->f32{let drain=1.-smoothstep(.12,.75,abs(rep(p.x,7.5,-4.,4.)));let rain=(1.-smoothstep(7.5,12.,p.y))*smoothstep(.1,.4,p.y);return u.age*.12*(.15+drain*rain)+(1.-smoothstep(.2,1.8,p.y))*.15;}
fn repairAt(p:vec3<f32>)->f32{return .08+.65*(1.-smoothstep(.9,1.4,abs(p.x-15.)))*(1.-smoothstep(1.1,2.2,p.y));}
fn brickQ(p:vec3<f32>,axis:u32,d:f32)->vec3<f32>{let row=floor(p.y/.073);let shift=select(0.,.125,(i32(row)&1)==1);let face=select(p.x,p.z,axis==12u);return vec3<f32>(fract((face+shift)/.25)*.25-.125,fract(p.y/.073)*.073-.0365,.055384615+d);}
fn stationDomain(p:vec3<f32>,skipRoof:bool,skipFloor:bool)->HitField{
 var list:StationCandidates;list.count=0u;
 
 if(!skipFloor){recordPart(&list,p,box(p-vec3<f32>(0,.15,0),vec3<f32>(31.2,.7,8.8)),17u,p,1.);}
 if(!skipFloor){recordPart(&list,p,box(p-vec3<f32>(0.,.3,11.8),vec3<f32>(31.2,.55,3.)),17u,p,1.);}
 for(var i=0;i<4;i++){let z=14.9+f32(i)*.4;recordPart(&list,p,box(p-vec3<f32>(0,.55-f32(i)*.18,z),vec3<f32>(4.7,.16,.22)),2u,p,1.);}
 
 let hallBound=box(p-vec3<f32>(0,7,0),vec3<f32>(31.5,8.2,10.5));
 if(hallBound<2.){
  let bay=rep(p.x,7.5,-3.,3.);let q=vec3<f32>(p.x,p.y-6.4,abs(p.z)-8.);
  var wall=box(q,vec3<f32>(30.,5.55,.32));let opening=archHole(bay,p.y-.85,2.3,6.1);wall=max(wall,-opening);
  recordPart(&list,p,wall,1u,q,19.);
  
  let side=vec3<f32>(abs(p.x)-30.,p.y-6.4,p.z);recordPart(&list,p,box(side,vec3<f32>(.32,5.55,8.)),12u,side,31.);
  
  let cx=rep(p.x-3.75,7.5,-4.,3.);let col=vec3<f32>(cx,p.y-5.5,abs(p.z)-8.65);let theta=atan2(col.z,col.x);let flute=.014*(.5+.5*cos(theta*16.));
  recordCoated(&list,p,cyl(col,.43-flute,4.4),col,vec3<f32>(.43,4.4,.43),4.);recordCoated(&list,p,box(vec3<f32>(cx,p.y-1.12,abs(p.z)-8.65),vec3<f32>(.64,.28,.64)),vec3<f32>(cx,p.y-1.12,abs(p.z)-8.65),vec3<f32>(.64,.28,.64),4.);
  recordCoated(&list,p,cyl(vec3<f32>(cx,p.y-10.,abs(p.z)-8.65),.63,.24),vec3<f32>(cx,p.y-10.,abs(p.z)-8.65),vec3<f32>(.63,.24,.63),4.);
  for(var j=0;j<3;j++){let yy=10.3+f32(j)*.31;recordCoated(&list,p,box(vec3<f32>(p.x,p.y-yy,abs(p.z)-8.3),vec3<f32>(30.7,.13,.64)),vec3<f32>(p.x,p.y-yy,abs(p.z)-8.3),vec3<f32>(30.7,.13,.64),4.);}
  recordCoated(&list,p,box(vec3<f32>(p.x,p.y-12.15,abs(p.z)-8.1),vec3<f32>(30.7,.13,.3)),vec3<f32>(p.x,p.y-12.15,abs(p.z)-8.1),vec3<f32>(30.7,.13,.3),4.);
  recordCoated(&list,p,box(vec3<f32>(rep(p.x,.6,-50.,50.),p.y-11.65,abs(p.z)-8.1),vec3<f32>(.07,.4,.19)),vec3<f32>(rep(p.x,.6,-50.,50.),p.y-11.65,abs(p.z)-8.1),vec3<f32>(.07,.4,.19),4.);
  
  let ar=abs(length(vec2<f32>(bay,p.y-6.95))-2.46)-.15;recordCoated(&list,p,max(max(ar,6.95-p.y),abs(abs(p.z)-8.38)-.24),vec3<f32>(bay,p.y-8.255,abs(p.z)-8.38),vec3<f32>(2.61,1.305,.24),4.);
  recordCoated(&list,p,box(vec3<f32>(bay,p.y-9.6,abs(p.z)-8.5),vec3<f32>(.2,.38,.27)),vec3<f32>(bay,p.y-9.6,abs(p.z)-8.5),vec3<f32>(.2,.38,.27),4.);
  
  let roof=abs(p.y-(14.3-abs(p.z)*.25))-.07;recordPart(&list,p,max(roof,max(abs(p.x)-30.1,abs(p.z)-8.2)),3u,p,8.);
  let ped=max(abs(p.x)-6.4,max(10.7-p.y,(p.y+abs(p.x)*.53-14.15)/1.14));recordPart(&list,p,max(ped,abs(p.z-8.75)-.35),1u,vec3<f32>(p.x,p.y,1.),22.);
  let rim=abs((p.y+abs(p.x)*.53-14.15)/1.14)-.11;recordCoated(&list,p,max(rim,max(abs(p.x)-6.55,abs(p.z-8.95)-.39)),vec3<f32>(p.x,p.y-12.4,p.z-8.95),vec3<f32>(6.55,2.,.39),4.);
  let oculus=abs(length(vec2<f32>(p.x,p.y-12.5))-.52)-.105;recordCoated(&list,p,max(oculus,abs(p.z-9.15)-.12),vec3<f32>(p.x,p.y-12.5,p.z-9.15),vec3<f32>(.625,.625,.12),4.);
  
  let bq=vec3<f32>(rep(p.x,10.,-2.,2.),p.y-1.35,abs(p.z)-4.5);let slat=vec3<f32>(bq.x,bq.y,rep(bq.z,.13,-2.,2.));recordTimber(&list,p,box(slat,vec3<f32>(1.8,.045,.051)),slat,vec3<f32>(1.8,.045,.051),39.,round(p.x/10.)*17.+round(bq.z/.13)+select(0.,101.,p.z<0.));
  recordTimber(&list,p,box(vec3<f32>(bq.x,rep(bq.y-.5,.13,-2.,2.),bq.z-.33),vec3<f32>(1.8,.048,.039)),vec3<f32>(bq.x,rep(bq.y-.5,.13,-2.,2.),bq.z-.33),vec3<f32>(1.8,.048,.039),39.,round(p.x/10.)*17.+round((bq.y-.5)/.13)+.37+select(0.,101.,p.z<0.));
  let hl=vec3<f32>(abs(bq.x)-1.25,p.y,bq.z);recordPart(&list,p,segment(hl,vec3<f32>(0.,.86,-.28),vec3<f32>(0.,1.32,.28),.028),3u,hl,39.);recordPart(&list,p,segment(hl,vec3<f32>(0.,.86,.28),vec3<f32>(0.,1.32,-.28),.028),3u,hl,39.);recordPart(&list,p,segment(hl,vec3<f32>(0.,1.25,.27),vec3<f32>(0.,2.18,.35),.024),3u,hl,39.);
 }
 else{recordPart(&list,p,hallBound,0u,p,0.);}
 
 let tq=p-vec3<f32>(24,0,4);let tb=box(tq-vec3<f32>(0,23,0),vec3<f32>(4.8,23,4.8));
 if(tb<2.){
  let front=abs(tq.z)>abs(tq.x);let fq=select(vec3<f32>(tq.z,tq.y,abs(tq.x)),vec3<f32>(tq.x,tq.y,abs(tq.z)),front);
  var towerCore=box(tq-vec3<f32>(0,17.2,0),vec3<f32>(3.7,16.35,3.7));
  for(var wi=0;wi<2;wi++){let wy=select(22.3,31.,wi==1);let wx=select(fq.x,rep(fq.x,.9,-1.,1.),wi==1);let ww=select(.57,.30,wi==1);let wq=vec3<f32>(wx,fq.y-wy,fq.z-3.7);let hole=box(wq,vec3<f32>(ww,.85,.36));towerCore=max(towerCore,-hole);let frame=max(box(wq-vec3<f32>(0.,0.,.02),vec3<f32>(ww+.11,.97,.13)),-box(wq,vec3<f32>(ww,.85,.3)));recordCoated(&list,p,frame,wq-vec3<f32>(0.,0.,.02),vec3<f32>(ww+.11,.97,.13),84.);recordPart(&list,p,box(wq-vec3<f32>(0.,0.,.002),vec3<f32>(.022,.85,.034)),3u,wq,84.);recordPart(&list,p,box(wq-vec3<f32>(0.,0.,.002),vec3<f32>(ww,.022,.034)),3u,wq,84.);}
  recordPart(&list,p,towerCore,select(1u,12u,abs(tq.x)>abs(tq.z)),tq,71.);
  let corner=vec3<f32>(abs(tq.x)-3.35,tq.y-17.2,abs(tq.z)-3.35);recordCoated(&list,p,box(corner,vec3<f32>(.44,16.35,.44)),corner,vec3<f32>(.44,16.35,.44),5.);
  for(var j=0;j<5;j++){let yy=select(14.+f32(j)*5.,1.3,j==0);recordCoated(&list,p,box(tq-vec3<f32>(0,yy,0),vec3<f32>(3.98,.2,3.98)),tq-vec3<f32>(0,yy,0),vec3<f32>(3.98,.2,3.98),5.);}
  let dial=vec3<f32>(fq.x,fq.y-27.,fq.z-3.76);recordPart(&list,p,max(length(dial.xy)-1.46,abs(dial.z)-.07),7u,dial,0.);
  recordCoated(&list,p,max(abs(length(dial.xy)-1.47)-.085,abs(dial.z-.07)-.045),dial-vec3<f32>(0.,0.,.07),vec3<f32>(1.555,1.555,.045),0.);
  let angle=atan2(dial.y,dial.x);let tick=abs(sin(angle*6.))*length(dial.xy);let ticks=max(max((tick-.045)/6.,1.12-length(dial.xy)),length(dial.xy)-1.34);recordPart(&list,p,max(ticks,abs(dial.z-.1)-.026),8u,dial,0.);
  recordPart(&list,p,segment(dial,vec3<f32>(0.,0.,.13),vec3<f32>(.72,.45,.13),.055),8u,dial,0.);recordPart(&list,p,segment(dial,vec3<f32>(0.,0.,.15),vec3<f32>(-.35,1.03,.15),.035),8u,dial,0.);
  
  let bq=tq-vec3<f32>(0,36.7,0);recordCoated(&list,p,box(vec3<f32>(abs(bq.x)-2.45,bq.y,abs(bq.z)-2.45),vec3<f32>(.38,3.1,.38)),vec3<f32>(abs(bq.x)-2.45,bq.y,abs(bq.z)-2.45),vec3<f32>(.38,3.1,.38),5.);
  for(var j=0;j<2;j++){recordCoated(&list,p,box(tq-vec3<f32>(0,33.6+f32(j)*6.2,0),vec3<f32>(3.1,.27,3.1)),tq-vec3<f32>(0,33.6+f32(j)*6.2,0),vec3<f32>(3.1,.27,3.1),5.);}
  let dome=tq-vec3<f32>(0,39.85,0);recordCoated(&list,p,max(abs(length(dome)-2.63)-.055,-dome.y),dome-vec3<f32>(0.,1.315,0.),vec3<f32>(2.685,1.37,2.685),4.);
  recordPart(&list,p,cyl(tq-vec3<f32>(0,43.1,0),.07,1.1),3u,tq,4.);
 }
 else{recordPart(&list,p,tb,0u,p,0.);}
 
 let shedBox=box(p-vec3<f32>(0,7,SHED_CENTER),vec3<f32>(34,8,SHED_HALF+2.2));
 if(shedBox<2.){
  let xi=clamp(round(p.x/20.),-1.,1.);let x=p.x-xi*20.;let z=rep(p.z-SHED_FRONT,7.5,-SHED_BAYS,0.);let radial=length(vec2<f32>(x,p.y-1.2));let bounded=max(max(abs(x)-10.,abs(p.z-SHED_CENTER)-SHED_HALF),9.-p.y);
  var panel=max(abs(radial-12.8)-.055,bounded);panel=max(panel,.55-abs(x));if(!skipRoof){recordPart(&list,p,panel,15u,vec3<f32>(x,p.y,p.z),55.+xi);}
  for(var j=0;j<2;j++){let r=12.8-f32(j)*.5;recordPart(&list,p,max(max(abs(radial-r)-.08,bounded),abs(z)-.11),3u,p,52.);}
  let a=atan2(x,p.y-1.2);let web=abs(sin(a*16.))*radial;recordPart(&list,p,max(max(max((web-.034)/16.,abs(radial-12.55)-.24),abs(z)-.055),bounded),3u,p,52.);
  let support=rep(p.x-10.,20.,-2.,1.);let cq=vec3<f32>(support,p.y-5.,z);recordPart(&list,p,cyl(cq,.20-.009*cos(atan2(cq.z,cq.x)*12.),4.15),3u,cq,56.);
  recordPart(&list,p,box(vec3<f32>(support,p.y-1.05,z),vec3<f32>(.42,.2,.42)),3u,cq,56.);recordPart(&list,p,cyl(vec3<f32>(support,p.y-8.93,z),.43,.2),3u,cq,56.);
  recordPart(&list,p,box(vec3<f32>(support,p.y-9.25,p.z-SHED_CENTER),vec3<f32>(.13,.17,SHED_HALF)),3u,p,56.);
  
  let pq=vec3<f32>(support,p.y-.35,p.z-SHED_CENTER);if(!skipFloor){recordPart(&list,p,box(pq,vec3<f32>(3.4,.5,SHED_HALF+1.3)),17u,pq,77.);}
  let coping=vec3<f32>(abs(support)-3.23,p.y-.84,rep(p.z,1.2,floor((SHED_BACK-1.3)/1.2),-7.));recordPart(&list,p,box(coping,vec3<f32>(.18,.07,.595)),2u,coping,79.);
  let railX=rep(p.x-5.,10.,-3.,2.);let rail=vec3<f32>(abs(railX)-.7175,p.y-.02,p.z-SHED_CENTER);recordPart(&list,p,box(rail,vec3<f32>(.034,.066,SHED_HALF+2.)),3u,rail,55.);
  recordTimber(&list,p,box(vec3<f32>(railX,p.y+.11,rep(p.z,.65,floor((SHED_BACK-2.)/.65),-13.)),vec3<f32>(1.23,.055,.13)),vec3<f32>(railX,p.y+.11,rep(p.z,.65,floor((SHED_BACK-2.)/.65),-13.)),vec3<f32>(1.23,.055,.13),30.,round(p.z/.65)+round((p.x-5.)/10.)*301.);
  let bz=rep(p.z+13.75,22.5,-5.,0.);let bq=vec3<f32>(support,p.y-1.35,bz);recordTimber(&list,p,box(vec3<f32>(rep(bq.x,.13,-2.,2.),bq.y,bq.z),vec3<f32>(.05,.04,1.7)),vec3<f32>(bq.z,rep(bq.x,.13,-2.,2.),bq.y),vec3<f32>(1.7,.05,.04),38.,round(bq.x/.13)+round((p.z+13.75)/22.5)*17.+round((p.x-10.)/20.)*71.);
  recordTimber(&list,p,box(vec3<f32>(bq.x+.32,rep(bq.y-.5,.13,-2.,2.),bq.z),vec3<f32>(.04,.048,1.7)),vec3<f32>(bq.z,bq.x+.32,rep(bq.y-.5,.13,-2.,2.)),vec3<f32>(1.7,.04,.048),38.,round((bq.y-.5)/.13)+round((p.z+13.75)/22.5)*17.+round((p.x-10.)/20.)*71.+.37);
  let leg=vec3<f32>(bq.x,p.y,abs(bq.z)-1.15);recordPart(&list,p,segment(leg,vec3<f32>(-.27,.86,0.),vec3<f32>(.27,1.32,0.),.028),3u,leg,38.);recordPart(&list,p,segment(leg,vec3<f32>(.27,.86,0.),vec3<f32>(-.27,1.32,0.),.028),3u,leg,38.);recordPart(&list,p,segment(leg,vec3<f32>(-.27,1.25,0.),vec3<f32>(-.35,2.18,0.),.024),3u,leg,38.);
  
  recordPart(&list,p,box(vec3<f32>(support,p.y-3.5,z+.3),vec3<f32>(.78,.31,.035)),9u,p,2.);
  recordPart(&list,p,cyl(vec3<f32>(support+.65,p.y-4.9,z),.025,.5),3u,p,2.);recordPart(&list,p,cyl(vec3<f32>(support+.65,p.y-4.39,z),.20,.065),7u,p,2.);
 }
 else{recordPart(&list,p,shedBox,0u,p,0.);}
 
 if(p.z<SHED_BACK){let x=rep(p.x-5.,10.,-3.,2.);recordPart(&list,p,box(vec3<f32>(abs(x)-.7175,p.y-.02,p.z-(SHED_BACK-38.)),vec3<f32>(.034,.066,38.)),3u,p,55.);recordTimber(&list,p,box(vec3<f32>(x,p.y+.11,rep(p.z,.65,floor((SHED_BACK-76.)/.65),ceil(SHED_BACK/.65))),vec3<f32>(1.23,.055,.13)),vec3<f32>(x,p.y+.11,rep(p.z,.65,floor((SHED_BACK-76.)/.65),ceil(SHED_BACK/.65))),vec3<f32>(1.23,.055,.13),30.,round(p.z/.65)+round((p.x-5.)/10.)*301.);}
 
 
 let gq=p-vec3<f32>(GOODS_X,0.,GOODS_CENTER);let gb=box(gq-vec3<f32>(0.,3.,0.),vec3<f32>(7.,3.8,GOODS_HALF+1.));
 if(gb<2.){
  if(!skipFloor){recordPart(&list,p,box(gq-vec3<f32>(1.7,.30,0.),vec3<f32>(4.7,.55,GOODS_HALF+.6)),17u,gq,77.);}
  let zz=rep(gq.z,7.,-6.,6.);let sideq=vec3<f32>(abs(gq.x)-3.,p.y-3.,zz);
  recordPart(&list,p,box(sideq,vec3<f32>(.23,2.15,.40)),12u,sideq,91.);
  recordPart(&list,p,box(gq-vec3<f32>(0.,3.,0.),vec3<f32>(.15,2.15,GOODS_HALF)),12u,gq,92.);
  let lintel=vec3<f32>(abs(gq.x)-3.,p.y-5.25,gq.z);recordCoated(&list,p,box(lintel,vec3<f32>(.31,.15,GOODS_HALF)),lintel,vec3<f32>(.31,.15,GOODS_HALF),93.);
  let roof=abs(p.y-(6.3-abs(gq.x)*.31))-.065;recordPart(&list,p,max(roof,max(abs(gq.x)-3.65,abs(gq.z)-GOODS_HALF-.6)),3u,gq,94.);
  recordPart(&list,p,segment(vec3<f32>(gq.x,p.y,zz),vec3<f32>(-3.,5.1,0.),vec3<f32>(3.,5.1,0.),.045),3u,gq,94.);
  recordPart(&list,p,segment(vec3<f32>(gq.x,p.y,zz),vec3<f32>(-3.,5.1,0.),vec3<f32>(0.,6.15,0.),.035),3u,gq,94.);
  recordPart(&list,p,segment(vec3<f32>(gq.x,p.y,zz),vec3<f32>(3.,5.1,0.),vec3<f32>(0.,6.15,0.),.035),3u,gq,94.);
 }else{recordPart(&list,p,gb,0u,p,0.);}
 
 let sx=p.x-50.;let sq=vec3<f32>(abs(sx)-.7175,p.y-.02,p.z+91.);recordPart(&list,p,box(sq,vec3<f32>(.034,.066,79.)),3u,sq,55.);
 let sleeper=vec3<f32>(sx,p.y+.11,rep(p.z,.65,-261.,-19.));recordTimber(&list,p,box(sleeper,vec3<f32>(1.23,.055,.13)),sleeper,vec3<f32>(1.23,.055,.13),30.,round(p.z/.65)+810.);
 
 let walk=p-vec3<f32>(49.,0.,13.);let wb=box(walk-vec3<f32>(0.,2.5,0.),vec3<f32>(18.5,2.6,2.2));
 if(wb<2.){
  if(!skipFloor){recordPart(&list,p,box(walk-vec3<f32>(0.,.3,0.),vec3<f32>(18.,.55,1.8)),17u,walk,77.);}
  let post=vec3<f32>(rep(walk.x,6.,-3.,3.),p.y-2.55,abs(walk.z)-1.65);recordPart(&list,p,cyl(post,.07,1.7),3u,post,96.);
  let wr=abs(p.y-(4.7-abs(walk.z)*.13))-.045;recordPart(&list,p,max(wr,max(abs(walk.x)-18.3,abs(walk.z)-1.95)),3u,walk,96.);
  recordPart(&list,p,box(vec3<f32>(walk.x,p.y-4.35,abs(walk.z)-1.65),vec3<f32>(18.3,.085,.06)),3u,walk,96.);
 }else{recordPart(&list,p,wb,0u,p,0.);}
 
 let quay=p-vec3<f32>(SHORE_X-1.2,-.65,-74.5);recordPart(&list,p,box(quay,vec3<f32>(1.2,.43,100.5)),2u,quay,82.);
 for(var ri=0;ri<2;ri++){let rx=select(-58.,-43.,ri==1);let curb=p-vec3<f32>(rx,-.18,-74.5);recordPart(&list,p,box(curb,vec3<f32>(.12,.16,100.5)),2u,curb,82.);}


 return resolveCandidates(&list,p);
}
fn stationField(p:vec3<f32>)->HitField{return stationDomain(p,false,false);}
fn resolveStationState(p:vec3<f32>)->StationState{let repair=repairAt(p);return StationState(u.age,stateWet(p),repair,u.age*(1.-repair));}
fn stationWoodParams(h:HitField,st:StationState)->KpWoodParams{var wp=kpWoodDefaultParams();if(h.seed==38.||h.seed==39.){wp.textureScale=BENCH_WOOD_SCALE;wp.grainContrast=BENCH_WOOD_CONTRAST;}wp.seed=fract(wp.seed+h.sourceSeed*.61803398875);wp.reliefScale*=.35+.85*st.retained;wp.roughness=clamp(wp.roughness+.07*st.retained-.12*st.repair,.2,.98);wp.agedSurfaceColor=mix(wp.freshCutColor,wp.agedSurfaceColor,.4+.6*st.retained);wp.clearcoat=.12*st.repair;return wp;}
fn stationWoodClass(h:HitField)->f32{let face=abs(h.q)-h.extent;return select(0.,1.,face.x>=max(face.y,face.z));}
fn stationStoneHeight(qM:vec3<f32>)->f32{let pos=qM/KP_STONE_SCALE_M;let seed=st_seedVector(KP_STONE_COLOR_SEED,.071);let q=st_warp(pos,seed);let broad=st_sf(q*1.35+seed);let region=st_sf(q*3.2+seed+vec3<f32>(11.));let vein=(1.-smoothstep(.028,.072,st_line(q,seed)))*smoothstep(.34,.63,region);let pits=pow(max(0.,(st_sf(q*19.+st_seedVector(KP_STONE_PORE_SEED,.061))-.57)/.43),2.);return ((broad-.5)*.018+(region-.5)*.007+vein*.004-pits*.025)*KP_STONE_SCALE_M;}
fn stationConcreteHeight(p:vec3<f32>,age:f32)->f32{let q=p+vec3<f32>(19.,19.*.71,19.*.37);let meso=mt_kn(q*3.7);let fine=mt_kn(q*127.);let chip=smoothstep(.64,.81,mt_kn(q*23.))*smoothstep(.46,.76,meso)*age;return(fine-.5)*.00042-chip*.0007;}
fn stationCoatingThickness(h:HitField,p:vec3<f32>,st:StationState)->f32{let a=stationPlasterParams(h.extent);let macroSignal=kpPlasterMacro(h.q,a);let sourceThickness=clamp(a.thicknessM+a.reliefM*macroSignal,a.minThicknessM,a.maxThicknessM);let exposure=clamp(st.wet*2.8+(1.-smoothstep(.2,1.8,p.y))*.18,0.,1.);let decay=clamp(st.retained*exposure,0.,1.);let defect=macroSignal*.5+.5;let coverage=smoothstep(decay*.9-.03,decay*.9+.04,defect);return sourceThickness*coverage;}
fn stationMetalCoordinates(h:HitField,p:vec3<f32>)->vec3<f32>{let rail=h.id==3u&&h.seed==55.;return vec3<f32>(h.q.x,select(p.y,p.y+.984,rail),h.q.z);}
fn isStationRoof(h:HitField)->bool{return h.id==15u||(h.id==3u&&(h.seed==8.||h.seed==94.||h.seed==96.));}
fn stationRoofPaintCoverage(h:HitField,p:vec3<f32>,st:StationState)->f32{return 1.-kpMetalCorrosion(stationMetalCoordinates(h,p),st.age,st.wet,st.repair)*.8;}
fn evaluateStationGeometry(h:HitField,p:vec3<f32>,st:StationState)->StationGeometry{
 var g=StationGeometry(h.d,0.,0.);
 if(h.id==1u||h.id==12u){let q=brickQ(p,h.id,h.d);let seed=19.+floor(p.y/.073)*13.+floor((p.x+p.z)/.25);let variant=i32(abs(seed))%4;let native=kpBrickBaseDistance(q,seed,variant,.42);let macroSignal=native-kpBrickAnalyticBoundDistance(q);g.loss=clamp(st.retained*st.wet*(.0004+max(0.,macroSignal)*.6),0.,.0016);g.d=min(h.d+.006,native+g.loss);}
 if(h.id==2u){g.d=h.d-clamp(stationStoneHeight(h.q*.19)*(.25+.75*st.retained),-.004,.004);}
 if(h.id==3u||h.id==15u){g.loss=kpMetalCorrosion(stationMetalCoordinates(h,p),st.age,st.wet,st.repair)*.0008;g.d=h.d+g.loss;if(isStationRoof(h)){g.thickness=.00006*stationRoofPaintCoverage(h,p,st);g.d-=g.thickness;}}
 if(h.id==4u){g.d=h.d-kpWoodMacroDisplacement(h.q,stationWoodClass(h),stationWoodParams(h,st));}
 if(h.id==17u){g.d=h.d-stationConcreteHeight(h.q,st.retained);}
 if(h.id==13u){g.thickness=stationCoatingThickness(h,p,st);g.d=h.d-clamp(stationStoneHeight(h.q*.19)*.25,-.001,.001)-g.thickness;}
 return g;
}
@fragment fn geometryProbe(@builtin(position) pixel:vec4<f32>)->@location(0)vec4<f32>{let i=u32(pixel.x);let family=i/32u;let cell=f32(i%32u);var p=vec3<f32>(cell*.2-3.2,6.95,8.35);if(family==1u){p=vec3<f32>(27.72,cell*1.3+.85,4.);}if(family==2u){p=vec3<f32>(10.,.848+cell*.0001,-35.);}if(family==3u){p=vec3<f32>(10.199,1.+cell*.24,-32.5);}if(family==4u){p=vec3<f32>(9.72,1.4+cell*.024,-36.);}if(family==5u){p=vec3<f32>(GOODS_X+3.,1.+cell*.16,GOODS_CENTER);}let h=stationField(p);return vec4<f32>(h.d,f32(h.id),h.baseD,h.sourceSeed);}
