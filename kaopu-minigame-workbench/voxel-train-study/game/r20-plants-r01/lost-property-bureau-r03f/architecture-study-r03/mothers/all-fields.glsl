// R3.12 family-0 original fitted edge waves, field and surface core.
// WGSL syntax/explicit arguments are new. No renderer, vertex or instance lists.
const float KP_BRICK_PI=3.14159265359;
const float KP_BRICK_SCALE=0.1153846154;
struct KpSurface { float height; vec3 albedo; float roughness; };
float br_h11(float p){return fract(sin(p*127.1+311.7)*43758.5453123);}
float br_hash31(vec3 pIn){vec3 p=fract(pIn*0.1031);p+=vec3(dot(p,p.yzx+vec3(33.33)));return fract((p.x+p.y)*p.z);}
float br_noise3(vec3 p){vec3 i=floor(p);vec3 f=fract(p);f=f*f*(vec3(3.0)-2.0*f);return mix(mix(mix(br_hash31(i),br_hash31(i+vec3(1,0,0)),f.x),mix(br_hash31(i+vec3(0,1,0)),br_hash31(i+vec3(1,1,0)),f.x),f.y),mix(mix(br_hash31(i+vec3(0,0,1)),br_hash31(i+vec3(1,0,1)),f.x),mix(br_hash31(i+vec3(0,1,1)),br_hash31(i+vec3(1,1,1)),f.x),f.y),f.z);}
float br_fbm(vec3 pIn){vec3 p=pIn;float s=0.0;float a=0.5;for(int i=0;i<5;i++){s+=a*br_noise3(p);p=p*2.03+vec3(7.1,-3.7,11.9);a*=0.5;}return s;}
float br_roundBox(vec3 p,vec3 b,float r){vec3 q=abs(p)-b+vec3(r);return length(max(q,vec3(0.0)))+min(max(q.x,max(q.y,q.z)),0.0)-r;}
float br_mid_x_m_m(float tIn){ float t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.01800174*cos(3.0*KP_BRICK_PI*t)+0.00862492*sin(3.0*KP_BRICK_PI*t)-0.00032245*cos(4.0*KP_BRICK_PI*t)-0.00199262*sin(4.0*KP_BRICK_PI*t); }
float br_high_x_m_m(float tIn){ float t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.01471101*cos(5.0*KP_BRICK_PI*t)-0.00611511*sin(5.0*KP_BRICK_PI*t)+0.00505069*cos(6.0*KP_BRICK_PI*t)-0.01129023*sin(6.0*KP_BRICK_PI*t)+0.00016204*cos(7.0*KP_BRICK_PI*t)-0.00678541*sin(7.0*KP_BRICK_PI*t)+0.00910669*cos(8.0*KP_BRICK_PI*t)-0.00372102*sin(8.0*KP_BRICK_PI*t)+0.00386620*cos(9.0*KP_BRICK_PI*t)+0.00169141*sin(9.0*KP_BRICK_PI*t)+0.00255569*cos(10.0*KP_BRICK_PI*t)+0.00429621*sin(10.0*KP_BRICK_PI*t)-0.00149008*cos(11.0*KP_BRICK_PI*t)+0.00421699*sin(11.0*KP_BRICK_PI*t)-0.00482651*cos(12.0*KP_BRICK_PI*t)+0.00371242*sin(12.0*KP_BRICK_PI*t)-0.00518212*cos(13.0*KP_BRICK_PI*t)-0.00028101*sin(13.0*KP_BRICK_PI*t)-0.00483069*cos(14.0*KP_BRICK_PI*t)-0.00165143*sin(14.0*KP_BRICK_PI*t)-0.00203463*cos(15.0*KP_BRICK_PI*t)-0.00399068*sin(15.0*KP_BRICK_PI*t)+0.00089974*cos(16.0*KP_BRICK_PI*t)-0.00264073*sin(16.0*KP_BRICK_PI*t); }
float br_mid_x_m_p(float tIn){ float t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.01135424*cos(3.0*KP_BRICK_PI*t)-0.00403594*sin(3.0*KP_BRICK_PI*t)+0.01141619*cos(4.0*KP_BRICK_PI*t)-0.00155239*sin(4.0*KP_BRICK_PI*t); }
float br_high_x_m_p(float tIn){ float t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.01111828*cos(5.0*KP_BRICK_PI*t)-0.00524976*sin(5.0*KP_BRICK_PI*t)+0.00926048*cos(6.0*KP_BRICK_PI*t)-0.00196252*sin(6.0*KP_BRICK_PI*t)-0.01080133*cos(7.0*KP_BRICK_PI*t)-0.00236667*sin(7.0*KP_BRICK_PI*t)+0.00682428*cos(8.0*KP_BRICK_PI*t)+0.00034784*sin(8.0*KP_BRICK_PI*t)-0.00988528*cos(9.0*KP_BRICK_PI*t)-0.00067851*sin(9.0*KP_BRICK_PI*t)+0.00392564*cos(10.0*KP_BRICK_PI*t)+0.00248324*sin(10.0*KP_BRICK_PI*t)-0.00639717*cos(11.0*KP_BRICK_PI*t)-0.00103361*sin(11.0*KP_BRICK_PI*t)+0.00224399*cos(12.0*KP_BRICK_PI*t)+0.00279355*sin(12.0*KP_BRICK_PI*t)-0.00234379*cos(13.0*KP_BRICK_PI*t)-0.00034023*sin(13.0*KP_BRICK_PI*t)+0.00154531*cos(14.0*KP_BRICK_PI*t)+0.00135488*sin(14.0*KP_BRICK_PI*t)-0.00041372*cos(15.0*KP_BRICK_PI*t)+0.00081121*sin(15.0*KP_BRICK_PI*t)+0.00176690*cos(16.0*KP_BRICK_PI*t)-0.00017177*sin(16.0*KP_BRICK_PI*t); }
float br_mid_x_p_m(float tIn){ float t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.01106844*cos(3.0*KP_BRICK_PI*t)+0.00366009*sin(3.0*KP_BRICK_PI*t)+0.00491573*cos(4.0*KP_BRICK_PI*t)-0.00304459*sin(4.0*KP_BRICK_PI*t); }
float br_high_x_p_m(float tIn){ float t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.00968863*cos(5.0*KP_BRICK_PI*t)+0.00804842*sin(5.0*KP_BRICK_PI*t)-0.00023933*cos(6.0*KP_BRICK_PI*t)-0.00159630*sin(6.0*KP_BRICK_PI*t)-0.00533428*cos(7.0*KP_BRICK_PI*t)+0.00562751*sin(7.0*KP_BRICK_PI*t)-0.00301718*cos(8.0*KP_BRICK_PI*t)-0.00124667*sin(8.0*KP_BRICK_PI*t)-0.00068517*cos(9.0*KP_BRICK_PI*t)+0.00175252*sin(9.0*KP_BRICK_PI*t)-0.00175606*cos(10.0*KP_BRICK_PI*t)-0.00053161*sin(10.0*KP_BRICK_PI*t)+0.00314901*cos(11.0*KP_BRICK_PI*t)-0.00221809*sin(11.0*KP_BRICK_PI*t)-0.00002768*cos(12.0*KP_BRICK_PI*t)-0.00050747*sin(12.0*KP_BRICK_PI*t)+0.00322590*cos(13.0*KP_BRICK_PI*t)-0.00372527*sin(13.0*KP_BRICK_PI*t)+0.00009642*cos(14.0*KP_BRICK_PI*t)+0.00051161*sin(14.0*KP_BRICK_PI*t)+0.00137602*cos(15.0*KP_BRICK_PI*t)-0.00204386*sin(15.0*KP_BRICK_PI*t)-0.00040926*cos(16.0*KP_BRICK_PI*t)+0.00184796*sin(16.0*KP_BRICK_PI*t); }
float br_mid_x_p_p(float tIn){ float t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.01568166*cos(3.0*KP_BRICK_PI*t)-0.00042124*sin(3.0*KP_BRICK_PI*t)+0.00873786*cos(4.0*KP_BRICK_PI*t)+0.00638691*sin(4.0*KP_BRICK_PI*t); }
float br_high_x_p_p(float tIn){ float t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.01295239*cos(5.0*KP_BRICK_PI*t)-0.00380655*sin(5.0*KP_BRICK_PI*t)+0.00244597*cos(6.0*KP_BRICK_PI*t)+0.00179228*sin(6.0*KP_BRICK_PI*t)-0.00822504*cos(7.0*KP_BRICK_PI*t)-0.00912719*sin(7.0*KP_BRICK_PI*t)+0.00818194*cos(8.0*KP_BRICK_PI*t)-0.00226580*sin(8.0*KP_BRICK_PI*t)+0.00200288*cos(9.0*KP_BRICK_PI*t)-0.00217961*sin(9.0*KP_BRICK_PI*t)+0.00524195*cos(10.0*KP_BRICK_PI*t)+0.00335884*sin(10.0*KP_BRICK_PI*t)-0.00236021*cos(11.0*KP_BRICK_PI*t)+0.00141195*sin(11.0*KP_BRICK_PI*t)+0.00291234*cos(12.0*KP_BRICK_PI*t)+0.00156187*sin(12.0*KP_BRICK_PI*t)-0.00192814*cos(13.0*KP_BRICK_PI*t)+0.00280991*sin(13.0*KP_BRICK_PI*t)-0.00040794*cos(14.0*KP_BRICK_PI*t)+0.00126868*sin(14.0*KP_BRICK_PI*t)-0.00433065*cos(15.0*KP_BRICK_PI*t)-0.00021126*sin(15.0*KP_BRICK_PI*t)+0.00012984*cos(16.0*KP_BRICK_PI*t)-0.00208270*sin(16.0*KP_BRICK_PI*t); }
float br_mid_y_m_m(float tIn){ float t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.00630336*cos(3.0*KP_BRICK_PI*t)+0.00827031*sin(3.0*KP_BRICK_PI*t)+0.00566717*cos(4.0*KP_BRICK_PI*t)+0.00042867*sin(4.0*KP_BRICK_PI*t); }
float br_high_y_m_m(float tIn){ float t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.00616945*cos(5.0*KP_BRICK_PI*t)+0.00614401*sin(5.0*KP_BRICK_PI*t)+0.00276823*cos(6.0*KP_BRICK_PI*t)-0.00324009*sin(6.0*KP_BRICK_PI*t)-0.00277462*cos(7.0*KP_BRICK_PI*t)+0.00419118*sin(7.0*KP_BRICK_PI*t)+0.00129222*cos(8.0*KP_BRICK_PI*t)-0.00251670*sin(8.0*KP_BRICK_PI*t)-0.00017492*cos(9.0*KP_BRICK_PI*t)+0.00320414*sin(9.0*KP_BRICK_PI*t)-0.00060079*cos(10.0*KP_BRICK_PI*t)-0.00079424*sin(10.0*KP_BRICK_PI*t)+0.00099889*cos(11.0*KP_BRICK_PI*t)+0.00100195*sin(11.0*KP_BRICK_PI*t)-0.00147204*cos(12.0*KP_BRICK_PI*t)+0.00019719*sin(12.0*KP_BRICK_PI*t)+0.00147029*cos(13.0*KP_BRICK_PI*t)-0.00057325*sin(13.0*KP_BRICK_PI*t)-0.00105959*cos(14.0*KP_BRICK_PI*t)+0.00146526*sin(14.0*KP_BRICK_PI*t)+0.00110262*cos(15.0*KP_BRICK_PI*t)-0.00092602*sin(15.0*KP_BRICK_PI*t)-0.00024836*cos(16.0*KP_BRICK_PI*t)+0.00177536*sin(16.0*KP_BRICK_PI*t); }
float br_mid_y_m_p(float tIn){ float t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.00456362*cos(3.0*KP_BRICK_PI*t)+0.00232485*sin(3.0*KP_BRICK_PI*t)+0.00364059*cos(4.0*KP_BRICK_PI*t)-0.00296393*sin(4.0*KP_BRICK_PI*t); }
float br_high_y_m_p(float tIn){ float t=tIn; t=clamp(t,-0.95,0.95);return 0.0+0.00058035*cos(5.0*KP_BRICK_PI*t)+0.00351213*sin(5.0*KP_BRICK_PI*t)-0.00311119*cos(6.0*KP_BRICK_PI*t)-0.00082560*sin(6.0*KP_BRICK_PI*t)+0.00447520*cos(7.0*KP_BRICK_PI*t)-0.00080438*sin(7.0*KP_BRICK_PI*t)-0.00625696*cos(8.0*KP_BRICK_PI*t)+0.00100661*sin(8.0*KP_BRICK_PI*t)+0.00468255*cos(9.0*KP_BRICK_PI*t)-0.00231942*sin(9.0*KP_BRICK_PI*t)-0.00397357*cos(10.0*KP_BRICK_PI*t)+0.00223223*sin(10.0*KP_BRICK_PI*t)+0.00344591*cos(11.0*KP_BRICK_PI*t)-0.00145876*sin(11.0*KP_BRICK_PI*t)-0.00081874*cos(12.0*KP_BRICK_PI*t)+0.00036113*sin(12.0*KP_BRICK_PI*t)+0.00095928*cos(13.0*KP_BRICK_PI*t)+0.00022236*sin(13.0*KP_BRICK_PI*t)+0.00016248*cos(14.0*KP_BRICK_PI*t)-0.00163296*sin(14.0*KP_BRICK_PI*t)-0.00041686*cos(15.0*KP_BRICK_PI*t)+0.00173083*sin(15.0*KP_BRICK_PI*t)+0.00042056*cos(16.0*KP_BRICK_PI*t)-0.00171078*sin(16.0*KP_BRICK_PI*t); }
float br_mid_y_p_m(float tIn){ float t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.00568083*cos(3.0*KP_BRICK_PI*t)+0.00059518*sin(3.0*KP_BRICK_PI*t)+0.00165756*cos(4.0*KP_BRICK_PI*t)-0.00265243*sin(4.0*KP_BRICK_PI*t); }
float br_high_y_p_m(float tIn){ float t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.00237719*cos(5.0*KP_BRICK_PI*t)+0.00155711*sin(5.0*KP_BRICK_PI*t)-0.00174800*cos(6.0*KP_BRICK_PI*t)-0.00034580*sin(6.0*KP_BRICK_PI*t)+0.00109223*cos(7.0*KP_BRICK_PI*t)-0.00076205*sin(7.0*KP_BRICK_PI*t)-0.00183915*cos(8.0*KP_BRICK_PI*t)+0.00169373*sin(8.0*KP_BRICK_PI*t)+0.00166788*cos(9.0*KP_BRICK_PI*t)-0.00197430*sin(9.0*KP_BRICK_PI*t)+0.00023726*cos(10.0*KP_BRICK_PI*t)+0.00209990*sin(10.0*KP_BRICK_PI*t)-0.00013690*cos(11.0*KP_BRICK_PI*t)-0.00204928*sin(11.0*KP_BRICK_PI*t)+0.00149101*cos(12.0*KP_BRICK_PI*t)+0.00080592*sin(12.0*KP_BRICK_PI*t)-0.00168845*cos(13.0*KP_BRICK_PI*t)-0.00052462*sin(13.0*KP_BRICK_PI*t)+0.00199706*cos(14.0*KP_BRICK_PI*t)-0.00016703*sin(14.0*KP_BRICK_PI*t)-0.00114543*cos(15.0*KP_BRICK_PI*t)+0.00067098*sin(15.0*KP_BRICK_PI*t)+0.00132124*cos(16.0*KP_BRICK_PI*t)-0.00060376*sin(16.0*KP_BRICK_PI*t); }
float br_mid_y_p_p(float tIn){ float t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.01472244*cos(3.0*KP_BRICK_PI*t)+0.00196068*sin(3.0*KP_BRICK_PI*t)+0.00837774*cos(4.0*KP_BRICK_PI*t)-0.00049031*sin(4.0*KP_BRICK_PI*t); }
float br_high_y_p_p(float tIn){ float t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.00814206*cos(5.0*KP_BRICK_PI*t)-0.00053856*sin(5.0*KP_BRICK_PI*t)+0.00257906*cos(6.0*KP_BRICK_PI*t)-0.00127762*sin(6.0*KP_BRICK_PI*t)-0.00086120*cos(7.0*KP_BRICK_PI*t)+0.00165010*sin(7.0*KP_BRICK_PI*t)-0.00324482*cos(8.0*KP_BRICK_PI*t)-0.00230772*sin(8.0*KP_BRICK_PI*t)+0.00531309*cos(9.0*KP_BRICK_PI*t)+0.00285670*sin(9.0*KP_BRICK_PI*t)-0.00601731*cos(10.0*KP_BRICK_PI*t)-0.00308967*sin(10.0*KP_BRICK_PI*t)+0.00756770*cos(11.0*KP_BRICK_PI*t)+0.00401337*sin(11.0*KP_BRICK_PI*t)-0.00704240*cos(12.0*KP_BRICK_PI*t)-0.00363779*sin(12.0*KP_BRICK_PI*t)+0.00672339*cos(13.0*KP_BRICK_PI*t)+0.00366736*sin(13.0*KP_BRICK_PI*t)-0.00539581*cos(14.0*KP_BRICK_PI*t)-0.00292112*sin(14.0*KP_BRICK_PI*t)+0.00379057*cos(15.0*KP_BRICK_PI*t)+0.00280410*sin(15.0*KP_BRICK_PI*t)-0.00302659*cos(16.0*KP_BRICK_PI*t)-0.00189233*sin(16.0*KP_BRICK_PI*t); }
float br_mid_z_m_m(float tIn){ float t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.03445430*cos(3.0*KP_BRICK_PI*t)-0.00282014*sin(3.0*KP_BRICK_PI*t)+0.03501842*cos(4.0*KP_BRICK_PI*t)+0.00267835*sin(4.0*KP_BRICK_PI*t); }
float br_high_z_m_m(float tIn){ float t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.03134970*cos(5.0*KP_BRICK_PI*t)-0.00507503*sin(5.0*KP_BRICK_PI*t)+0.02759835*cos(6.0*KP_BRICK_PI*t)+0.00467492*sin(6.0*KP_BRICK_PI*t)-0.02453092*cos(7.0*KP_BRICK_PI*t)-0.00547356*sin(7.0*KP_BRICK_PI*t)+0.02023931*cos(8.0*KP_BRICK_PI*t)+0.00660731*sin(8.0*KP_BRICK_PI*t)-0.01699690*cos(9.0*KP_BRICK_PI*t)-0.00634397*sin(9.0*KP_BRICK_PI*t)+0.01361088*cos(10.0*KP_BRICK_PI*t)+0.00712487*sin(10.0*KP_BRICK_PI*t)-0.01008559*cos(11.0*KP_BRICK_PI*t)-0.00675053*sin(11.0*KP_BRICK_PI*t)+0.00780155*cos(12.0*KP_BRICK_PI*t)+0.00722028*sin(12.0*KP_BRICK_PI*t)-0.00529194*cos(13.0*KP_BRICK_PI*t)-0.00638835*sin(13.0*KP_BRICK_PI*t)+0.00336004*cos(14.0*KP_BRICK_PI*t)+0.00624403*sin(14.0*KP_BRICK_PI*t)-0.00209103*cos(15.0*KP_BRICK_PI*t)-0.00553015*sin(15.0*KP_BRICK_PI*t)+0.00084286*cos(16.0*KP_BRICK_PI*t)+0.00479951*sin(16.0*KP_BRICK_PI*t); }
float br_mid_z_m_p(float tIn){ float t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.01307475*cos(3.0*KP_BRICK_PI*t)+0.00450446*sin(3.0*KP_BRICK_PI*t)+0.00682105*cos(4.0*KP_BRICK_PI*t)+0.00639899*sin(4.0*KP_BRICK_PI*t); }
float br_high_z_m_p(float tIn){ float t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.00571077*cos(5.0*KP_BRICK_PI*t)+0.00346485*sin(5.0*KP_BRICK_PI*t)+0.00609629*cos(6.0*KP_BRICK_PI*t)+0.00059963*sin(6.0*KP_BRICK_PI*t)-0.00710636*cos(7.0*KP_BRICK_PI*t)-0.00381479*sin(7.0*KP_BRICK_PI*t)+0.00135812*cos(8.0*KP_BRICK_PI*t)+0.00135282*sin(8.0*KP_BRICK_PI*t)-0.00506045*cos(9.0*KP_BRICK_PI*t)-0.00360239*sin(9.0*KP_BRICK_PI*t)+0.00308686*cos(10.0*KP_BRICK_PI*t)+0.00261325*sin(10.0*KP_BRICK_PI*t)-0.00270687*cos(11.0*KP_BRICK_PI*t)-0.00449361*sin(11.0*KP_BRICK_PI*t)+0.00262569*cos(12.0*KP_BRICK_PI*t)+0.00311502*sin(12.0*KP_BRICK_PI*t)-0.00162438*cos(13.0*KP_BRICK_PI*t)-0.00306571*sin(13.0*KP_BRICK_PI*t)+0.00251715*cos(14.0*KP_BRICK_PI*t)+0.00290793*sin(14.0*KP_BRICK_PI*t)-0.00087650*cos(15.0*KP_BRICK_PI*t)-0.00290014*sin(15.0*KP_BRICK_PI*t)+0.00095675*cos(16.0*KP_BRICK_PI*t)+0.00161494*sin(16.0*KP_BRICK_PI*t); }
float br_mid_z_p_m(float tIn){ float t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.00543148*cos(3.0*KP_BRICK_PI*t)-0.01245624*sin(3.0*KP_BRICK_PI*t)+0.01205722*cos(4.0*KP_BRICK_PI*t)+0.00758454*sin(4.0*KP_BRICK_PI*t); }
float br_high_z_p_m(float tIn){ float t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.01318042*cos(5.0*KP_BRICK_PI*t)-0.01120445*sin(5.0*KP_BRICK_PI*t)+0.00622728*cos(6.0*KP_BRICK_PI*t)+0.00643460*sin(6.0*KP_BRICK_PI*t)-0.00641567*cos(7.0*KP_BRICK_PI*t)-0.00656035*sin(7.0*KP_BRICK_PI*t)+0.00075536*cos(8.0*KP_BRICK_PI*t)+0.00936163*sin(8.0*KP_BRICK_PI*t)-0.00227068*cos(9.0*KP_BRICK_PI*t)-0.00692473*sin(9.0*KP_BRICK_PI*t)+0.00018661*cos(10.0*KP_BRICK_PI*t)+0.00740915*sin(10.0*KP_BRICK_PI*t)-0.00009489*cos(11.0*KP_BRICK_PI*t)-0.00591066*sin(11.0*KP_BRICK_PI*t)-0.00047542*cos(12.0*KP_BRICK_PI*t)+0.00438750*sin(12.0*KP_BRICK_PI*t)+0.00034270*cos(13.0*KP_BRICK_PI*t)-0.00324690*sin(13.0*KP_BRICK_PI*t)-0.00151968*cos(14.0*KP_BRICK_PI*t)+0.00176894*sin(14.0*KP_BRICK_PI*t)+0.00166849*cos(15.0*KP_BRICK_PI*t)-0.00123680*sin(15.0*KP_BRICK_PI*t)-0.00146369*cos(16.0*KP_BRICK_PI*t)+0.00149355*sin(16.0*KP_BRICK_PI*t); }
float br_mid_z_p_p(float tIn){ float t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.00388179*cos(3.0*KP_BRICK_PI*t)+0.00390139*sin(3.0*KP_BRICK_PI*t)+0.00238573*cos(4.0*KP_BRICK_PI*t)-0.00329681*sin(4.0*KP_BRICK_PI*t); }
float br_high_z_p_p(float tIn){ float t=tIn; t=clamp(t,-0.95,0.95);return 0.0-0.00010459*cos(5.0*KP_BRICK_PI*t)+0.00147038*sin(5.0*KP_BRICK_PI*t)+0.00066299*cos(6.0*KP_BRICK_PI*t)-0.00479755*sin(6.0*KP_BRICK_PI*t)+0.00106469*cos(7.0*KP_BRICK_PI*t)+0.00323743*sin(7.0*KP_BRICK_PI*t)-0.00034190*cos(8.0*KP_BRICK_PI*t)-0.00098051*sin(8.0*KP_BRICK_PI*t)+0.00303712*cos(9.0*KP_BRICK_PI*t)+0.00124931*sin(9.0*KP_BRICK_PI*t)-0.00262919*cos(10.0*KP_BRICK_PI*t)-0.00150538*sin(10.0*KP_BRICK_PI*t)+0.00194169*cos(11.0*KP_BRICK_PI*t)-0.00037848*sin(11.0*KP_BRICK_PI*t)-0.00197504*cos(12.0*KP_BRICK_PI*t)+0.00095933*sin(12.0*KP_BRICK_PI*t)+0.00272261*cos(13.0*KP_BRICK_PI*t)-0.00108356*sin(13.0*KP_BRICK_PI*t)-0.00067581*cos(14.0*KP_BRICK_PI*t)+0.00082625*sin(14.0*KP_BRICK_PI*t)+0.00043735*cos(15.0*KP_BRICK_PI*t)-0.00193681*sin(15.0*KP_BRICK_PI*t)-0.00039229*cos(16.0*KP_BRICK_PI*t)+0.00197941*sin(16.0*KP_BRICK_PI*t); }
float br_midX(float t,float sy,float sz){if(sy<0.0){if(sz<0.0){return br_mid_x_m_m(t);}return br_mid_x_m_p(t);}if(sz<0.0){return br_mid_x_p_m(t);}return br_mid_x_p_p(t);}
float br_midY(float t,float sx,float sz){if(sx<0.0){if(sz<0.0){return br_mid_y_m_m(t);}return br_mid_y_m_p(t);}if(sz<0.0){return br_mid_y_p_m(t);}return br_mid_y_p_p(t);}
float br_midZ(float t,float sx,float sy){if(sx<0.0){if(sy<0.0){return br_mid_z_m_m(t);}return br_mid_z_m_p(t);}if(sy<0.0){return br_mid_z_p_m(t);}return br_mid_z_p_p(t);}
float br_highX(float t,float sy,float sz){if(sy<0.0){if(sz<0.0){return br_high_x_m_m(t);}return br_high_x_m_p(t);}if(sz<0.0){return br_high_x_p_m(t);}return br_high_x_p_p(t);}
float br_highY(float t,float sx,float sz){if(sx<0.0){if(sz<0.0){return br_high_y_m_m(t);}return br_high_y_m_p(t);}if(sz<0.0){return br_high_y_p_m(t);}return br_high_y_p_p(t);}
float br_highZ(float t,float sx,float sy){if(sx<0.0){if(sy<0.0){return br_high_z_m_m(t);}return br_high_z_m_p(t);}if(sy<0.0){return br_high_z_p_m(t);}return br_high_z_p_p(t);}

