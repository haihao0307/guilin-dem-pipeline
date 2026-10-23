import {OFFICIAL_FACE_TEXTURES} from "./official-face-textures.mjs";
/* Actual-photo evidence, not model-render substitutes. Generated from reviewed source ledgers. */
export const PHOTO_EVIDENCE = {
  "schema": "kaopu.building-photo-evidence/1",
  "revision": "r05-20261023",
  "verifiedAt": "2026-10-23",
  "coordinateFrame": "source_local_east_up_south_metres",
  "displayPolicy": {
    "noGeneratedSubstitute": true,
    "noUnauthorizedBundledImages": true,
    "linkOnlyIsNotPhotoDisplay": true,
    "noNormalOnlyPhotoAssignment": true,
    "historicalDatesMustStaySeparate": true
  },
  "buildings": {
    "lowrise": {
      "label": "喇沙利道33號",
      "modelId": "B367642137201063C0",
      "photoIds": [
        "lowrise-google-2023-12",
        "lowrise-google-2016-12",
        "lowrise-google-2011-02",
        "lowrise-centaline-streetview",
        "lowrise-oneday-1",
        "lowrise-oneday-2",
        "lowrise-oneday-3"
      ],
      "sourceDataset": "3D Visualisation Map (Non-textured models)",
      "identityNotice": "以GeoRefNo3676421372和精确源锚点核对；旧OBJECTID47805已失效，不再用其作为本楼身份链接。",
      "faces": [
        {
          "id": "east-frontage",
          "label": "东向主立面",
          "sourcePatchIds": [
            "p112",
            "p114"
          ],
          "photoIds": [
            "lowrise-google-2023-12",
            "lowrise-google-2016-12",
            "lowrise-google-2011-02",
            "lowrise-centaline-streetview"
          ],
          "orientationConfidence": "verified_frontage_tentative_pixel_registration",
          "coverage": "东侧临街主墙，不包含所有同朝向凹面、内表面或No.31。"
        },
        {
          "id": "east-frontage-assembly",
          "label": "东向主立面前的挑盖／围护",
          "sourcePatchIds": [
            "p097",
            "p098",
            "p099",
            "p100",
            "p101",
            "p102",
            "p103",
            "p104",
            "p105",
            "p106",
            "p107",
            "p108",
            "p109",
            "p110"
          ],
          "photoIds": [
            "lowrise-google-2023-12",
            "lowrise-google-2016-12",
            "lowrise-google-2011-02"
          ],
          "orientationConfidence": "assembly_context_only",
          "coverage": "照片显示总成外观；不能据此外推被遮挡内面、平台顶面或盖顶面各自实拍。"
        }
      ]
    },
    "kcc": {
      "label": "龍總大廈 / KCC",
      "modelId": "B359971994401063C0",
      "photoIds": [
        "kcc-centaline-s11",
        "kcc-centaline-s12",
        "kcc-centaline-selected-streetview",
        "kcc-oneday-TqZoswhSArf",
        "kcc-oneday-MVBXuYTKTdd",
        "kcc-oneday-pZgNwKtxjYX",
        "kcc-oneday-cluhlMpiItA"
      ],
      "sourceDataset": "3D Visualisation Map (Non-textured models)",
      "faces": [],
      "orientationNotice": "存在有定位西北侧街景和多个实拍，但复杂翼面与每一模型面的对应尚未逐面核对。"
    },
    "warehouse": {
      "label": "中旅協記第二倉",
      "modelId": "B369121858401063C0",
      "photoIds": [
        "warehouse-jll-two-elevations"
      ],
      "sourceDataset": "3D Visualisation Map (Non-textured models)",
      "faces": [],
      "orientationNotice": "两侧外观照片的楼号已核对；圆孔侧与横带侧的方位/模型面对应未完成。"
    }
  },
  "photos": [
    {
      "id": "lowrise-google-2023-12",
      "caseId": "lowrise",
      "label": "东向主立面 · Google 街景 2023-12",
      "sourceUrl": "https://www.google.com/maps/@?api=1&map_action=pano&pano=9XP6BUAdazrcL9UxjoPAvg&heading=269&pitch=12&fov=45",
      "originalImageUrl": null,
      "imageUrl": null,
      "dateLabel": "2023-12",
      "captureDate": "2023-12",
      "coverage": "东侧道路向西看主立面、中央挑盖、窗组及下方围护。",
      "caveat": "按源锚点、官方稳定 GeoRefNo、No.33 发布者地图和实拍交叉核对。像素到构件配准仍为暂定；不是现时2026实测。",
      "publisher": "Google",
      "faceIds": [
        "east-frontage"
      ],
      "orientationConfidence": "verified_east_frontage_tentative_patch_registration",
      "publication": "link_only",
      "reuseLicense": null,
      "attributionRequired": true,
      "inspected": true,
      "checkedAt": "2026-10-23",
      "evidenceKind": "actual_published_photograph",
      "notice": "原站实拍，未取得在本工作台转载的许可；请打开原图核对。"
    },
    {
      "id": "lowrise-google-2016-12",
      "caseId": "lowrise",
      "label": "东向主立面 · Google 街景 2016-12",
      "sourceUrl": "https://www.google.com/maps/@?api=1&map_action=pano&pano=7B-Fmesvt3R2Gk-XzwVIjg&heading=269&pitch=12&fov=45",
      "originalImageUrl": null,
      "imageUrl": null,
      "dateLabel": "2016-12",
      "captureDate": "2016-12",
      "coverage": "东侧道路向西看主立面、中央挑盖、窗组及下方围护。",
      "caveat": "按源锚点、官方稳定 GeoRefNo、No.33 发布者地图和实拍交叉核对。像素到构件配准仍为暂定；不是现时2026实测。",
      "publisher": "Google",
      "faceIds": [
        "east-frontage"
      ],
      "orientationConfidence": "verified_east_frontage_tentative_patch_registration",
      "publication": "link_only",
      "reuseLicense": null,
      "attributionRequired": true,
      "inspected": true,
      "checkedAt": "2026-10-23",
      "evidenceKind": "actual_published_photograph",
      "notice": "原站实拍，未取得在本工作台转载的许可；请打开原图核对。"
    },
    {
      "id": "lowrise-google-2011-02",
      "caseId": "lowrise",
      "label": "东向主立面 · Google 街景 2011-02",
      "sourceUrl": "https://www.google.com/maps/@?api=1&map_action=pano&pano=ndvmdwbluFSaUc-Wynu9yg&heading=269&pitch=12&fov=35",
      "originalImageUrl": null,
      "imageUrl": null,
      "dateLabel": "2011-02",
      "captureDate": "2011-02",
      "coverage": "东侧道路向西看主立面、中央挑盖、窗组及下方围护。",
      "caveat": "按源锚点、官方稳定 GeoRefNo、No.33 发布者地图和实拍交叉核对。像素到构件配准仍为暂定；不是现时2026实测。",
      "publisher": "Google",
      "faceIds": [
        "east-frontage"
      ],
      "orientationConfidence": "verified_east_frontage_tentative_patch_registration",
      "publication": "link_only",
      "reuseLicense": null,
      "attributionRequired": true,
      "inspected": true,
      "checkedAt": "2026-10-23",
      "evidenceKind": "actual_published_photograph",
      "notice": "原站实拍，未取得在本工作台转载的许可；请打开原图核对。"
    },
    {
      "id": "lowrise-centaline-streetview",
      "caseId": "lowrise",
      "label": "No.33 发布者选定的临街斜视",
      "sourceUrl": "https://hk.centanet.com/estate/en/33-La-Salle-Road/2-UJFDFRSSRO",
      "originalImageUrl": "https://hk.centadata.com/WSStreetViewImages/GetStreetViewImages.ashx?code=UJFDFRSSRO&size=720x720&width=900&width=990",
      "imageUrl": null,
      "dateLabel": "拍摄时间未核实（©2017不是拍摄日期）",
      "captureDate": null,
      "coverage": "与东向主立面、中央挑盖和临街共有大门视觉一致；可见邻近侧墙的少量透视。",
      "caveat": "不把共有大门认作33号主门；侧墙未逐面配准。",
      "publisher": "Centaline / Google",
      "faceIds": [
        "east-frontage"
      ],
      "orientationConfidence": "verified_east_frontage_context",
      "publication": "link_only",
      "reuseLicense": null,
      "attributionRequired": true,
      "inspected": true,
      "checkedAt": "2026-10-23",
      "evidenceKind": "actual_published_photograph",
      "notice": "原站实拍，未取得在本工作台转载的许可；请打开原图核对。"
    },
    {
      "id": "lowrise-oneday-1",
      "caseId": "lowrise",
      "label": "31–33 共有临街大门",
      "sourceUrl": "https://www.oneday.com.hk/en_US/buildings/31-33-la-salle-road/",
      "originalImageUrl": "https://n.oneday.com.hk/im/SDAZTHwMTRG.jpg",
      "imageUrl": null,
      "dateLabel": "拍摄时间不详",
      "captureDate": null,
      "coverage": "31–33 street boundary and gate; No.33 interior door not separately identifiable. A large metal vehicular gate, brick gateposts/beam, small side utility boxes, boundary railings; the address marking 31–33 is visible on the left pillar. Upper façade has windows, external air-conditioning equipment and a projecting horizontal edge.",
      "caveat": "来源归为31–33整体；No.33逐面归属和每个窗的门窗性质不能据此单独确定。",
      "publisher": "OneDay",
      "faceIds": [],
      "orientationConfidence": "compound_frontage_not_patch_registered",
      "publication": "link_only",
      "reuseLicense": null,
      "attributionRequired": true,
      "inspected": true,
      "checkedAt": "2026-10-23",
      "evidenceKind": "actual_published_photograph",
      "notice": "原站实拍，未取得在本工作台转载的许可；请打开原图核对。"
    },
    {
      "id": "lowrise-oneday-2",
      "caseId": "lowrise",
      "label": "临街围栏后的立面斜视",
      "sourceUrl": "https://www.oneday.com.hk/en_US/buildings/31-33-la-salle-road/",
      "originalImageUrl": "https://n.oneday.com.hk/im/WqEbNBROgyq.jpg",
      "imageUrl": null,
      "dateLabel": "拍摄时间不详",
      "captureDate": null,
      "coverage": "Oblique partial façade behind boundary fence, labeled as combined 31–33 premises. Rectangular multi-part windows with security bars, pale external walls, horizontal projecting roof or balcony edges, roof perimeter balustrade, tall boundary metal fence above masonry.",
      "caveat": "来源归为31–33整体；No.33逐面归属和每个窗的门窗性质不能据此单独确定。",
      "publisher": "OneDay",
      "faceIds": [],
      "orientationConfidence": "compound_frontage_not_patch_registered",
      "publication": "link_only",
      "reuseLicense": null,
      "attributionRequired": true,
      "inspected": true,
      "checkedAt": "2026-10-23",
      "evidenceKind": "actual_published_photograph",
      "notice": "原站实拍，未取得在本工作台转载的许可；请打开原图核对。"
    },
    {
      "id": "lowrise-oneday-3",
      "caseId": "lowrise",
      "label": "树荫遮挡的临街宽景",
      "sourceUrl": "https://www.oneday.com.hk/en_US/buildings/31-33-la-salle-road/",
      "originalImageUrl": "https://n.oneday.com.hk/im/NkRmXyWXotL.jpg",
      "imageUrl": null,
      "dateLabel": "拍摄时间不详",
      "captureDate": null,
      "coverage": "Wider low-rise frontage with substantial tree and shadow occlusion, grouped 31–33. Low-rise massing, boundary fence, rooftop balustrade and planted front setback.",
      "caveat": "来源归为31–33整体；No.33逐面归属和每个窗的门窗性质不能据此单独确定。",
      "publisher": "OneDay",
      "faceIds": [],
      "orientationConfidence": "compound_frontage_not_patch_registered",
      "publication": "link_only",
      "reuseLicense": null,
      "attributionRequired": true,
      "inspected": true,
      "checkedAt": "2026-10-23",
      "evidenceKind": "actual_published_photograph",
      "notice": "原站实拍，未取得在本工作台转载的许可；请打开原图核对。"
    },
    {
      "id": "kcc-centaline-s11",
      "caseId": "kcc",
      "label": "商会有字样入口近景",
      "sourceUrl": "https://hk.centanet.com/estate/en/Kowloon-Chamber-Of-Commerce-Building/2-MDZSTHZAHN",
      "originalImageUrl": "https://hkais.centanet.com/PostImages/F8/9D/ECFA97C34C3C890391C121D6D94E-1.jpg?d=1",
      "imageUrl": null,
      "dateLabel": "拍摄时间不详",
      "captureDate": null,
      "coverage": "Signed KCC glazed entrance at the podium. Not proof of its relationship to the residential main lobby or its compass orientation.",
      "caveat": "可与发布者选定西北侧街景作形态对照；未完成逐翼、逐构件配准。入口装修与OneDay旧图不同，不合并为同一日期。",
      "publisher": "Centaline",
      "faceIds": [],
      "orientationConfidence": "northwest_view_context_not_face_registered",
      "publication": "link_only",
      "reuseLicense": null,
      "attributionRequired": true,
      "inspected": true,
      "checkedAt": "2026-10-23",
      "evidenceKind": "actual_published_photograph",
      "notice": "原站实拍，未取得在本工作台转载的许可；请打开原图核对。"
    },
    {
      "id": "kcc-centaline-s12",
      "caseId": "kcc",
      "label": "塔楼与裙房仰视",
      "sourceUrl": "https://hk.centanet.com/estate/en/Kowloon-Chamber-Of-Commerce-Building/2-MDZSTHZAHN",
      "originalImageUrl": "https://hkais.centanet.com/PostImages/7F/FC/94470344494C8509C6B7AFEBDC90-1.jpg?d=1",
      "imageUrl": null,
      "dateLabel": "拍摄时间不详",
      "captureDate": null,
      "coverage": "Tower on larger podium; visible framed rectangular windows and external AC units; not calibrated dimensions.",
      "caveat": "可与发布者选定西北侧街景作形态对照；未完成逐翼、逐构件配准。入口装修与OneDay旧图不同，不合并为同一日期。",
      "publisher": "Centaline",
      "faceIds": [],
      "orientationConfidence": "northwest_view_context_not_face_registered",
      "publication": "link_only",
      "reuseLicense": null,
      "attributionRequired": true,
      "inspected": true,
      "checkedAt": "2026-10-23",
      "evidenceKind": "actual_published_photograph",
      "notice": "原站实拍，未取得在本工作台转载的许可；请打开原图核对。"
    },
    {
      "id": "kcc-centaline-selected-streetview",
      "caseId": "kcc",
      "label": "发布者选定的西北侧街景",
      "sourceUrl": "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=22.3185668,114.17410159999997&heading=109.317715&pitch=7.46707619&fov=28.374496",
      "originalImageUrl": "https://hk.centadata.com/WSStreetViewImages/GetStreetViewImages.ashx?code=MDZSTHZAHN&size=720x720",
      "imageUrl": null,
      "dateLabel": "拍摄时间未核实（©2017不是拍摄日期）",
      "captureDate": null,
      "coverage": "发布者页面的相机位置22.3185668,114.1741016，朝向109.317715°。相机在已核对楼体锚点西北侧，画面同时有塔楼、裙房圆孔与商会门口。",
      "caveat": "相机位置证实观察侧，不代表复杂翼部的每个朝向表面均在照片内；不做按法线自动套图。",
      "publisher": "Centaline / Google",
      "faceIds": [],
      "orientationConfidence": "camera_position_verified_patch_registration_unresolved",
      "publication": "link_only",
      "reuseLicense": null,
      "attributionRequired": true,
      "inspected": true,
      "checkedAt": "2026-10-23",
      "evidenceKind": "actual_published_photograph",
      "notice": "原站实拍，未取得在本工作台转载的许可；请打开原图核对。"
    },
    {
      "id": "kcc-oneday-TqZoswhSArf",
      "caseId": "kcc",
      "label": "塔楼转角与裙房旧外观",
      "sourceUrl": "https://www.oneday.com.hk/en_US/buildings/kowloon-chamber-of-commerce-building/",
      "originalImageUrl": "https://n.oneday.com.hk/im/TqZoswhSArf.jpg",
      "imageUrl": null,
      "dateLabel": "拍摄时间不详",
      "captureDate": null,
      "coverage": "完整塔楼、窗和外置冷气、裙房两个外立面。",
      "caveat": "2026-10-23 已实际查看像素。仅部分视角与定位街景可视觉关联，未逐翼配准；不可把不同翻新状态拼成同一天。",
      "publisher": "OneDay",
      "faceIds": [],
      "orientationConfidence": "building_verified_patch_registration_unresolved",
      "publication": "link_only",
      "reuseLicense": null,
      "attributionRequired": true,
      "inspected": true,
      "checkedAt": "2026-10-23",
      "evidenceKind": "actual_published_photograph",
      "notice": "原站实拍，未取得在本工作台转载的许可；请打开原图核对。"
    },
    {
      "id": "kcc-oneday-MVBXuYTKTdd",
      "caseId": "kcc",
      "label": "商会门口近景旧外观",
      "sourceUrl": "https://www.oneday.com.hk/en_US/buildings/kowloon-chamber-of-commerce-building/",
      "originalImageUrl": "https://n.oneday.com.hk/im/MVBXuYTKTdd.jpg",
      "imageUrl": null,
      "dateLabel": "拍摄时间不详",
      "captureDate": null,
      "coverage": "商会字样、石狮与门口台阶。",
      "caveat": "2026-10-23 已实际查看像素。仅部分视角与定位街景可视觉关联，未逐翼配准；不可把不同翻新状态拼成同一天。",
      "publisher": "OneDay",
      "faceIds": [],
      "orientationConfidence": "building_verified_patch_registration_unresolved",
      "publication": "link_only",
      "reuseLicense": null,
      "attributionRequired": true,
      "inspected": true,
      "checkedAt": "2026-10-23",
      "evidenceKind": "actual_published_photograph",
      "notice": "原站实拍，未取得在本工作台转载的许可；请打开原图核对。"
    },
    {
      "id": "kcc-oneday-pZgNwKtxjYX",
      "caseId": "kcc",
      "label": "入口与裙房圆孔旧外观",
      "sourceUrl": "https://www.oneday.com.hk/en_US/buildings/kowloon-chamber-of-commerce-building/",
      "originalImageUrl": "https://n.oneday.com.hk/im/pZgNwKtxjYX.jpg",
      "imageUrl": null,
      "dateLabel": "拍摄时间不详",
      "captureDate": null,
      "coverage": "门口上方圆孔、框窗及竖向龙总大厦标牌。",
      "caveat": "2026-10-23 已实际查看像素。仅部分视角与定位街景可视觉关联，未逐翼配准；不可把不同翻新状态拼成同一天。",
      "publisher": "OneDay",
      "faceIds": [],
      "orientationConfidence": "building_verified_patch_registration_unresolved",
      "publication": "link_only",
      "reuseLicense": null,
      "attributionRequired": true,
      "inspected": true,
      "checkedAt": "2026-10-23",
      "evidenceKind": "actual_published_photograph",
      "notice": "原站实拍，未取得在本工作台转载的许可；请打开原图核对。"
    },
    {
      "id": "kcc-oneday-cluhlMpiItA",
      "caseId": "kcc",
      "label": "街巷仰视塔楼旧外观",
      "sourceUrl": "https://www.oneday.com.hk/en_US/buildings/kowloon-chamber-of-commerce-building/",
      "originalImageUrl": "https://n.oneday.com.hk/im/cluhlMpiItA.jpg",
      "imageUrl": null,
      "dateLabel": "拍摄时间不详",
      "captureDate": null,
      "coverage": "塔楼窄窗列、外墙、邻楼遮挡和裙房圆孔。",
      "caveat": "2026-10-23 已实际查看像素。仅部分视角与定位街景可视觉关联，未逐翼配准；不可把不同翻新状态拼成同一天。",
      "publisher": "OneDay",
      "faceIds": [],
      "orientationConfidence": "building_verified_patch_registration_unresolved",
      "publication": "link_only",
      "reuseLicense": null,
      "attributionRequired": true,
      "inspected": true,
      "checkedAt": "2026-10-23",
      "evidenceKind": "actual_published_photograph",
      "notice": "原站实拍，未取得在本工作台转载的许可；请打开原图核对。"
    },
    {
      "id": "warehouse-jll-two-elevations",
      "caseId": "warehouse",
      "label": "第二仓转角实拍 · 圆孔侧与横带侧",
      "sourceUrl": "https://property.jll.com.hk/en/industrial-lease/hong-kong/hung-hom/china-travel-hip-kee-godown-hk-ltd-godown-no2-hk-p-3408",
      "originalImageUrl": "https://jll-global-gdim-res.cloudinary.com/image/upload/v1727800452/HK/OLM/EDP/PROD/ytr3gvg2y3gs6yljxa7v.jpg",
      "imageUrl": null,
      "dateLabel": "拍摄时间不详（网址版本号不是拍摄日期）",
      "captureDate": null,
      "coverage": "已实际查看：照片左侧为成对竖列圆孔，右侧为密集水平突出带；可见底部门洞和装卸口。",
      "caveat": "JLL 页面明确为1 Cheong Hang Road、Godown No.2，身份可用；两个立面的指南针朝向尚未独立配准。不把左右当成东西南北。",
      "publisher": "JLL",
      "faceIds": [],
      "orientationConfidence": "two_sides_visible_cardinal_and_patch_mapping_unresolved",
      "publication": "link_only",
      "reuseLicense": null,
      "attributionRequired": true,
      "inspected": true,
      "checkedAt": "2026-10-23",
      "evidenceKind": "actual_published_photograph",
      "notice": "原站实拍，未取得在本工作台转载的许可；请打开原图核对。"
    }
  ],
  "governmentTextureStatus": {
    "currentSourcePackage": "non_textured",
    "currentPackageHasFieldPhotos": false,
    "notice": "原包是无纹理几何，程序生成材质和渲染截图不是现场照片。"
  },
  "publicPhotoDisplayComplete": false,
  "unresolved": "当前未取得可公开展示且逐面配准的实拍文件。来源按钮不是已完成的侧栏照片展示。"
};
const byPhoto = new Map(PHOTO_EVIDENCE.photos.map(p=>[p.id,p]));
const resolveCase = id => PHOTO_EVIDENCE.buildings[id] ? id : Object.entries(PHOTO_EVIDENCE.buildings).find(([,b])=>b.modelId===id)?.[0];
const clone = v => JSON.parse(JSON.stringify(v));
export function getBuildingPhotos(caseId) {
 const key=resolveCase(caseId), b=PHOTO_EVIDENCE.buildings[key];
 return b ? b.photoIds.map(id=>clone(byPhoto.get(id))) : [];
}
export function geometricFaceLabel(normal) {
 if (!Array.isArray(normal)||normal.length!==3||!normal.every(Number.isFinite)||Math.hypot(...normal)<1e-9) return '尚未识别的模型面';
 const [x,y,z]=normal, n=Math.hypot(x,y,z);
 if(y/n>.75)return '朝上的模型面'; if(y/n<-.75)return '朝下的模型面';
 const bearing=(Math.atan2(x,-z)*180/Math.PI+360)%360;
 return ['北','东北','东','东南','南','西南','西','西北'][Math.round(bearing/45)%8]+'向模型面';
}
function patchId(hit) {
 const p=hit.sourcePatchId;
 if(typeof p==='string') {const m=p.match(/(?:^|:)p(\d+)$/);if(m)return 'p'+m[1].padStart(3,'0');}
 if(Number.isInteger(hit.patchIndex)&&hit.patchIndex>=0)return 'p'+String(hit.patchIndex).padStart(3,'0');
 if(Number.isInteger(hit.sourceObjectId)&&hit.sourceObjectId>=1000&&hit.sourceObjectId<2000)return 'p'+String(hit.sourceObjectId-1000).padStart(3,'0');
 return null;
}
function resolveLegacyPhotoEvidence(caseId, hit={}) {
 const key=resolveCase(caseId), b=PHOTO_EVIDENCE.buildings[key];
 if(!b)return {caseId:null,buildingLabel:'未知建筑',faceId:null,faceLabel:'未知面',status:'no_photo',orientationConfidence:'unverified',photos:[],otherBuildingPhotos:[],missingReason:'没有这栋建筑的核验记录。',notice:'不得用其他建筑照片替代。'};
 const pid=patchId(hit), f=b.faces.find(face=>face.sourcePatchIds.includes(pid)), context=f?.id==='east-frontage-assembly';
 // These source patches are NOT individual face-photo registrations. Context is separate.
 const photos=f&&!context?f.photoIds.map(id=>clone(byPhoto.get(id))):[];
 const remaining=b.photoIds.filter(id=>!photos.some(p=>p.id===id)).map(id=>clone(byPhoto.get(id)));
 const status=photos.some(p=>p.imageUrl)?'image_available':photos.length?'source_link_only':key==='lowrise'?'no_photo':'orientation_unverified';
 return {caseId:key,buildingLabel:b.label,modelId:b.modelId,sourcePatchId:pid,faceId:f?.id??null,faceLabel:f?.label??geometricFaceLabel(hit.normal),status,orientationConfidence:f?.orientationConfidence??'unverified',photos,otherBuildingPhotos:remaining,
  contextPhotos:context?f.photoIds.map(id=>clone(byPhoto.get(id))):[],
  missingReason:photos.length?'该立面已有实拍来源，但当前未取得在这里转载展示的许可。':context?'照片能核对挑盖／围护总成，但此被点中表面没有单独配准实拍。':key==='lowrise'?'此面尚无核验并配准的实拍；不以东面或邻楼照片替代。':'本楼已有实拍，但此模型面与照片尚未完成可靠配准。',
  notice:'只把实际核验的照片归给对应面。其他视角仅作本楼参考；链接不等于已在侧栏显示照片。'};
}
export default PHOTO_EVIDENCE;

