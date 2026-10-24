const DATA={
  "version": "R16",
  "purpose": "internal whole-system evidence/contract study; not full replica",
  "sources": {
    "LNER1935": {
      "url": "https://theengineer.markallengroup.com/production/2018/09/Gresley-Silver-Jubilee.pdf",
      "scope": "LNER supplied description, Silver Link first four engines, 1935; NOT 60009 exact later configuration"
    },
    "SNG2022": {
      "url": "https://www.sirnigelgresley.org.uk/overhaul-1522/overhaul-20.shtml",
      "scope": "60007 preservation overhaul2022; mechanism evidence only"
    },
    "SNG2023": {
      "url": "https://www.sirnigelgresley.org.uk/eng-reports/eng-23-a.shtml",
      "scope": "60007 2023; middle driver/crank axle and Cartazzi maintenance"
    },
    "NRM35": {
      "url": "https://blog.railwaymuseum.org.uk/sir-nigel-gresley-overhaul-update-35/",
      "scope": "60007 alignment: cylinder axes pass through driver centre; slidebars parallel"
    },
    "NRM52": {
      "url": "https://blog.railwaymuseum.org.uk/sir-nigel-gresley-overhaul-update-52/",
      "scope": "60007 2020 actual valve gear fitting/union links; not ideal dimensional symmetry"
    },
    "KESR": {
      "url": "https://kesr-mic.org.uk/resources/Injectors.pdf",
      "scope": "generic steam injector mechanism, not A4 brand/layout"
    },
    "R15": {
      "url": null,
      "scope": "own previous computed local-joint experiment; inferred geometry, not historical evidence"
    },
    "DIDCOT_HEAT": {
      "url": "https://didcotrailwaycentre.org.uk/article.php/398/going-loco-june-2020",
      "scope": "railway centre generic boiler/heat explanation"
    },
    "DIDCOT_DRAUGHT": {
      "url": "https://didcotrailwaycentre.org.uk/article.php/439/going-loco-december-2020",
      "scope": "railway centre generic draught explanation"
    },
    "SNG_SUPPORT": {
      "url": "https://www.sirnigelgresley.org.uk/overhaul-1522/overhaul-12.shtml",
      "scope": "60007 axleboxes/horns/spring hangers"
    },
    "SNG_DRAWBAR": {
      "url": "https://sirnigelgresley.org.uk/overhaul-1522/overhaul-05.shtml",
      "scope": "60007 primary drawbar vs unloaded backup safety links"
    },
    "SNG_COUPLING": {
      "url": "https://www.sirnigelgresley.org.uk/eng-reports/eng-25-b.shtml",
      "scope": "60007 coupling rods/knuckle vs separate main rod"
    },
    "SNG_MIDDLE": {
      "url": "https://sirnigelgresley.org.uk/overhaul-1522/overhaul-01.shtml",
      "scope": "60007 inside cylinder behind/above outside cylinders"
    },
    "BESTT": {
      "url": "https://www.bestt.org.uk/_files/ugd/2e4fbf_6acf246cee1f4b7a982b57f8395b054c.pdf",
      "scope": "generic Gresley training: inclined cylinder needs crank correction; not A4 exact calibration"
    },
    "NRM_DRAWINGS": {
      "url": "https://www.railwaymuseum.org.uk/sites/default/files/2018-05/Doncaster-Locomotive-Drawings-Microfilm-Lists-0518.pdf",
      "scope": "catalogue only, no original drawings inspected; Q104 generalarrangement; T220/T644 crankaxle; S319 insiderod; S332 couplingrod"
    }
  },
  "nodes": [
    {
      "id": "coal",
      "label": "煤仓储备",
      "system": "fuel"
    },
    {
      "id": "firebox",
      "label": "炉膛/炉排",
      "system": "fuel"
    },
    {
      "id": "ashpan",
      "label": "灰箱/进风",
      "system": "fuel"
    },
    {
      "id": "gas_tubes",
      "label": "烟管与大烟管内烟气",
      "system": "fuel"
    },
    {
      "id": "smokebox",
      "label": "烟箱",
      "system": "fuel"
    },
    {
      "id": "chimney",
      "label": "烟囱排出",
      "system": "fuel"
    },
    {
      "id": "water",
      "label": "煤水车水箱",
      "system": "water"
    },
    {
      "id": "injector",
      "label": "注水器",
      "system": "water"
    },
    {
      "id": "check",
      "label": "给水止回阀",
      "system": "water"
    },
    {
      "id": "boiler_water",
      "label": "锅炉水空间",
      "system": "water"
    },
    {
      "id": "steam_space",
      "label": "锅炉汽空间/集汽",
      "system": "steam"
    },
    {
      "id": "regulator",
      "label": "调节阀",
      "system": "steam"
    },
    {
      "id": "main_pipe",
      "label": "主蒸汽管",
      "system": "steam"
    },
    {
      "id": "superheater",
      "label": "过热器/集箱",
      "system": "steam"
    },
    {
      "id": "blastpipe",
      "label": "排汽喷管",
      "system": "exhaust"
    },
    {
      "id": "blower",
      "label": "鼓风器",
      "system": "exhaust"
    },
    {
      "id": "reverser",
      "label": "换向/截汽控制",
      "system": "control"
    },
    {
      "id": "frame",
      "label": "主车架",
      "system": "support"
    },
    {
      "id": "spring",
      "label": "弹簧/吊架",
      "system": "support"
    },
    {
      "id": "axlebox",
      "label": "轴箱/导框",
      "system": "support"
    },
    {
      "id": "front_bogie",
      "label": "前导向转向架两轴",
      "system": "support"
    },
    {
      "id": "rear_cartazzi",
      "label": "后支承Cartazzi一轴",
      "system": "support"
    },
    {
      "id": "driver_front",
      "label": "前耦合轴",
      "system": "drive"
    },
    {
      "id": "driver_middle",
      "label": "中间驱动曲轴",
      "system": "drive"
    },
    {
      "id": "driver_rear",
      "label": "后耦合轴",
      "system": "drive"
    },
    {
      "id": "rails",
      "label": "轮轨接触",
      "system": "support"
    },
    {
      "id": "drawbar",
      "label": "机车煤水车牵引连接",
      "system": "support"
    },
    {
      "id": "tender",
      "label": "煤水车车架",
      "system": "support"
    },
    {
      "id": "brake",
      "label": "制动缸/杠杆/闸瓦",
      "system": "control"
    },
    {
      "id": "gresley",
      "label": "Gresley等臂及2:1杠杆",
      "system": "control"
    },
    {
      "id": "left_valve",
      "label": "左配汽阀/汽室",
      "system": "steam"
    },
    {
      "id": "left_cylinder",
      "label": "左汽缸/活塞",
      "system": "steam"
    },
    {
      "id": "left_crosshead",
      "label": "左十字头/导轨",
      "system": "drive"
    },
    {
      "id": "left_rod",
      "label": "左主连杆",
      "system": "drive"
    },
    {
      "id": "left_walschaerts",
      "label": "左Walschaerts配汽机构",
      "system": "control"
    },
    {
      "id": "left_coupling",
      "label": "左耦合杆",
      "system": "drive"
    },
    {
      "id": "middle_valve",
      "label": "中配汽阀/汽室",
      "system": "steam"
    },
    {
      "id": "middle_cylinder",
      "label": "中汽缸/活塞",
      "system": "steam"
    },
    {
      "id": "middle_crosshead",
      "label": "中十字头/导轨",
      "system": "drive"
    },
    {
      "id": "middle_rod",
      "label": "中主连杆",
      "system": "drive"
    },
    {
      "id": "right_valve",
      "label": "右配汽阀/汽室",
      "system": "steam"
    },
    {
      "id": "right_cylinder",
      "label": "右汽缸/活塞",
      "system": "steam"
    },
    {
      "id": "right_crosshead",
      "label": "右十字头/导轨",
      "system": "drive"
    },
    {
      "id": "right_rod",
      "label": "右主连杆",
      "system": "drive"
    },
    {
      "id": "right_walschaerts",
      "label": "右Walschaerts配汽机构",
      "system": "control"
    },
    {
      "id": "right_coupling",
      "label": "右耦合杆",
      "system": "drive"
    }
  ],
  "edges": [
    {
      "from": "coal",
      "to": "firebox",
      "kind": "fuel",
      "relation": "燃料供给，不是驱动杆直接动力",
      "source": "LNER1935",
      "status": "documented-mechanism"
    },
    {
      "from": "ashpan",
      "to": "firebox",
      "kind": "air",
      "relation": "空气进入炉排下方；灰收集另路",
      "source": "LNER1935",
      "status": "documented-mechanism"
    },
    {
      "from": "firebox",
      "to": "gas_tubes",
      "kind": "gas",
      "relation": "燃烧烟气经过管内，非水/蒸汽通道",
      "source": "DIDCOT_HEAT",
      "status": "documented-generic-mechanism"
    },
    {
      "from": "gas_tubes",
      "to": "smokebox",
      "kind": "gas",
      "relation": "烟气汇入烟箱",
      "source": "DIDCOT_HEAT",
      "status": "documented-generic-mechanism"
    },
    {
      "from": "smokebox",
      "to": "chimney",
      "kind": "gas",
      "relation": "烟气排出",
      "source": "DIDCOT_HEAT",
      "status": "documented-generic-mechanism"
    },
    {
      "from": "firebox",
      "to": "boiler_water",
      "kind": "heat",
      "relation": "隔壁传热，不把火/水混为同一路",
      "source": "DIDCOT_HEAT",
      "status": "documented-generic-mechanism"
    },
    {
      "from": "gas_tubes",
      "to": "boiler_water",
      "kind": "heat",
      "relation": "管壁向周围水传热",
      "source": "DIDCOT_HEAT",
      "status": "documented-generic-mechanism"
    },
    {
      "from": "water",
      "to": "injector",
      "kind": "water",
      "relation": "水箱供水",
      "source": "KESR",
      "status": "documented-mechanism"
    },
    {
      "from": "steam_space",
      "to": "injector",
      "kind": "steam",
      "relation": "示意活蒸汽注水器分支；不冒称两侧同型",
      "source": "KESR",
      "status": "documented-mechanism"
    },
    {
      "from": "injector",
      "to": "check",
      "kind": "water",
      "relation": "混合/增压后的给水经止回阀",
      "source": "KESR",
      "status": "documented-mechanism"
    },
    {
      "from": "check",
      "to": "boiler_water",
      "kind": "water",
      "relation": "防止锅炉水汽倒流",
      "source": "KESR",
      "status": "documented-mechanism"
    },
    {
      "from": "boiler_water",
      "to": "steam_space",
      "kind": "phase-change",
      "relation": "受热蒸发",
      "source": "DIDCOT_HEAT",
      "status": "documented-generic-mechanism"
    },
    {
      "from": "steam_space",
      "to": "regulator",
      "kind": "steam",
      "relation": "集汽后节流",
      "source": "SNG2022",
      "status": "documented-mechanism"
    },
    {
      "from": "regulator",
      "to": "main_pipe",
      "kind": "steam",
      "relation": "控制供汽量",
      "source": "SNG2022",
      "status": "documented-mechanism"
    },
    {
      "from": "main_pipe",
      "to": "superheater",
      "kind": "steam",
      "relation": "饱和汽到过热器入口",
      "source": "SNG2022",
      "status": "documented-mechanism"
    },
    {
      "from": "gas_tubes",
      "to": "superheater",
      "kind": "heat",
      "relation": "烟气间接向元件内蒸汽加热",
      "source": "SNG2022",
      "status": "documented-mechanism"
    },
    {
      "from": "superheater",
      "to": "left_valve",
      "kind": "steam",
      "relation": "各缸独立蒸汽管；三缸并联，非串联复胀",
      "source": "LNER1935",
      "status": "documented-mechanism"
    },
    {
      "from": "left_valve",
      "to": "left_cylinder",
      "kind": "steam",
      "relation": "交替控制活塞两端进汽/排汽",
      "source": "LNER1935",
      "status": "inferred-standard-flow"
    },
    {
      "from": "left_cylinder",
      "to": "blastpipe",
      "kind": "exhaust",
      "relation": "经配汽阀与排汽通道汇合",
      "source": "SNG2022",
      "status": "documented-mechanism"
    },
    {
      "from": "left_cylinder",
      "to": "left_crosshead",
      "kind": "mechanical",
      "relation": "活塞杆轴向推拉；导轨承侧向力",
      "source": "NRM35",
      "status": "documented-mechanism"
    },
    {
      "from": "left_crosshead",
      "to": "left_rod",
      "kind": "mechanical",
      "relation": "小端转动副传力",
      "source": "R15",
      "status": "own-inferred-and-tested"
    },
    {
      "from": "left_rod",
      "to": "driver_middle",
      "kind": "mechanical",
      "relation": "大端作用中间驱动轴曲柄/曲轴",
      "source": "SNG2023",
      "status": "inferred-from-primary-assembly"
    },
    {
      "from": "left_crosshead",
      "to": "frame",
      "kind": "support",
      "relation": "导轨通过支座连接车架，非自由漂浮",
      "source": "NRM35",
      "status": "documented-mechanism"
    },
    {
      "from": "driver_middle",
      "to": "left_coupling",
      "kind": "mechanical",
      "relation": "同侧主曲柄带动耦合杆",
      "source": "SNG_COUPLING",
      "status": "inferred-standard-kinematics"
    },
    {
      "from": "left_coupling",
      "to": "driver_front",
      "kind": "mechanical",
      "relation": "同侧三组曲柄等相位，耦合轴同步",
      "source": "SNG_COUPLING",
      "status": "inferred-standard-kinematics"
    },
    {
      "from": "left_coupling",
      "to": "driver_rear",
      "kind": "mechanical",
      "relation": "同侧三组曲柄等相位，耦合轴同步",
      "source": "SNG_COUPLING",
      "status": "inferred-standard-kinematics"
    },
    {
      "from": "driver_middle",
      "to": "left_walschaerts",
      "kind": "control",
      "relation": "回动曲柄/偏心杆提供周期输入",
      "source": "NRM52",
      "status": "documented-mechanism"
    },
    {
      "from": "left_crosshead",
      "to": "left_walschaerts",
      "kind": "control",
      "relation": "union link/combination lever第二输入",
      "source": "NRM52",
      "status": "documented-mechanism"
    },
    {
      "from": "reverser",
      "to": "left_walschaerts",
      "kind": "control",
      "relation": "调节配汽行程与方向",
      "source": "LNER1935",
      "status": "documented-mechanism"
    },
    {
      "from": "left_walschaerts",
      "to": "left_valve",
      "kind": "control",
      "relation": "驱动外侧阀杆，不直接产生牵引动力",
      "source": "LNER1935",
      "status": "documented-mechanism"
    },
    {
      "from": "left_valve",
      "to": "gresley",
      "kind": "control",
      "relation": "外侧阀杆位移输入共轭机构",
      "source": "LNER1935",
      "status": "documented-mechanism"
    },
    {
      "from": "superheater",
      "to": "middle_valve",
      "kind": "steam",
      "relation": "各缸独立蒸汽管；三缸并联，非串联复胀",
      "source": "LNER1935",
      "status": "documented-mechanism"
    },
    {
      "from": "middle_valve",
      "to": "middle_cylinder",
      "kind": "steam",
      "relation": "交替控制活塞两端进汽/排汽",
      "source": "LNER1935",
      "status": "inferred-standard-flow"
    },
    {
      "from": "middle_cylinder",
      "to": "blastpipe",
      "kind": "exhaust",
      "relation": "经配汽阀与排汽通道汇合",
      "source": "SNG2022",
      "status": "documented-mechanism"
    },
    {
      "from": "middle_cylinder",
      "to": "middle_crosshead",
      "kind": "mechanical",
      "relation": "活塞杆轴向推拉；导轨承侧向力",
      "source": "NRM35",
      "status": "documented-mechanism"
    },
    {
      "from": "middle_crosshead",
      "to": "middle_rod",
      "kind": "mechanical",
      "relation": "小端转动副传力",
      "source": "R15",
      "status": "own-inferred-and-tested"
    },
    {
      "from": "middle_rod",
      "to": "driver_middle",
      "kind": "mechanical",
      "relation": "大端作用中间驱动轴曲柄/曲轴",
      "source": "SNG2023",
      "status": "inferred-from-primary-assembly"
    },
    {
      "from": "middle_crosshead",
      "to": "frame",
      "kind": "support",
      "relation": "导轨通过支座连接车架，非自由漂浮",
      "source": "NRM35",
      "status": "documented-mechanism"
    },
    {
      "from": "superheater",
      "to": "right_valve",
      "kind": "steam",
      "relation": "各缸独立蒸汽管；三缸并联，非串联复胀",
      "source": "LNER1935",
      "status": "documented-mechanism"
    },
    {
      "from": "right_valve",
      "to": "right_cylinder",
      "kind": "steam",
      "relation": "交替控制活塞两端进汽/排汽",
      "source": "LNER1935",
      "status": "inferred-standard-flow"
    },
    {
      "from": "right_cylinder",
      "to": "blastpipe",
      "kind": "exhaust",
      "relation": "经配汽阀与排汽通道汇合",
      "source": "SNG2022",
      "status": "documented-mechanism"
    },
    {
      "from": "right_cylinder",
      "to": "right_crosshead",
      "kind": "mechanical",
      "relation": "活塞杆轴向推拉；导轨承侧向力",
      "source": "NRM35",
      "status": "documented-mechanism"
    },
    {
      "from": "right_crosshead",
      "to": "right_rod",
      "kind": "mechanical",
      "relation": "小端转动副传力",
      "source": "R15",
      "status": "own-inferred-and-tested"
    },
    {
      "from": "right_rod",
      "to": "driver_middle",
      "kind": "mechanical",
      "relation": "大端作用中间驱动轴曲柄/曲轴",
      "source": "SNG2023",
      "status": "inferred-from-primary-assembly"
    },
    {
      "from": "right_crosshead",
      "to": "frame",
      "kind": "support",
      "relation": "导轨通过支座连接车架，非自由漂浮",
      "source": "NRM35",
      "status": "documented-mechanism"
    },
    {
      "from": "driver_middle",
      "to": "right_coupling",
      "kind": "mechanical",
      "relation": "同侧主曲柄带动耦合杆",
      "source": "SNG_COUPLING",
      "status": "inferred-standard-kinematics"
    },
    {
      "from": "right_coupling",
      "to": "driver_front",
      "kind": "mechanical",
      "relation": "同侧三组曲柄等相位，耦合轴同步",
      "source": "SNG_COUPLING",
      "status": "inferred-standard-kinematics"
    },
    {
      "from": "right_coupling",
      "to": "driver_rear",
      "kind": "mechanical",
      "relation": "同侧三组曲柄等相位，耦合轴同步",
      "source": "SNG_COUPLING",
      "status": "inferred-standard-kinematics"
    },
    {
      "from": "driver_middle",
      "to": "right_walschaerts",
      "kind": "control",
      "relation": "回动曲柄/偏心杆提供周期输入",
      "source": "NRM52",
      "status": "documented-mechanism"
    },
    {
      "from": "right_crosshead",
      "to": "right_walschaerts",
      "kind": "control",
      "relation": "union link/combination lever第二输入",
      "source": "NRM52",
      "status": "documented-mechanism"
    },
    {
      "from": "reverser",
      "to": "right_walschaerts",
      "kind": "control",
      "relation": "调节配汽行程与方向",
      "source": "LNER1935",
      "status": "documented-mechanism"
    },
    {
      "from": "right_walschaerts",
      "to": "right_valve",
      "kind": "control",
      "relation": "驱动外侧阀杆，不直接产生牵引动力",
      "source": "LNER1935",
      "status": "documented-mechanism"
    },
    {
      "from": "right_valve",
      "to": "gresley",
      "kind": "control",
      "relation": "外侧阀杆位移输入共轭机构",
      "source": "LNER1935",
      "status": "documented-mechanism"
    },
    {
      "from": "gresley",
      "to": "middle_valve",
      "kind": "control",
      "relation": "等臂+2:1杠杆导出中阀运动，非第三套独立Walschaerts",
      "source": "LNER1935",
      "status": "documented-mechanism"
    },
    {
      "from": "blastpipe",
      "to": "chimney",
      "kind": "exhaust",
      "relation": "废汽喷出",
      "source": "SNG2022",
      "status": "documented-mechanism"
    },
    {
      "from": "blastpipe",
      "to": "smokebox",
      "kind": "draught",
      "relation": "喷流诱导抽吸，反馈炉膛气流",
      "source": "DIDCOT_DRAUGHT",
      "status": "documented-generic-mechanism"
    },
    {
      "from": "steam_space",
      "to": "blower",
      "kind": "steam",
      "relation": "独立鼓风器支路",
      "source": "SNG2022",
      "status": "documented-mechanism"
    },
    {
      "from": "blower",
      "to": "smokebox",
      "kind": "draught",
      "relation": "辅助抽吸，不等于三缸排汽",
      "source": "DIDCOT_DRAUGHT",
      "status": "documented-generic-mechanism"
    },
    {
      "from": "frame",
      "to": "spring",
      "kind": "support",
      "relation": "承载/导向关系，非刚性全锁死",
      "source": "SNG_SUPPORT",
      "status": "inferred-standard-structure"
    },
    {
      "from": "spring",
      "to": "axlebox",
      "kind": "support",
      "relation": "承载/导向关系，非刚性全锁死",
      "source": "SNG_SUPPORT",
      "status": "inferred-standard-structure"
    },
    {
      "from": "axlebox",
      "to": "driver_front",
      "kind": "support",
      "relation": "承载/导向关系，非刚性全锁死",
      "source": "SNG_SUPPORT",
      "status": "inferred-standard-structure"
    },
    {
      "from": "axlebox",
      "to": "driver_middle",
      "kind": "support",
      "relation": "承载/导向关系，非刚性全锁死",
      "source": "SNG_SUPPORT",
      "status": "inferred-standard-structure"
    },
    {
      "from": "axlebox",
      "to": "driver_rear",
      "kind": "support",
      "relation": "承载/导向关系，非刚性全锁死",
      "source": "SNG_SUPPORT",
      "status": "inferred-standard-structure"
    },
    {
      "from": "frame",
      "to": "front_bogie",
      "kind": "support",
      "relation": "承载/导向关系，非刚性全锁死",
      "source": "SNG_SUPPORT",
      "status": "inferred-standard-structure"
    },
    {
      "from": "frame",
      "to": "rear_cartazzi",
      "kind": "support",
      "relation": "承载/导向关系，非刚性全锁死",
      "source": "SNG_SUPPORT",
      "status": "inferred-standard-structure"
    },
    {
      "from": "driver_front",
      "to": "rails",
      "kind": "support",
      "relation": "载荷经轮轨接触传地面",
      "source": "SNG_SUPPORT",
      "status": "inferred-standard-structure"
    },
    {
      "from": "driver_middle",
      "to": "rails",
      "kind": "support",
      "relation": "载荷经轮轨接触传地面",
      "source": "SNG_SUPPORT",
      "status": "inferred-standard-structure"
    },
    {
      "from": "driver_rear",
      "to": "rails",
      "kind": "support",
      "relation": "载荷经轮轨接触传地面",
      "source": "SNG_SUPPORT",
      "status": "inferred-standard-structure"
    },
    {
      "from": "front_bogie",
      "to": "rails",
      "kind": "support",
      "relation": "载荷经轮轨接触传地面",
      "source": "SNG_SUPPORT",
      "status": "inferred-standard-structure"
    },
    {
      "from": "rear_cartazzi",
      "to": "rails",
      "kind": "support",
      "relation": "载荷经轮轨接触传地面",
      "source": "SNG_SUPPORT",
      "status": "inferred-standard-structure"
    },
    {
      "from": "frame",
      "to": "drawbar",
      "kind": "traction",
      "relation": "车架牵引力传入连接",
      "source": "SNG_DRAWBAR",
      "status": "inferred-standard-structure"
    },
    {
      "from": "drawbar",
      "to": "tender",
      "kind": "traction",
      "relation": "传递纵向牵引/缓冲载荷",
      "source": "SNG_DRAWBAR",
      "status": "inferred-standard-structure"
    },
    {
      "from": "brake",
      "to": "driver_middle",
      "kind": "braking",
      "relation": "闸瓦摩擦制动；不是把蒸汽管断开就等于制动",
      "source": "LNER1935",
      "status": "documented-mechanism"
    }
  ],
  "unknown": [
    "60009 exact cylinder inclinations and physical crankphase signs",
    "60009 wheelbase/source-scale metric calibration",
    "full valvegear lengths,pivots,lap,lead and port timing",
    "thermodynamic state,steam flow and actual torque not solved",
    "complete source mesh part mapping not restored or reverified this increment",
    "all structural shapes/fasteners and boiler/tender internal geometry not reconstructed"
  ],
  "source_model_mapping": [
    {
      "candidate": "N94 BigWheelMiddle",
      "role": "D2 outside drivingwheel candidate",
      "evidence": "inherited R12/R13 measurements; raw source not reloaded in R16",
      "status": "prior-observed-candidate"
    },
    {
      "candidate": "N98 Cylinder.017_40 mesh63",
      "role": "outside main connectingrod candidate",
      "evidence": "R12/R13; smallend surface not reliable truejoint; R14/R15 independent reconstruction",
      "status": "prior-observed-candidate"
    },
    {
      "candidate": "N100 Back&ForthFront mesh64",
      "role": "pistonrod/crosshead composite candidate",
      "evidence": "R13 component split; not authornode treated semantic truth",
      "status": "prior-observed-candidate"
    },
    {
      "candidate": "N258 StaticWHeelParts mesh156",
      "role": "guide candidate",
      "evidence": "priorgeometryrelationship; not complete semantic identification",
      "status": "prior-observed-candidate"
    },
    {
      "candidate": null,
      "role": "middle cylinder,inside crankjournal,conjugatedgear,boiler flow,tender feeds",
      "evidence": "primary mechanical sources; source-model nodes unresolved",
      "status": "unknown-source-mapping"
    }
  ]
};
const QA={
  "version": "R16",
  "tests_run": 11,
  "passed": true,
  "fixtures": [
    [
      [
        0,
        1.7,
        4.3
      ],
      [
        0,
        0.11,
        0
      ]
    ],
    [
      [
        0.3,
        2.8,
        5.1
      ],
      [
        0.02,
        0.19,
        -0.01
      ]
    ],
    [
      [
        0,
        2.2,
        4.1
      ],
      [
        0,
        0,
        0
      ]
    ]
  ],
  "fixture_status": "synthetic stress tests NOT historical A4 angles",
  "phase_samples": 721,
  "mechanical_scope": "three closed sliders and two side couplings in fixed straight frame; not suspension or collision validation",
  "thermal_scope": "graph reachability and medium separation only; no thermal solver"
};