float br_nf(float c,float h,float s,float band){return smoothstep(h-band,h+0.003,s*c);}
float br_chipWear(float vIn){float v=max(vIn-0.0018,0.0);return 0.020*tanh(v/0.020)*smoothstep(0.0010,0.0060,v);}
float br_contour(float v){return 0.0048*tanh(v/0.030);}
float br_contourLong(float v){float s=br_contour(v);if(s>=-0.0022){return s;}return -0.0022+0.00045*tanh((s+0.0022)/0.00045);}
float br_mx(vec3 q,vec3 b,float sy,float sz){return br_nf(q.y,b.y,sy,0.042)*br_nf(q.z,b.z,sz,0.054);}
float br_my(vec3 q,vec3 b,float sx,float sz){return br_nf(q.x,b.x,sx,0.062)*br_nf(q.z,b.z,sz,0.054);}
float br_mz(vec3 q,vec3 b,float sx,float sy){return br_nf(q.x,b.x,sx,0.062)*br_nf(q.y,b.y,sy,0.042);}
float br_ck(vec3 q,vec3 b,float sx,float sy,float sz){return br_nf(q.x,b.x,sx,0.080)*br_nf(q.y,b.y,sy,0.052)*br_nf(q.z,b.z,sz,0.064);}
// Return original [chips, contour, weight] contributions instead of GLSL inout.
vec3 br_ax(vec3 q,vec3 b,float sy,float sz){float m=br_mx(q,b,sy,sz);float t=q.x/b.x;float md=br_midX(t,sy,sz);return vec3(br_chipWear(md+br_highX(t,sy,sz))*m,br_contourLong(md)*m,m);}
vec3 br_ay(vec3 q,vec3 b,float sx,float sz){float m=br_my(q,b,sx,sz);float t=q.y/b.y;float md=br_midY(t,sx,sz);return vec3(br_chipWear(md+br_highY(t,sx,sz))*m,br_contour(md)*m,m);}
vec3 br_az(vec3 q,vec3 b,float sx,float sy){float m=br_mz(q,b,sx,sy);float t=q.z/b.z;float md=br_midZ(t,sx,sy);return vec3(br_chipWear(md+br_highZ(t,sx,sy))*m,br_contour(md)*m,m);}
float br_surfaceDelta(vec3 q,vec3 b){
 vec3 sum=vec3(0.0);
 sum+=br_ax(q,b,-1.0,-1.0);sum+=br_ax(q,b,-1.0,1.0);sum+=br_ax(q,b,1.0,-1.0);sum+=br_ax(q,b,1.0,1.0);
 sum+=br_ay(q,b,-1.0,-1.0);sum+=br_ay(q,b,-1.0,1.0);sum+=br_ay(q,b,1.0,-1.0);sum+=br_ay(q,b,1.0,1.0);
 sum+=br_az(q,b,-1.0,-1.0);sum+=br_az(q,b,-1.0,1.0);sum+=br_az(q,b,1.0,-1.0);sum+=br_az(q,b,1.0,1.0);
 sum.x+=0.0017*br_ck(q,b,-1.0,-1.0,1.0);sum.x+=0.0220*br_ck(q,b,-1.0,1.0,1.0);sum.x+=0.0140*br_ck(q,b,1.0,1.0,-1.0);sum.x+=0.0070*br_ck(q,b,1.0,1.0,1.0);
 return 0.038*tanh(sum.x*1.10/0.038)+sum.y/max(1.0,sum.z);
}
vec3 br_variant(vec3 qIn,int variant){vec3 q=qIn;if((variant&1)==1){q.x=-q.x;}if((variant&2)==2){q.z=-q.z;}return q;}
// Exact original family-0 distance, in metres. This is not guaranteed Lipschitz 1.0
float kpBrickBaseDistance(vec3 pLocalM,float seed,int variant,float variation){
 vec3 q=br_variant(pLocalM/KP_BRICK_SCALE,variant);vec3 b=vec3(1.04,0.265,0.480);
 float gain=mix(1.0,0.90+0.20*br_h11(seed+7.1),variation);
 return KP_BRICK_SCALE*(br_roundBox(q,b,0.055)+br_surfaceDelta(q,b)*gain);
}
float kpBrickAnalyticBoundDistance(vec3 pLocalM){return KP_BRICK_SCALE*br_roundBox(pLocalM/KP_BRICK_SCALE,vec3(1.04,0.265,0.480),0.055);}
vec3 br_xi(vec3 q){float rr=max(length(q),1e-4);float cap=0.13*9.5;float radial2=dot(q.xy,q.xy);float angularRadius=sqrt(radial2+cap*cap*exp(-radial2/(cap*cap)));float angle=acos(clamp(q.y/angularRadius,-0.999999,0.999999));return vec3(log2(rr)-2.0,-q.z/rr-1.0,angle);}
// New explicit isotropic footprint bridge. Original wave, 17 octaves and gates
// remain; the original screen dFdx/dFdy footprint is NOT claimed equivalent.
float br_microscope(vec3 q,float qFootprint){
 vec3 xi=br_xi(q);float e=max(qFootprint,1e-7);
 float fp=max(length(br_xi(q+vec3(e,0,0))-xi),max(length(br_xi(q+vec3(0,e,0))-xi),length(br_xi(q+vec3(0,0,e))-xi)));
 float s=0.0;float sc=1.0;for(int j=0;j<17;j++){float gate=1.0-smoothstep(0.48,1.10,fp*sc);vec3 x=xi*sc;s+=gate*(cos(cos(x.z)*cos(x.x)+cos(x.y)*cos(x.y)+cos(x.y)*cos(x.x))-0.6556965)/sc;sc*=2.0;}return s;
}
// Raw original family-0 albedo, roughness and height. No lighting/tone mapping.
KpSurface kpBrickOriginalSurface(vec3 pLocalM,float seed,int variant,float variation,float physicalFootprintM){
 float r0=br_h11(seed+1.2);float r1=br_h11(seed+2.7);float r2=br_h11(seed+4.9);float r3=br_h11(seed+8.3);
 vec3 q=br_variant(pLocalM/KP_BRICK_SCALE,variant);float ang=(r0-0.5)*2.2*variation;float ca=cos(ang);float sa=sin(ang);
 vec2 oldXZ=q.xz;q.x=ca*oldXZ.x+sa*oldXZ.y;q.z=-sa*oldXZ.x+ca*oldXZ.y;
 q+=variation*vec3((r1-0.5)*18.0,(r2-0.5)*12.0,(r3-0.5)*16.0);
 float body=br_fbm(q*1.15+vec3(-2.7,4.1,8.3));float fire=br_fbm(q*2.65+vec3(7.1,-5.2,1.7));float firing=smoothstep(0.27,0.79,0.66*body+0.34*fire);
 float reduction=smoothstep(0.69,0.88,br_fbm(q*0.82+vec3(12.1,1.4,-9.7)))*smoothstep(0.38,0.82,firing);
 float poreA=br_noise3(q*29.7+vec3(2.3,9.1,-4.4));float poreB=br_noise3(q*61.3+vec3(-7.2,3.7,14.6));float pore=smoothstep(0.79,0.92,poreA)*smoothstep(0.64,0.84,poreB);
 float skin=smoothstep(0.36,0.76,br_fbm(q*5.1+vec3(1.9,-3.2,11.4)));float mm=br_microscope(q*9.5,max(physicalFootprintM,0.0)/KP_BRICK_SCALE*9.5);
 vec3 base=mix(vec3(0.235,0.043,0.023),vec3(0.455,0.105,0.048),smoothstep(0.14,0.76,firing));base=mix(base,vec3(0.625,0.205,0.082),smoothstep(0.58,0.92,firing)*0.34);base=mix(base,vec3(0.19,0.055,0.038),reduction*0.63);
 float rough=clamp(0.90-0.10*firing+0.055*reduction+0.075*pore,0.68,0.985);
 float h=(body-0.5)*0.010+(skin-0.5)*0.004+mm*0.0034-pore*0.0048;
 base*=0.965+0.07*(skin-0.5);base*=mix(1.0,0.93+0.14*br_h11(seed+19.7),variation);
 return KpSurface(h*KP_BRICK_SCALE,base,rough);
}

