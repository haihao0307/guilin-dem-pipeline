# Ground and basement evidence contract

This learning layer does not turn source-local zero into street level, does not move the authoritative building surfaces, and does not reconstruct measured underground interiors.

## Existing primary records
The preserved `../r07/sources/official-footprints.json` stores exact source URLs, EPSG:2326 rings and official attributes:
- 33 La Salle Road: component 3676421372T20050430, OBJECTID 47805, BaseHeight 26 mPD. StoreysInBasement is null. No basement is generated.
- KCC podium: component 3600619942P20060311, OBJECTID 229126, BaseHeight 8 mPD, TopHeight 22.4 mPD, StoreysInBasement 1. The distinct tower begins at the official 22.4 mPD attribute. It is not a street-level entrance.
- Godown No.2 podium: component 3690318597P20060311, OBJECTID 237016, BaseHeight 4 mPD, TopHeight 17.5 mPD, StoreysInBasement 2. The distinct upper building begins at the official 17.5 mPD attribute.

A component's BaseHeight is only the chosen approximate working datum in this study. It is NOT surveyed terrain, finished ground or a verified entrance elevation. Source mesh extents and official BaseHeight/TopHeight are separate definitions and remain unchanged. Every local elevation is converted to mPD using the original source origin; no normalization or concealed shift is applied.

## Additional warehouse corroboration
China Tourism Group's official procurement list includes “中旅協記二倉12F/B1/B2防煙門及一倉緊急出口鐵門更換工程采购结果公告”, dated 2026-06-25:
https://dzzb.ctg.cn/cms/cmsguozhongxuangg/index_8.html
The listing corroborates labels 12F/B1/B2 and the announced door project. It does not provide surveyed floor elevations, room layouts or elevator service schedules. Pagination can change; title and date are the record identity.

The separate “中旅協記二倉L4、L6兩部升降機整體更換工程中标公告”, dated 2026-08-17, tender ZLFZBID2026070300001, identifies L4 and L6 in procurement. It does not prove six lifts, a manufacturer, commissioning completion, or service to all basements. No such conclusion is used here.

## Explicit design assumptions
- Basement layer depth, footprint, thickness, core position and internal circulation are editable design proposals.
- The official podium footprint constrains an initial design outline; it does not establish the actual underground outline.
- Only a new composite DESIGN host slab may receive a stair aperture needed to connect to the existing design core. The old model remains untouched and recoverable.
- Ground grid is a non-solid reference annotation, not a terrain surface or collision floor.
- New basement floors do not automatically become served elevator stops. Existing above-ground schedules remain unchanged.
- Hong Kong “地下 / G/F” means ground floor, not basement B1. Null basement data is unknown, not zero proven basements.

No structural, fire, accessibility or machinery compliance is asserted. All teacher source code and assets remain outside this implementation.
