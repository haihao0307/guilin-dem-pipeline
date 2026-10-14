# CIE numerical data and derived table attribution

International Commission on Illumination (CIE), Vienna, 2019:

- Colour-matching functions of CIE 1931 standard colorimetric observer, DOI https://doi.org/10.25039/CIE.DS.xvudnb9b . Original file SHA256 `fa663e3535a7e0763a745993a1f0a192eb0275ac46ad2d1befd7626841e713c1`.
- CIE standard illuminant D65, DOI https://doi.org/10.25039/CIE.DS.hjfjmt59 . Original file SHA256 `e76f210bffff3d552ef7113025da5f325d5dfec200dd4b878b1a2f3a507032cb`.

The two original CSV datasets and metadata identify their license as Creative Commons Attribution-ShareAlike 4.0 International: https://creativecommons.org/licenses/by-sa/4.0/ . Full terms: https://creativecommons.org/licenses/by-sa/4.0/legalcode . They are preserved unchanged in `research-data`.

Changes/derivation: 5 nm numerical samples between 380 and 780 nm were used with independently authored tissue calculations to create the quantized linear-sRGB values in `integration/LayeredSpectralLUT.json` and `research-data/spectral-samples.json`. These CIE-derived data tables are distributed under CC BY-SA 4.0 with this attribution. CIE has not endorsed this rendering or its biological assumptions. Independently authored source code and pre-existing project assets retain their applicable licenses; this notice does not relicense those assets.

Hemoglobin numerical facts are attributed separately to Scott Prahl's compiled table at https://omlc.org/spectra/hemoglobin/summary.html . No OMLC article prose or reference-site photographic assets are redistributed.