// STONE_STUDY same-page stoneFields, kind 0 (the stone receiver's default).
// KpSurface is supplied once by the shared brick core; do not redefine it here.
// No texture, mesh, voxel atlas, material cache or additional noise family.
// Authored unit bridge: a 0.42 m longest side maps to 3.4 specimen units.
const float KP_STONE_SCALE_M= 0.12352941176470589;
const int KP_STONE_KIND= 0;
const uint KP_STONE_MASTER_SEED= 8231u;
// Original normalizeSeedDNA offsets: color +401, pore +307, weather +601.
const float KP_STONE_COLOR_SEED= 8632.0;
const float KP_STONE_PORE_SEED= 8538.0;
const float KP_STONE_WEATHER_SEED= 8832.0;

vec3 st_hash33(vec3 pIn){
 vec3 p=fract(pIn*vec3(0.1031,0.1030,0.0973));
 p+=vec3(dot(p,p.yxz+vec3(33.33)));
 return fract((p.xxy+p.yxx)*p.zyx);
}
float st_valueNoise3(vec3 p){
 vec3 i=floor(p);vec3 f=fract(p);
 f=f*f*f*(f*(f*6.0-vec3(15.0))+vec3(10.0));
 return mix(mix(mix(st_hash33(i).x,st_hash33(i+vec3(1,0,0)).x,f.x),mix(st_hash33(i+vec3(0,1,0)).x,st_hash33(i+vec3(1,1,0)).x,f.x),f.y),mix(mix(st_hash33(i+vec3(0,0,1)).x,st_hash33(i+vec3(1,0,1)).x,f.x),mix(st_hash33(i+vec3(0,1,1)).x,st_hash33(i+vec3(1,1,1)).x,f.x),f.y),f.z);
}
vec3 st_seedVector(float seed,float salt){
 return st_hash33(vec3(seed*0.001,salt,seed*0.00013))*49.0;
}
vec3 st_srgbToLinear(vec3 c){
 return mix(c/12.92,pow((c+vec3(0.055))/1.055,vec3(2.4)),step(vec3(0.04045),c));
}
float st_sf(vec3 p){
 return st_valueNoise3(p)*0.57+st_valueNoise3(p*2.07+vec3(13.7))*0.28+st_valueNoise3(p*4.11+vec3(27.2))*0.15;
}
vec3 st_warp(vec3 p,vec3 seed){
 return p+vec3(st_sf(p*0.8+seed),st_sf(p*0.8+seed+vec3(7.0)),st_sf(p*0.8+seed+vec3(19.0)))*0.25;
}
float st_line(vec3 q,vec3 seed){
 return abs(sin((q.x*0.84+q.y*0.37+q.z*0.51+st_sf(q*1.7+seed)*0.44)*12.0));
}
// New explicit isotropic footprint bridge replacing screen-space fwidth(line).
// It reevaluates the ORIGINAL line and warp at three metric axis offsets.
// This bound-like footprint is not screen-space fwidth equivalence and is not
// complete band-limiting of the original noise; zero footprint keeps 0.008.
float st_lineAA(vec3 pos,vec3 seed,float line,float physicalFootprintM){
 float e=max(physicalFootprintM,0.0)/KP_STONE_SCALE_M;
 if(e==0.0){return 0.008;}
 float dx=abs(st_line(st_warp(pos+vec3(e,0,0),seed),seed)-line);
 float dy=abs(st_line(st_warp(pos+vec3(0,e,0),seed),seed)-line);
 float dz=abs(st_line(st_warp(pos+vec3(0,0,e),seed),seed)-line);
 return max(dx+dy+dz,0.008);
}
// Original kind-0 stoneFields arithmetic. Fixed original material controls:
// sSurface.x=1, sSurface.y=0.7, sDisplay.w=1, sRelief=1, uEventCount=0.
// Original event-loop contribution is therefore 0. Original pits still apply.
// Branches 1/2/3 and their inactive grain/phase/crystal evaluations are omitted.
KpSurface kpStoneOriginalSurface(vec3 pLocalM,float sourceWet,float roughBias,float physicalFootprintM){
 vec3 pos=pLocalM/KP_STONE_SCALE_M;
 vec3 seed=st_seedVector(KP_STONE_COLOR_SEED,0.071);
 vec3 q=st_warp(pos,seed);
 float broad=st_sf(q*1.35+seed);
 float region=st_sf(q*3.2+seed+vec3(11.0));
 float weather=st_sf(q*2.2+st_seedVector(KP_STONE_WEATHER_SEED,0.09));
 float line=st_line(q,seed);
 float aa=st_lineAA(pos,seed,line,physicalFootprintM);
 float vein=(1.0-smoothstep(0.028,0.064+aa,line))*smoothstep(0.34,0.63,region);
 float pits=pow(max(0.0,(st_sf(q*19.0+st_seedVector(KP_STONE_PORE_SEED,0.061))-0.57)/0.43),2.0);
 vec3 col=mix(vec3(0.26,0.31,0.32),vec3(0.57,0.59,0.55),smoothstep(0.24,0.73,broad));
 col=mix(col,vec3(0.49,0.40,0.29),smoothstep(0.57,0.76,weather)*0.65);
 float mineral=vein*0.7;
 col=mix(col,vec3(0.83,0.81,0.70),mineral*0.90);
 float rough=mix(0.79,0.43,mineral);
 float h=(broad-0.5)*0.018+(region-0.5)*0.007+vein*0.004-pits*0.025;
 float geomCavity=0.0;
 float cav=clamp(geomCavity*0.55+pits*1.4,0.0,1.0);
 float wet=clamp(sourceWet*(0.18+0.82*smoothstep(0.32,0.75,weather+cav*0.25)),0.0,1.0);
 float lum=dot(col,vec3(0.2126,0.7152,0.0722));
 col=mix(vec3(lum),col,1.0);
 vec3 linear=st_srgbToLinear(clamp(col,vec3(0.025),vec3(0.95)));
 linear*=1.0-wet*0.38;
 return KpSurface(h*KP_STONE_SCALE_M,linear,clamp(mix(rough+roughBias,0.17,wet),0.12,0.98));
}
// New, authored age/moisture/repair bridge copied from resolveStoneFabric.
// Its original default wear=0.15 is fixed because this call has no wear input.
// No calibrated decay law, damage geometry, formation events or SDF is ported.
// Age changes original wet/rough uniforms only; original height stays intact.
KpSurface kpStoneSurface(vec3 pLocalM,float age,float wet,float repair,float physicalFootprintM){
 float a=clamp(age,0.0,1.0);float r=clamp(repair,0.0,1.0);float m=clamp(wet,0.0,1.0);
 float retainedAge=a*(1.0-r);
 float sourceWet=clamp(m*(0.45+0.55*retainedAge)*(1.0-0.45*r),0.0,1.0);
 float roughBias=0.07*retainedAge+0.025*0.15-0.06*r;
 return kpStoneOriginalSurface(pLocalM,sourceWet,roughBias,physicalFootprintM);
}

