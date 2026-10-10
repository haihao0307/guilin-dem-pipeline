# R17 metre-scale candidate

R14 and R16 are retained. R17 inherits the KST1 function-only street and replaces the incorrect dimensional relationships in the older train/people placeholders. One world unit is one metre. Shared Three r170 and authoritative Session time remain unchanged. This is an independently scoped candidate, not a published or merged release.

## Source and dimensions

- `metre-scale.mjs`: standard 1.435m inner rail gauge, physical coach dimensions, two-car layout, platform extent and explicitly provisional design values.
- `steam-scale.mjs`: primary WD 2-8-0 datums and separately labelled authoring assumptions. Complete locomotive/tender prototype dimensions remain unknown; the fictional WD280 is not another historical class.
- `coach-model.mjs`: original generated coach shell, repeated window bays, real door wells and steps, full-size wheelsets, seats and buffers. British FK AA101 / BR116 dimensions are a reference for this fictional coach, not a KCR reconstruction.
- `actor-scale.mjs`: variable stature and independently authored adult body proportions, exact sole/seat anchors; explicit child height required. These placeholder figures are not finished realistic characters.
- `session.mjs`: same 30Hz authority, real 1.65m/s pedestrian path budget; longer physical vehicles change paths, not simulation or character speed.

## Primary references

WD frame drawing, inspected page12–13: https://advanced-steam.org/wp-content/uploads/2017/10/AST-presentation-Tom-Kay-v2.pdf
BR116 coach drawing, inspected pages8–9: http://www.barrowmoremrg.co.uk/BRBDocuments/CS/Book_No_200_EK_web.pdf
BR WOSS612/10 wheel data, inspected page39: https://preserved.railcar.co.uk/documentation/woss/woss-612-10-2.pdf
Swanage operator overview: https://stock.swanagerailway.co.uk/getfile.php?id=140
Hong Kong No.313 approximately20m length: https://www.news.gov.hk/eng/2020/10/20201030/20201030_123705_698.html

Drawings and private reference photographs are not included or uploaded. Original code and licensed finite glyph functions only. Font notices remain in street/glyphs-LICENSE.txt.

## Limits

Verified axle/roof/body dimensions do not certify the whole fictional engine. The WD boiler outer diameter, cab floor/roof, tender and body contour are clearly marked authoring assumptions. Coach interior floor/door/seat dimensions are physical design choices, not measured historical data. CPU geometry/route tests do not establish WebGL appearance or device performance. Film-quality materials and final human anatomy remain unfinished.

The acceptance workflow serves the exact Draft commit on a read-only official GitHub runner and never deploys it. Dimensional fixture screenshots add explicit test rulers and a1.72m person; native journey screenshots are separately labelled and use trusted controls and the production clock.

Existing route fixtures are checked against the full-size consist. The original truss top beam is raised to underside y4.90 m for the conservative y4.65 m dynamic envelope plus 0.25 m authored clearance. Stop-zone stripes are ground paint at y0.183 m, not raised obstacles across the railheads. Nine existing station/canopy/room variants were vertex-checked outside the above-rail moving side envelope. No tunnel geometry currently exists in this entry.
