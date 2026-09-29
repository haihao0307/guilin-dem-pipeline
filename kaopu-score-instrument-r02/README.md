# KAOPU Score Instrument R02 — Spatial Composition

R02 keeps R01 intact and tests the next, stricter claim: a short score can describe a non-trivial spatial composition when the shared grammar already lives inside a separate instrument.

Default result:

- 259 primitive meshes;
- only box, sphere, cylinder, cone, torus and plane geometry;
- one 1,012-byte UTF-8 score;
- nested groups, radial arrays, arbitrary-vector linear arrays, 3D grids and helices;
- no GLB, texture, image, external JSON or inherited Fish/Coral/Bird/Landscape code;
- a separately downloadable `KAOPU_INSTRUMENT_K2.js` containing the instrument only.

## Logical correction

A smaller score does not mean the total information vanished. The instrument stores shared geometry knowledge, defaults and algorithms. The score stores only the differences needed to construct this spatial composition. R02 therefore displays three separate sizes: score, pure instrument and complete workbench.

## K2 additions

```text
G@x,y,z/rx,ry,rz%sx,sy,sz{children}   transformed group
Acount,radius,start,facing{children}   radial array
Lcount,dx,dy,dz{children}              vector linear array
Xnx,ny,nz,sx,sy,sz{children}           centered 3D grid
Hcount,radius,height,turns,start{children} helix
```

Primitive syntax remains `b s c n t p` with `# ! @ / %` attributes.

## Separate instrument contract

`src/instrument.js` contains no page UI, camera, controls, examples or default score. The build emits a one-file browser instrument:

```text
dist/KAOPU_INSTRUMENT_K2.js
```

It exposes `globalThis.KAOPUInstrument`, including `THREE`, `parseScore`, `buildScore`, `measure`, `snapshot`, `equalSnapshots` and `dispose`.

## Gates

- [x] No generated image substitutes for real 3D.
- [x] Production source is modified.
- [x] The result is a real interactive Three.js workbench.
- [x] The workbench builds into one standalone HTML with no required network requests.
- [x] The pure instrument is delivered as a separate one-file artifact.
- [ ] Public fixed URL and real-browser verification are complete only after CI records `shareAllowed=true`.
- [x] Screenshots alone are not accepted as delivery.

The experiment does not prove that arbitrary real fish, coral, birds or terrain can be represented by a score of similar size. Those domains require additional measured grammar and independent verification.