// STONE_STUDY original sKind == 3 (blue-gray slate) surface branch.
// Append AFTER existing KP_STONE_WGSL; reuse its st_* source functions/seeds.
// Receiver controls below are explicit design bindings, NOT physical calibration.
// Original event count remains 0, matching the current surface-only port.
struct KpStoneSlateParams {
 float sourceScaleM; float materialScale; float mineral; float chroma; float relief;
};
KpStoneSlateParams kpStoneSlateDefaultParams(){
 return KpStoneSlateParams(KP_STONE_SCALE_M,1.0,0.7,1.0,1.0);
}
KpSurface kpStoneSlateOriginalSurface(vec3 pLocalM,KpStoneSlateParams params,float sourceWet,float roughBias,float physicalFootprintM){
 vec3 pos=pLocalM/params.sourceScaleM;
 vec3 seed=st_seedVector(KP_STONE_COLOR_SEED,0.071);
 vec3 p=pos*params.materialScale;
 vec3 q=st_warp(p,seed);
 float broad=st_sf(q*1.35+seed);
 float region=st_sf(q*3.2+seed+vec3(11.0));
 float weather=st_sf(q*2.2+st_seedVector(KP_STONE_WEATHER_SEED,0.09));
 float phase=q.y*5.7+q.x*0.82+q.z*0.41+st_sf(q*1.8+seed)*1.25;
 float line=st_line(q,seed);
 // Existing helper converts its input by KP_STONE_SCALE_M. Undo that fixed
 // scale here, then provide THIS receiver's explicit source + texture scale.
 // physicalFootprintM == 0 retains exactly the source's intrinsic aa floor.
 float aa=st_lineAA(p,seed,line,physicalFootprintM*KP_STONE_SCALE_M*params.materialScale/params.sourceScaleM);
 float vein=(1.0-smoothstep(0.028,0.064+aa,line))*smoothstep(0.34,0.63,region);
 float pits=pow(max(0.0,(st_sf(q*19.0+st_seedVector(KP_STONE_PORE_SEED,0.061))-0.57)/0.43),2.0);
 // Exact source kind-3 arithmetic; grain/crystal/bands are inactive here.
 float cleavage=st_sf(vec3(q.x*1.8,phase*2.8,q.z*1.8)+seed);
 vec3 col=mix(vec3(0.10,0.15,0.19),vec3(0.30,0.37,0.40),smoothstep(0.20,0.78,cleavage*0.58+broad*0.42));
 col=mix(col,vec3(0.47,0.33,0.20),smoothstep(0.60,0.77,weather)*0.67);
 float mineral=vein*params.mineral;
 col=mix(col,vec3(0.57,0.61,0.57),mineral*0.51);
 float rough=0.48+cleavage*0.17-mineral*0.19;
 float h=(cleavage-0.5)*0.009+(broad-0.5)*0.012+sin(phase*6.28318)*0.0018-pits*0.01;
 float geomCavity=0.0;
 float cav=clamp(geomCavity*0.55+pits*1.4,0.0,1.0);
 float wet=clamp(sourceWet*(0.18+0.82*smoothstep(0.32,0.75,weather+cav*0.25)),0.0,1.0);
 float lum=dot(col,vec3(0.2126,0.7152,0.0722));
 col=mix(vec3(lum),col,params.chroma);
 vec3 linear=st_srgbToLinear(clamp(col,vec3(0.025),vec3(0.95)));
 linear*=1.0-wet*0.38;
 return KpSurface(h*params.relief*params.sourceScaleM,linear,clamp(mix(rough+roughBias,0.17,wet),0.12,0.98));
}
// Same existing authored age/moisture/repair bridge; only source branch differs.
KpSurface kpStoneSlateSurface(vec3 pLocalM,KpStoneSlateParams params,float age,float wet,float repair,float physicalFootprintM){
 float a=clamp(age,0.0,1.0);float r=clamp(repair,0.0,1.0);float m=clamp(wet,0.0,1.0);
 float retainedAge=a*(1.0-r);
 float sourceWet=clamp(m*(0.45+0.55*retainedAge)*(1.0-0.45*r),0.0,1.0);
 float roughBias=0.07*retainedAge+0.025*0.15-0.06*r;
 return kpStoneSlateOriginalSurface(pLocalM,params,sourceWet,roughBias,physicalFootprintM);
}