export function resolvePhotoEvidence(caseId,hit={}) {
 const key=resolveCase(caseId),legacy=resolveLegacyPhotoEvidence(caseId,hit),official=OFFICIAL_FACE_TEXTURES.cases[key];
 if(!official)return legacy;
 const pid=patchId(hit),overview=Object.keys(hit).length===0;
 const found=overview?official.overviewIds.map(id=>official.faces.find(p=>p.id===id)):official.faces.filter(p=>p.sourcePatchId===pid);
 if(!found.length){return {...legacy,officialTextureMissingReason:official.excluded.find(e=>e.sourcePatchId===pid)?.reason??'no_explicit_source_face_binding'};}
 return {...legacy,faceId:overview?'building-overview':pid,faceLabel:overview?'本栋多面外观参考（官方贴图）':found[0].faceLabel,status:'image_available',orientationConfidence:'exact_source_plane_uv_binding',photos:clone(found),otherBuildingPhotos:getBuildingPhotos(key),contextPhotos:[],missingReason:null,photoDisplayNature:'official_appearance_texture_not_camera_photo',notice:'这里显示与源面精确配准的政府模型外观贴图，不是原始相机照片，也不代表2026现状。缺乏纹理或未通过配准的面仍留空。'};
}
export {createOfficialTextureView} from './official-texture-view.mjs';
PHOTO_EVIDENCE.officialAppearanceDisplay={source:'separately acquired official 3A textured models',kind:'official_model_appearance_texture_not_camera_photo',faceCounts:{lowrise:128,kcc:21,warehouse:26},sourceGeometryUnchanged:true,captureDate:null};
