/* R03.1 visual calibration after inspecting the first fixed-public Windows evidence.
   The first implementation was functionally correct but too faint at normal viewing distance,
   while its eye mask was wider than the intended lower-lid / tear-trough region. */
(()=>{
 const T=window.KAOPU_TRACE_R03;
 if(!T)throw Error('R03 trace kernel missing before visual tune');
 const patch=(s,a,b,label)=>{const n=s.split(a).length-1;if(n!==1)throw Error('R03.1 patch '+label+' expected one anchor, found '+n);return s.replace(a,b);};
 const defaults={amount:1,acne:.72,healed:.58,shave:.86,eye:.30,scar:.36,asymmetry:.68,debug:0};
 T.version='skin-natural-traces-r03-v2';
 T.controls=T.controls.map(row=>[row[0],row[1],row[2],row[3],defaults[row[0]]??row[4]]);
 T.defaults={...T.defaults,...defaults};
 const basePack=T.pack;
 T.pack=packed=>{const r=basePack(packed);r.report.traceKernel='skin-natural-traces-r03-v2';r.report.visualTune='r03.1-visibility-balanced';return r;};

 T.colour=patch(T.colour,
  'float p3ShaveZone=clamp(p2Beard*(1.-p2Lid)*(1.-clamp(lpMask,0.,1.)),0.,1.);',
  'float p3ShaveZone=clamp(p2Beard*(1.-p2Lid)*(1.-clamp(lpMask,0.,1.)),0.,1.);\n float p3ShaveBed=clamp(p3ShaveZone*uTraceShave*(.10+.12*p3B.b),0.,.28);',
  'shave bed');
 T.colour=patch(T.colour,
  'float p3EyeZone=clamp(p2Lid*.72+p2Socket*.70+p2Temple*.12,0.,1.)*p2Head*p2Front*p3NoLip;',
  'float p3BelowEye=1.-smoothstep(uP2Lid.y-.001,uP2Lid.y+.006,p2P.y);\n float p3EyeZone=clamp(p2Lid*.56+p2Socket*.20,0.,1.)*p3BelowEye*p2Head*p2Front*p3NoLip;',
  'lower eye locality');
 T.colour=patch(T.colour,'p3AcneHalo=clamp(p3A.r*p3AcneZone*uTraceAcne*p3Side,0.,1.);','p3AcneHalo=clamp(p3A.r*p3AcneZone*uTraceAcne*p3Side*1.24,0.,1.);','acne halo visibility');
 T.colour=patch(T.colour,'p3AcneCore=clamp(p3A.g*p3AcneZone*uTraceAcne*p3Side,0.,1.);','p3AcneCore=clamp(p3A.g*p3AcneZone*uTraceAcne*p3Side*1.42,0.,1.);','acne core visibility');
 T.colour=patch(T.colour,'p3Healed=clamp(p3A.b*p3HealedZone*uTraceHealed*(2.-p3Side*.82),0.,1.);','p3Healed=clamp(p3A.b*p3HealedZone*uTraceHealed*(2.-p3Side*.82)*1.20,0.,1.);','healed visibility');
 T.colour=patch(T.colour,'p3Razor=clamp(p3A.a*p3ShaveZone*uTraceShave*p3Side,0.,1.);','p3Razor=clamp(p3A.a*p3ShaveZone*uTraceShave*p3Side*1.18,0.,1.);','razor visibility');
 T.colour=patch(T.colour,'p3Follicle=clamp(p3B.r*p3ShaveZone*uTraceShave*(.70+.30*p3Side),0.,1.);','p3Follicle=clamp(p3B.r*p3ShaveZone*uTraceShave*(.70+.30*p3Side)*1.48,0.,1.);','follicle visibility');
 T.colour=patch(T.colour,'p3Scar=clamp(p3B.g*p3HealedZone*uTraceScar*(2.-p3Side*.76),0.,1.);','p3Scar=clamp(p3B.g*p3HealedZone*uTraceScar*(2.-p3Side*.76)*3.00,0.,1.);','scar visibility');
 T.colour=patch(T.colour,
  'p3Paint*=1.+p3Mottle*vec3(.032,-.010,-.018);',
  'p3Paint*=1.+p3Mottle*vec3(.032,-.010,-.018);\n p3Paint*=mix(vec3(1.),vec3(.88,.91,.95),p3ShaveBed);',
  'diffuse shaved bed');
 T.colour=patch(T.colour,'vec3(1.075,.77,.79),p3AcneHalo*.52','vec3(1.10,.70,.72),p3AcneHalo*.68','acne halo colour');
 T.colour=patch(T.colour,'vec3(1.09,.66,.68),p3AcneCore*.62','vec3(1.14,.54,.57),p3AcneCore*.78','acne core colour');
 T.colour=patch(T.colour,'p3Paint*=mix(vec3(1.),p3Post,p3Healed*.48);','p3Paint*=mix(vec3(1.),p3Post,p3Healed*.62);','healed colour');
 T.colour=patch(T.colour,'vec3(1.035,.82,.84),p3Razor*.38','vec3(1.045,.75,.78),p3Razor*.52','razor colour');
 T.colour=patch(T.colour,'vec3(.48,.57,.63),p3Follicle*.38','vec3(.38,.46,.53),p3Follicle*.56','follicle colour');
 T.colour=patch(T.colour,'vec3(.89,.84,.955),p3Eye*.28','vec3(.91,.87,.96),p3Eye*.17','eye colour restraint');
 T.colour=patch(T.colour,'vec3(.91,.86,.88),p3Scar*.13','vec3(.82,.78,.82),p3Scar*.32','scar colour');
 T.colour=patch(T.colour,'else p3Dbg=vec3(p3TraceMask,p3Mottle*.5+.5,p3Scar);','else p3Dbg=vec3(p3TraceMask,clamp(abs(p3Mottle)*3.,0.,1.),p3Scar);','combined debug neutrality');

 T.surface=patch(T.surface,
  'float p3LocalRough=roughnessFactor-p3AcneCore*.035+p3Healed*.010+p3Razor*.052+p3Follicle*.020+p3Scar*.022+p3Eye*.012;',
  'float p3LocalRough=roughnessFactor-p3AcneCore*.052+p3Healed*.014+p3Razor*.065+p3Follicle*.025+p3Scar*.040+p3Eye*.006;',
  'correlated roughness');
 T.surface=patch(T.surface,
  'float p3Height=(p3AcneCore*.00024-p3Scar*.000105)*uTraceAmount;',
  'float p3Height=(p3AcneCore*.00031-p3Scar*.00022)*uTraceAmount;',
  'correlated height');
})();