// R3.12 original macro/micro/observed field algebra. Explicit coordinates and
// derivative-free physical footprint are receiver bridges. No patch silhouette.
struct KpPlasterParams {
 vec2 centerM; vec2 halfM; float thicknessM; float reliefM;
 float geometryMicroM; float minThicknessM; float maxThicknessM; float microM;
 vec3 paletteDark; vec3 paletteLight;
 float grainWavelengthM; float grainHeightM; float grainColor;
};
struct KpPlasterField {float macroTone;float micro;float thicknessM;KpSurface surface;};
vec3 pl_rotate(vec3 v,vec3 axis,float a){float c=cos(a);float s=sin(a);return v*c+cross(axis,v)*s+axis*dot(axis,v)*(1.0-c);}
vec3 pl_warp(vec3 p,vec3 phase){vec3 c1=vec3(0.12,1.42,0.04)+0.035*phase;vec3 a1=normalize(vec3(0.38,0.82,0.42));vec3 v1=p-c1;float t1=0.65*exp(-dot(v1,v1)/(2.4*2.4))*sin(1.45*dot(a1,v1)+0.7+phase.x);vec3 q=c1+pl_rotate(v1,a1,t1);vec3 c2=vec3(-0.16,1.63,-0.06)+0.025*phase;vec3 a2=normalize(vec3(-0.67,0.15,0.73));vec3 v2=q-c2;float t2=0.20*exp(-dot(v2,v2)/(2.1*2.1))*sin(4.1*dot(a2,v2)+2.0+phase.y);return c2+pl_rotate(v2,a2,t2);}
vec3 pl_xi(vec3 p,vec3 phase){vec3 q=pl_warp(p,phase)+vec3(2.73,0.91,1.37);float r=max(length(q),1e-4);return vec3(log2(r)-2.0,-q.z/r,atan(q.x,q.y));}
float pl_cell(vec3 xi,float sc){float a=cos(sc*xi.z)*cos(sc*xi.x)+cos(sc*xi.y)*cos(sc*xi.y)+cos(sc*xi.y)*cos(sc*xi.x);return cos(a)-0.6556965458313674;}
float pl_macroFast(vec3 p){vec3 xi=pl_xi(p,vec3(0.7,-1.3,2.1));float s=pl_cell(xi,1.0)+pl_cell(xi,2.0)*0.5+pl_cell(xi,4.0)*0.25+pl_cell(xi,8.0)*0.125+pl_cell(xi,16.0)*0.0625;return tanh(0.78*s);}
float pl_microFast(vec3 p){vec3 xi=pl_xi(p,vec3(0.7,-1.3,2.1));float s=pl_cell(xi,16.0)*0.0625+pl_cell(xi,32.0)*0.03125+pl_cell(xi,64.0)*0.015625;return tanh(10.5*s);}
vec3 pl_q(vec3 p,KpPlasterParams a){return vec3((p.xy-a.centerM)/max(a.halfM,vec2(0.08)),p.z*2.0);}
float kpPlasterMacro(vec3 p,KpPlasterParams a){float low=pl_macroFast(pl_q(p,a)+vec3(-0.17,0.31,0.09));float coarse=sin(p.x*2.7+p.y*0.9)*sin(p.y*3.2-p.x*0.7);return clamp(0.48*low+0.52*coarse,-1.0,1.0);}
float kpPlasterMicro(vec3 p,KpPlasterParams a){float m=pl_microFast(pl_q(p,a)*vec3(2.65,2.52,3.55)+vec3(-0.27,0.44,-0.19));float r=sin(p.x*47.0-p.y*39.0+p.z*58.0)*sin(p.x*31.0+p.y*37.0-p.z*43.0);return clamp(0.78*m+0.22*r,-1.0,1.0);}
float pl_observed(vec3 p,KpPlasterParams a,float physicalFootprintM){
 vec3 q=pl_q(p,a);vec3 phase=vec3(-1.3,4.7,2.2);vec3 xi=pl_xi(q,phase);
 float e=max(physicalFootprintM,1e-7);vec3 dq=vec3(e/max(a.halfM.x,0.08),e/max(a.halfM.y,0.08),e*2.0);
 float fp=max(length(pl_xi(q+vec3(dq.x,0,0),phase)-xi),max(length(pl_xi(q+vec3(0,dq.y,0),phase)-xi),length(pl_xi(q+vec3(0,0,dq.z),phase)-xi)));
 float sum=0.0;float sc=1.0;for(int i=0;i<17;i++){float gate=1.0-smoothstep(0.44,1.12,fp*sc);sum+=gate*pl_cell(xi,sc)/sc;sc*=2.0;}return tanh(0.86*sum);
}
KpPlasterField kpPlasterOriginalField(vec3 pLocalM,KpPlasterParams a,float physicalFootprintM){
 float pm=kpPlasterMacro(pLocalM,a);float pu=kpPlasterMicro(pLocalM,a);float obs=pl_observed(pLocalM,a,physicalFootprintM);
 // Existing metric-grain correction: same direction, explicit metre period.
 float wave=max(a.grainWavelengthM,0.0003);float phase=dot(pLocalM,normalize(vec3(83.0,-61.0,97.0)))*(6.283185307179586/wave);
 float grain=sin(phase)*(1.0-smoothstep(0.35,0.90,physicalFootprintM/wave));
 float microGate=1.0-smoothstep(0.008,0.020,physicalFootprintM);
 float h=microGate*a.microM*(0.26*obs+0.18*pu)+a.grainHeightM*grain;
 vec3 base=mix(a.paletteDark,a.paletteLight,0.58+0.08*obs+0.22*pm)*(0.94+a.grainColor*grain);
 float rough=clamp(0.95+0.032*(-obs),0.86,0.997);
 float thickness=clamp(a.thicknessM+a.reliefM*pm+a.geometryMicroM*pu,a.minThicknessM,a.maxThicknessM);
 return KpPlasterField(pm,pu,thickness,KpSurface(h,base,rough));
}

