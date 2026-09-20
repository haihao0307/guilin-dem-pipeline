# R040 cultivation ecology notes

R040 keeps the R039 terrain baseline and only adds a cultivation/ecology layer.

Source-backed rules used:
- IRRI Rice Knowledge Bank: irrigated lowland rice is typically grown in bunded fields; separate field channels improve control of water to/from individual fields; bunds must be maintained; after transplanting shallow water is commonly around 3 cm initially and later 5–10 cm depending on crop stage.
- FAO basin irrigation guidance: bunds are earth embankments that retain irrigation water; permanent rice-field bunds can also serve as paths. Dimensions in FAO are generic irrigation guidance, not local measurements for this synthetic scene.
- UNESCO Honghe Hani Rice Terraces: forested mountaintops feed a complex channel system supplying terraces; the integrated farming system includes water buffalo, cattle, ducks, fish and eel; water buffalo are part of field preparation.

Implementation boundaries:
- Four field shelters are synthetic functional props placed on bund/edge nodes. They are not claimed to reproduce a specific Hani historical shelter type.
- Actors and buffalo positions are synthetic scene composition, but all are grounded by the same terrainY function.
- Field phenology mosaic (transplanted/tillering/heading/ripening) is a visual/state demonstration, not a claim that adjacent fields historically had those exact simultaneous stages.
