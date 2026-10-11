export const TEACHER_CONTROLS={
 brows:[
 ['browsSpan','眉形跨度 / 长短',75,120,1,100],
 ['browsThickness','眉形厚薄',50,150,1,100],
 ['browsArch','眉峰高度（0.1 mm）',-25,25,1,0],
 ['browsHeight','整眉高度（0.1 mm）',-20,30,1,0],
 ['browsTail','眉尾高低（0.1 mm）',-20,20,1,0],
 ['browsDirection','单丝梳理角度（度）',-20,20,1,0],
 ['browsLift','贴肤 / 蓬松比例',0,20,1,10]
 ],
 detail:[
 ['hairWave','波纹幅度（0.1 mm）',0,30,1,0],
 ['hairMicroCurl','微卷幅度（0.1 mm）',0,10,1,0],
 ['hairWavePeriod','波纹周期（mm）',8,60,1,28],
 ['hairDetailSmoothing','细节平滑',0,100,1,35]
 ]
};
export const TEACHER_DEFAULTS={browsModel:1,...Object.fromEntries(Object.values(TEACHER_CONTROLS).flat().map(r=>[r[0],r[5]]))};