// User Library timber v3, exact box coordinate/noise/field formulas in WGSL.
// KpSurface must be declared by the parent brick module before this string.
// No bindings, stages, renderer, textures, geometry buffers or scene objects.
const float KP_WOOD_PI=3.141592653589793;
const float KP_WOOD_TAU=6.283185307179586;
struct KpWoodParams {
  float seed;
  float ringFrequency;
  float ringScale;
  float ringWarp;
  float fiberFrequency;
  float fineFiberFrequency;
  float poreFrequency;
  float fiberStrength;
  float colorBias;
  float roughness;
  float angleOffset;
  float textureScale;
  float grainContrast;
  float detailFineness;
  float microReliefM;
  float parallaxM;
  float macroDisplacementM;
  float reliefScale;
  float reliefQuality;
  float parallaxSteps;
  float clearcoat;
  float clearcoatRoughness;
  float specularLevel;
  float distanceFadeStart;
  float distanceFadeEnd;
  float toolPhase;
  float crackPhase;
  float knotPhase;
  vec2 pithOffset;
  vec3 darkGrainColor;
  vec3 lightGrainColor;
  vec3 agedSurfaceColor;
  vec3 weatheredColor;
  vec3 freshCutColor;
  vec3 cavityColor;
};
struct KpWoodSample {
  KpSurface surface;
  float cavity;
  float clearcoat;
  float clearcoatRoughness;
  float specularLevel;
  float macroHeightM;
  float parallaxHeight01;
};
KpWoodParams kpWoodDefaultParams() {
  KpWoodParams p;
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
  p.pithOffset=vec2(0.04244730153121054,-0.07805894820950925);
  p.darkGrainColor=vec3(0.10224173308810132,0.06480326669290577,0.04091519690685319);
  p.lightGrainColor=vec3(0.31398871337571754,0.1946178304415758,0.11443537382697373);
  p.agedSurfaceColor=vec3(0.18782077230067787,0.13563332965520566,0.09758734714186246);
  p.weatheredColor=vec3(0.23455058216100522,0.21586050011389926,0.18782077230067787);
  p.freshCutColor=vec3(0.39157247774972326,0.26225065752969623,0.162029375639111);
  p.cavityColor=vec3(0.04091519690685319,0.027320891639074894,0.0202885630566524);
  return p;
}
float kwSaturate(float value, KpWoodParams wp, float fp) { return clamp(value, 0.0, 1.0); }

float kwHash31(vec3 pIn, KpWoodParams wp, float fp) {
  vec3 p=pIn;
  p = fract(p * 0.1031 + wp.seed * vec3(13.71, 47.13, 91.77));
  p += vec3(dot(p, p.yzx + vec3(33.33)));
  return fract((p.x + p.y) * p.z);
}

float kwValueNoise(vec3 p, KpWoodParams wp, float fp) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (vec3(3.0) - 2.0 * f);
  return mix(
    mix(mix(kwHash31(i + vec3(0,0,0), wp, fp), kwHash31(i + vec3(1,0,0), wp, fp), f.x),
        mix(kwHash31(i + vec3(0,1,0), wp, fp), kwHash31(i + vec3(1,1,0), wp, fp), f.x), f.y),
    mix(mix(kwHash31(i + vec3(0,0,1), wp, fp), kwHash31(i + vec3(1,0,1), wp, fp), f.x),
        mix(kwHash31(i + vec3(0,1,1), wp, fp), kwHash31(i + vec3(1,1,1), wp, fp), f.x), f.y),
    f.z
  );
}

float kwFbm(vec3 pIn, KpWoodParams wp, float fp) {
  vec3 p=pIn;
  float result = 0.0;
  float amplitude = 0.5;
  mat3 rotation = mat3(vec3(0.00,0.80,0.60),vec3(-0.80,0.36,-0.48),vec3(-0.60,-0.48,0.64));
  for (int i= 0; i < 5; i++) {
    result += amplitude * kwValueNoise(p, wp, fp);
    p = rotation * p * 2.03 + vec3(7.1, 3.7, 5.9);
    amplitude *= 0.5;
  }
  return result;
}

float kwAaSine(float coordinate, KpWoodParams wp, float fp) {
  float footprint = fp;
  float attenuation = 1.0 - smoothstep(0.42, 1.15, footprint);
  return 0.5 + 0.5 * sin(KP_WOOD_TAU * coordinate) * attenuation;
}

float kwAaThinLine(float coordinate, float width, KpWoodParams wp, float fp) {
  float distanceToLine = abs(sin(KP_WOOD_PI * coordinate));
  float footprint = min(0.22, fp * 0.75);
  return 1.0 - smoothstep(width + footprint, width + 0.085 + footprint, distanceToLine);
}

float kwFlatAcross(vec3 g, vec3 localNormal, KpWoodParams wp, float fp) {
  return mix(g.y, g.z, abs(localNormal.y) > abs(localNormal.z));
}

float kwFlatDepth(vec3 g, vec3 localNormal, KpWoodParams wp, float fp) {
  return mix(g.z, g.y, abs(localNormal.y) > abs(localNormal.z));
}

float kwSidePhase(vec3 g, vec2 crossPosition, vec3 localNormal, float multiplier, KpWoodParams wp, float fp) {
  return kwFlatAcross(g, localNormal, wp, fp) * wp.fiberFrequency * multiplier;
}

float kwSideAnisotropicNoise(vec3 g, vec2 crossPosition, vec3 localNormal, float axialFrequency, float crossFrequency, float phase, KpWoodParams wp, float fp) {
  float planarAcross = kwFlatAcross(g, localNormal, wp, fp);
  float planarDepth = kwFlatDepth(g, localNormal, wp, fp);
  vec3 planarCoordinate = vec3(
    g.x * axialFrequency + phase,
    planarAcross * crossFrequency + wp.seed * 4.7,
    planarDepth * 0.72 + wp.seed * 9.1
  );
  return kwFbm(planarCoordinate, wp, fp);
}

