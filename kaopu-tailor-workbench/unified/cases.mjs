export const CASES={
 swatch:{id:'swatch',title:'直缝布片',kind:'swatch',params:[['width','裁片宽',80,240,10,150],['height','净缝长',100,300,10,220]],hint:'两片毫米材料与真实接缝；10 mm 缝份材料参与网格，尚未折转。',source:'./README.md'},
 structured:{id:'structured',title:'曲缝规范',kind:'structured',params:[],hint:'手工 JSON → 三片曲边材料 → 分段接缝。不是照片 AI 推理。',source:'./structured/README.md'},
 shorts:{id:'shorts',title:'基础短裤',kind:'garment',dir:'garments-r03',schema:'kaopu-short-recipe@1',stages:['darts','rises','legs','waist'],params:[['legDeltaMm','裤长调整',-60,60,10,0],['waistEaseMm','腰口新增松量',0,40,10,0]],hint:'6 片 / 28 组缝边 / 6 省道。有限裤长和腰口改版，重新二维剖分。'},
 sleeveless:{id:'sleeveless',title:'无袖上衣',kind:'garment',dir:'garments-r04',schema:'kaopu-basic-top-recipe@1',params:[['bodyLengthDeltaMm','衣长调整',-50,80,10,0],['hemEaseMm','下摆新增松量',0,120,10,0]],hint:'4 片 / 6 组缝边。保留肩、领口和袖窿；重新二维剖分。'},
 shortsleeve:{id:'shortsleeve',title:'短袖上衣',kind:'garment',dir:'garments-r05',schema:'kaopu-short-sleeve-recipe@1',params:[['bodyLengthDeltaMm','衣长调整',-50,80,10,0],['sleeveLengthDeltaMm','袖长调整',-30,50,10,0]],hint:'8 片 / 16 组缝边。所有材料 UV 随尺寸更新，保留已验证的二维三角连接。'}
};
export const STAGE_LABELS={cut:'裁出真实材料',centers:'合前后中线',sleeve_tubes:'合左右袖筒',shoulders:'合肩缝',armholes:'装配袖窿',sides:'合侧缝',darts:'缝合省道',rises:'合前后裆缝',legs:'合左右裤腿',waist:'装配腰头',release:'释放工装 · 重力观察',join:'激活直缝'};
export function defaults(c){return Object.fromEntries(c.params.map(p=>[p[0],p[5]]));}
export function checkControls(c,values){for(const[k,,lo,hi]of c.params)if(!Number.isFinite(values[k])||values[k]<lo||values[k]>hi)throw Error('尺寸超出 '+c.title+' 的已声明范围');return values;}