float kwSideValueNoise(vec3 g, vec2 crossPosition, vec3 localNormal, float axialFrequency, float crossFrequency, float phase, KpWoodParams wp, float fp) {
  float planarAcross = kwFlatAcross(g, localNormal, wp, fp);
  float planarDepth = kwFlatDepth(g, localNormal, wp, fp);
  vec3 planarCoordinate = vec3(
    g.x * axialFrequency + phase,
    planarAcross * crossFrequency + wp.seed * 6.3,
    planarDepth * 0.54 + wp.seed * 3.8
  );
  return kwValueNoise(planarCoordinate, wp, fp);
}

float kwRidgeFromNoise(float value, KpWoodParams wp, float fp) {
  return 1.0 - abs(value * 2.0 - 1.0);
}

float kwKnotSignal(vec3 g, vec2 crossPosition, vec3 localNormal, KpWoodParams wp, float fp) {
  float broad = kwSideAnisotropicNoise(
    g,
    crossPosition,
    localNormal,
    0.34,
    1.35,
    wp.knotPhase + 8.0
  , wp, fp);
  float compact = kwSideValueNoise(
    g,
    crossPosition,
    localNormal,
    0.72,
    2.25,
    wp.knotPhase * 0.37 + 17.0
  , wp, fp);
  return smoothstep(0.71, 0.91, broad) * smoothstep(0.58, 0.86, compact);
}

vec4 kwWoodSignals(vec3 g, vec3 localNormal, float surfaceClass, KpWoodParams wp, float fp) {
  float crossSection = step(0.72, abs(localNormal.x));

  float driftY = kwFbm(vec3(g.x * 0.24 + wp.seed * 3.1, 1.17, 7.93), wp, fp) - 0.5;
  float driftZ = kwFbm(vec3(g.x * 0.21 - wp.seed * 4.7, 9.31, 2.41), wp, fp) - 0.5;
  vec2 longWarp = vec2(driftY, driftZ) * wp.ringWarp * 0.115;
  vec2 crossPosition = g.yz + wp.pithOffset + longWarp;
  float theta = atan(crossPosition.y, crossPosition.x);

  float oval = 0.075 * sin(wp.seed * 31.0 + wp.angleOffset);
  vec2 ringPosition = crossPosition * vec2(1.0 + oval, 1.0 - oval);
  float radial = length(ringPosition);
  float ringNoise = kwFbm(vec3(
    g.x * 0.18 + wp.seed * 2.4,
    ringPosition.x * 2.2,
    ringPosition.y * 2.2
  ), wp, fp);
  float ringCoordinate = radial * wp.ringFrequency * wp.ringScale;
  ringCoordinate += (ringNoise - 0.5) * wp.ringWarp * 1.18;
  ringCoordinate += sin(theta * 2.0 + wp.seed * 13.0) * 0.12 * wp.ringWarp;
  ringCoordinate += sin(theta * 5.0 - wp.seed * 7.0) * 0.045 * wp.ringWarp;
  float ringLine = kwAaThinLine(ringCoordinate, 0.060, wp, fp);
  float ringBody = kwAaSine(ringCoordinate + (ringNoise - 0.5) * 0.16, wp, fp);
  float ring = kwSaturate(ringBody * 0.62 + ringLine * 0.38, wp, fp);

  float broad = kwSideAnisotropicNoise(g, crossPosition, localNormal, 0.18, 1.55, wp.angleOffset, wp, fp);
  float flow = kwSideAnisotropicNoise(g, crossPosition, localNormal, 0.42, 3.35, wp.seed * 11.0 + 2.4, wp, fp);
  float medium = kwSideAnisotropicNoise(g, crossPosition, localNormal, 0.88, 7.20, wp.seed * 17.0 + 4.7, wp, fp);
  float knot = kwKnotSignal(g, crossPosition, localNormal, wp, fp);

  float phaseWarp = (broad - 0.5) * 5.4 + (flow - 0.5) * 2.9;
  phaseWarp += sin(g.x * 0.58 + theta * 1.7 + wp.seed * 19.0) * 0.50;
  phaseWarp += knot * (4.0 + 1.6 * sin(g.x * 1.05 + wp.knotPhase));

  float coarseLine = kwAaThinLine(
    kwSidePhase(g, crossPosition, localNormal, 0.58, wp, fp) + phaseWarp + wp.angleOffset / KP_WOOD_TAU,
    0.065
  , wp, fp);
  float coarseVein = kwRidgeFromNoise(flow, wp, fp);
  float coarseFiber = kwSaturate(
    broad * 0.47 +
    coarseVein * 0.31 +
    coarseLine * 0.22
  , wp, fp);

  float mediumLine = kwAaThinLine(
    kwSidePhase(g, crossPosition, localNormal, 1.85, wp, fp) + phaseWarp * 1.72 + wp.seed * 7.0,
    0.040
  , wp, fp);
  float mediumFiber = kwSaturate(
    medium * 0.47 +
    kwRidgeFromNoise(flow * 0.62 + medium * 0.38, wp, fp) * 0.37 +
    mediumLine * 0.16
  , wp, fp);

  float crackGate = smoothstep(
    0.79,
    0.94,
    kwSideValueNoise(g, crossPosition, localNormal, 0.32, 3.1, wp.crackPhase + 13.0, wp, fp)
  );
  float sideCrack = kwAaThinLine(
    kwSidePhase(g, crossPosition, localNormal, 0.17, wp, fp)
      + phaseWarp * 0.16
      + wp.crackPhase / KP_WOOD_TAU,
    0.014
  , wp, fp) * crackGate;
  float radialGate = smoothstep(
    0.72,
    0.93,
    kwValueNoise(vec3(radial * 1.9, g.x * 0.27, wp.seed * 9.0), wp, fp)
  );
  float radialCrack = pow(max(0.0, sin(theta * 7.0 + wp.crackPhase)), 26.0)
    * smoothstep(0.08, 0.27, radial)
    * radialGate;
  float cracks = mix(sideCrack, max(sideCrack * 0.12, radialCrack), crossSection);

  return vec4(ring, coarseFiber, mediumFiber, cracks);
}

vec4 kwSecondarySignals(vec3 g, vec3 localNormal, KpWoodParams wp, float fp) {
  vec2 crossPosition = g.yz + wp.pithOffset;
  float broadWarp = kwSideAnisotropicNoise(
    g,
    crossPosition,
    localNormal,
    0.46,
    4.4,
    wp.seed * 21.0 + 1.7
  , wp, fp);
  float fineNoise = kwSideAnisotropicNoise(
    g,
    crossPosition,
    localNormal,
    1.55,
    18.0 * max(wp.detailFineness, 0.45),
    wp.seed * 29.0 + 5.3
  , wp, fp);
  float fineLine = kwAaThinLine(
    kwSidePhase(g, crossPosition, localNormal, 4.6 * max(wp.detailFineness, 0.45), wp, fp)
      + (broadWarp - 0.5) * 8.5
      + wp.seed * 19.0,
    0.026
  , wp, fp);
  float fineFiber = kwSaturate(
    fineNoise * 0.53 +
    kwRidgeFromNoise(fineNoise, wp, fp) * 0.30 +
    fineLine * 0.17
  , wp, fp);

  float poreNoise = kwSideValueNoise(
    g,
    crossPosition,
    localNormal,
    4.2 * max(wp.detailFineness, 0.45),
    38.0 * max(wp.detailFineness, 0.45),
    wp.seed * 23.0 + 11.0
  , wp, fp);
  float poreGate = kwSideValueNoise(
    g,
    crossPosition,
    localNormal,
    0.85,
    7.0,
    wp.seed * 31.0 + 2.0
  , wp, fp);
  float pores = smoothstep(0.865, 0.982, poreNoise)
    * smoothstep(0.52, 0.82, poreGate);

  float toolWave = kwAaSine(g.x * 1.45 + kwFlatAcross(g, localNormal, wp, fp) * 0.22 + wp.toolPhase / KP_WOOD_TAU, wp, fp);
  float toolMask = smoothstep(
    0.79,
    0.96,
    kwSideValueNoise(g, crossPosition, localNormal, 0.54, 2.3, wp.toolPhase + 5.0, wp, fp)
  );
  float tool = toolWave * toolMask;

  float knot = kwKnotSignal(g, crossPosition, localNormal, wp, fp);
  return vec4(fineFiber, pores, tool, knot);
}

float kwMacroSignal(vec3 g, KpWoodParams wp, float fp) {
  return kwFbm(g * vec3(0.12, 0.70, 0.70) + vec3(wp.seed * 5.0), wp, fp);
}

float kwCoarseRelief(vec3 g, vec3 localNormal, float surfaceClass, KpWoodParams wp, float fp) {
  float crossSection = step(0.72, abs(localNormal.x));
  vec2 crossPosition = g.yz + wp.pithOffset;
  float theta = atan(crossPosition.y, crossPosition.x);
  float radial = length(crossPosition);

  float broadWarp = kwValueNoise(vec3(g.x * 0.18, crossPosition * 2.4) + vec3(wp.seed * 3.1), wp, fp);
  float sideBand = kwAaSine(
    kwSidePhase(g, crossPosition, localNormal, 0.62, wp, fp)
    + (broadWarp - 0.5) * 3.2
    + wp.angleOffset / KP_WOOD_TAU
  , wp, fp);
  float ringBand = kwAaSine(
    radial * wp.ringFrequency * wp.ringScale
    + (broadWarp - 0.5) * wp.ringWarp * 0.55
  , wp, fp);
  float sparseGate = smoothstep(
    0.84,
    0.965,
    kwValueNoise(vec3(g.x * 0.31 + wp.crackPhase, crossPosition * 4.1), wp, fp)
  );
  float sideCrack = kwAaThinLine(
    kwSidePhase(g, crossPosition, localNormal, 0.20, wp, fp)
    + (broadWarp - 0.5) * 0.22
    + wp.crackPhase / KP_WOOD_TAU,
    0.015
  , wp, fp) * sparseGate;
  float radialCrack = pow(max(0.0, sin(theta * 7.0 + wp.crackPhase)), 24.0)
    * smoothstep(0.08, 0.28, radial)
    * sparseGate;

  float sideHeight = (sideBand - 0.5) * 0.36 - sideCrack * 0.60;
  float endHeight = (ringBand - 0.5) * 0.34 - radialCrack * 0.68;
  return kwSaturate(0.5 + mix(sideHeight, endHeight, crossSection), wp, fp);
}

float kwVertexHash(vec3 pIn, KpWoodParams wp, float fp) {
  vec3 p=pIn;
  p = fract(p * 0.1031 + wp.seed * vec3(17.17, 41.73, 83.11));
  p += vec3(dot(p, p.yzx + vec3(31.32)));
  return fract((p.x + p.y) * p.z);
}

float kwVertexNoise(vec3 p, KpWoodParams wp, float fp) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (vec3(3.0) - 2.0 * f);
  return mix(
    mix(mix(kwVertexHash(i + vec3(0,0,0), wp, fp), kwVertexHash(i + vec3(1,0,0), wp, fp), f.x),
        mix(kwVertexHash(i + vec3(0,1,0), wp, fp), kwVertexHash(i + vec3(1,1,0), wp, fp), f.x), f.y),
    mix(mix(kwVertexHash(i + vec3(0,0,1), wp, fp), kwVertexHash(i + vec3(1,0,1), wp, fp), f.x),
        mix(kwVertexHash(i + vec3(0,1,1), wp, fp), kwVertexHash(i + vec3(1,1,1), wp, fp), f.x), f.y),
    f.z
  );
}

float kwMacroField(vec3 pIn, KpWoodParams wp, float fp) {
  vec3 p=pIn;
  float result = 0.0;
  float amplitude = 0.58;
  for (int i= 0; i < 3; i++) {
    result += amplitude * kwVertexNoise(p, wp, fp);
    p = p * 2.07 + vec3(5.2, 9.1, 3.7);
    amplitude *= 0.45;
  }
  return result / 0.94;
}

// pSourceM = member-local metres + inherited source grainOffset, +X axial.
// Signed normal displacement; use only this function in the geometry distance.
float kpWoodMacroDisplacement(vec3 pSourceM, float surfaceClass, KpWoodParams wp) {
  float fp=0.0;
  vec3 grain=pSourceM*max(wp.textureScale,0.001);
    float broad = kwMacroField(grain * vec3(0.28, 1.15, 1.15) + vec3(wp.seed * 7.0), wp, fp);
    float longWave = 0.5 + 0.5 * sin(grain.x * 0.82 + wp.seed * 29.0 + broad * 1.55);
    float macroHeight = (broad - 0.5) * 0.78 + (longWave - 0.5) * 0.22;
    float classWeight = 1.0;
    if (surfaceClass > 0.5 && surfaceClass < 2.5) { classWeight = 0.0; }
    else if (surfaceClass > 2.5 && surfaceClass < 3.5) { classWeight = 1.08; }
  return macroHeight * wp.macroDisplacementM * wp.reliefScale * classWeight;
}
// Conservative magnitude bound for the original vertex displacement, in metres.
// Source macro noise is nonnegative with sum (0.58+0.261+0.11745)/0.94;
// original normal class multiplier is at most 1.08. This is not a Lipschitz bound.
float kpWoodMacroDisplacementBound(KpWoodParams wp) {
  return 0.557*abs(wp.macroDisplacementM*wp.reliefScale);
}
// New screen-independent AA bridge. This is a nominal physical frequency estimate,
// not the original screen derivative and not a proof of derivative equivalence.
// fp=0 preserves the unfiltered original field exactly (up to float arithmetic).
float kpWoodCoordinateFootprint(float physicalFootprintM,KpWoodParams wp) {
  return max(physicalFootprintM,0.0)*max(wp.textureScale,0.001)*max(wp.ringFrequency*wp.ringScale,wp.fiberFrequency*4.6*max(wp.detailFineness,0.45));
}
// Complete source material terms before source-specific lighting or gamma.
// The caller supplies the actual member-local surface normal and face class.
// 0=longitudinal, 1=end grain, 2=joint cut, 3=weathered side.
// No camera-ray parallax march is hidden in this pure field call.
KpWoodSample kpWoodOriginalSample(vec3 pSourceM,vec3 normalIn,float surfaceClass,KpWoodParams wp,float physicalFootprintM,float cameraDistanceM) {
  vec3 localNormal=normalize(normalIn);
  vec3 g=pSourceM*max(wp.textureScale,0.001);
  float fp=kpWoodCoordinateFootprint(physicalFootprintM,wp);
  vec3 baseColor=vec3(0.0);
  float heightMeters=0.0;
  float roughness=wp.roughness;
  float cavity=1.0;
    vec4 signals = kwWoodSignals(g, localNormal, surfaceClass, wp, fp);
    vec4 secondary = kwSecondarySignals(g, localNormal, wp, fp);
    float ring = signals.x;
    float coarseFiber = signals.y;
    float mediumFiber = signals.z;
    float cracks = signals.w;
    float fineFiber = secondary.x;
    float pores = secondary.y;
    float tool = secondary.z;
    float knot = secondary.w;
    float macroTone = kwMacroSignal(g, wp, fp);

    float crossSection = step(0.72, abs(localNormal.x));
    vec2 crossPosition = g.yz + wp.pithOffset;
    float radial = length(crossPosition);
    float endRay = kwAaSine(atan(crossPosition.y, crossPosition.x) * 3.0 / KP_WOOD_TAU + radial * 2.0 + wp.seed * 7.0, wp, fp);

    float longitudinalTone =
      (coarseFiber - 0.5) * 1.02 +
      (mediumFiber - 0.5) * 0.43 +
      (macroTone - 0.5) * 0.56 +
      (fineFiber - 0.5) * 0.11 +
      knot * 0.26 -
      cracks * 0.70 -
      pores * 0.08;
    float endTone =
      (ring - 0.5) * 1.08 +
      (endRay - 0.5) * 0.19 +
      (macroTone - 0.5) * 0.38 -
      cracks * 0.72 -
      pores * 0.05;
    float grainTone = mix(longitudinalTone, endTone, crossSection) + wp.colorBias;
    float grainMix = kwSaturate(0.50 + grainTone * wp.grainContrast * 2.72, wp, fp);
    vec3 grainColor = mix(wp.lightGrainColor, wp.darkGrainColor, grainMix);
    baseColor = mix(wp.agedSurfaceColor, grainColor, 0.78);

    if (surfaceClass > 0.5 && surfaceClass < 1.5) {
      baseColor = mix(baseColor, wp.freshCutColor, 0.20);
    } else if (surfaceClass > 1.5 && surfaceClass < 2.5) {
      baseColor = mix(baseColor, wp.freshCutColor, 0.27);
    } else if (surfaceClass > 2.5 && surfaceClass < 3.5) {
      baseColor = mix(baseColor, wp.weatheredColor, 0.53);
      roughness = min(0.98, roughness + 0.045);
    }

    baseColor *= 0.905 + macroTone * 0.19;
    baseColor = mix(baseColor, wp.cavityColor, cracks * 0.40 + pores * 0.065 + knot * 0.025);

    float distanceToCamera = cameraDistanceM;
    float detailFade = 1.0 - smoothstep(wp.distanceFadeStart, wp.distanceFadeEnd, distanceToCamera);
    float sideMicro =
      (coarseFiber - 0.5) * 0.32 +
      (mediumFiber - 0.5) * 0.24 +
      (fineFiber - 0.5) * 0.12 -
      pores * 0.30 -
      cracks * 0.94 -
      tool * 0.13 +
      knot * 0.09;
    float endMicro =
      (ring - 0.5) * 0.34 +
      (fineFiber - 0.5) * 0.05 -
      pores * 0.22 -
      cracks * 1.0;
    float microSignal = mix(sideMicro, endMicro, crossSection);
    heightMeters = microSignal * wp.microReliefM * wp.reliefScale * detailFade;

    roughness = clamp(
      roughness + pores * 0.045 + cracks * 0.075 + (0.5 - macroTone) * 0.022 - wp.clearcoat * 0.085,
      0.18,
      0.98
    );
    cavity = clamp(1.0 - cracks * 0.34 - pores * 0.06 - ring * crossSection * 0.035, 0.60, 1.0);

  return KpWoodSample(KpSurface(heightMeters,baseColor,roughness),cavity,wp.clearcoat,wp.clearcoatRoughness,wp.specularLevel,kpWoodMacroDisplacement(pSourceM,surfaceClass,wp),kwCoarseRelief(g,localNormal,surfaceClass,wp,fp));
}
KpSurface kpWoodOriginalSurface(vec3 pSourceM,vec3 localNormal,float surfaceClass,KpWoodParams wp,float footprintM,float cameraDistanceM) {
  return kpWoodOriginalSample(pSourceM,localNormal,surfaceClass,wp,footprintM,cameraDistanceM).surface;
}
// Original fragment micro-height: PBR normal detail, NOT a replacement for macro geometry.
float kpWoodHeight(vec3 pSourceM,vec3 localNormal,float surfaceClass,KpWoodParams wp,float footprintM,float cameraDistanceM) {
  return kpWoodOriginalSurface(pSourceM,localNormal,surfaceClass,wp,footprintM,cameraDistanceM).height;
}
// Compatibility entry: top longitudinal face of the original default box timber.
// age/wet/repair are reserved host arguments; the original v3 has no such model.
// Scene overlays must be explicit outside this source-preserving material leaf.
KpSurface kpWoodSurface(vec3 pLocalM,float age,float wet,float repair,float footprintM) {
  return kpWoodOriginalSurface(pLocalM,vec3(0.0,1.0,0.0),0.0,kpWoodDefaultParams(),footprintM,0.0);
}
