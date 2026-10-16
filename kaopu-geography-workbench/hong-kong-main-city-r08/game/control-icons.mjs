// Exact SVG fragments from the user's original R20 88 game. No paths, colors,
// line widths, viewBoxes or titles have been redrawn. No physics code included.
// Source: kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/index.html
// Commit: e394e54f8f17159dc69bcf65bab557b1208790b6
// Git blob: cd6de7bcea3ae71787bd4eec562ba5bd2163d239
// Original SHA256: 50eede6c5c92534e0631b3f1f0a81f8185ac0da35bb22760b7efb5b6673d845b
// Original source line 50, drive-buttons block (accelerate / decelerate / brake).
export const ORIGINAL_CONTROL_ICONS = Object.freeze({
  "accelerate": "<svg class=\"rail-control-icon\" viewBox=\"0 0 48 48\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8 37a22 22 0 0 1 32 0M11 31l-3-3m10-2-1-4m13 4 1-4m7 9 3-3M24 37V15\"/><rect x=\"17\" y=\"10\" width=\"14\" height=\"6\" rx=\"2\" fill=\"#b74c3c\" stroke=\"#eedbb6\"/><circle cx=\"24\" cy=\"37\" r=\"4\"/><path d=\"M37 8v10m-5-5h10\"/></svg>",
  "decelerate": "<svg class=\"rail-control-icon\" viewBox=\"0 0 48 48\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8 37a22 22 0 0 1 32 0M11 31l-3-3m10-2-1-4m13 4 1-4m7 9 3-3M24 37 15 19\"/><rect x=\"8\" y=\"13\" width=\"14\" height=\"6\" rx=\"2\" fill=\"#b74c3c\" transform=\"rotate(-27 15 16)\"/><circle cx=\"24\" cy=\"37\" r=\"4\"/><path d=\"M33 13h10\"/></svg>",
  "brake": "<svg class=\"rail-control-icon\" viewBox=\"0 0 48 48\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"23\" cy=\"31\" r=\"10\"/><circle cx=\"23\" cy=\"31\" r=\"4\"/><path d=\"M14 38h18M23 27V12h14\"/><rect x=\"31\" y=\"8\" width=\"12\" height=\"7\" rx=\"3\" fill=\"#ad7947\" stroke=\"#f0d1a6\"/><path d=\"M7 17a23 23 0 0 1 10-8M9 12l-3-2m8-3-1-4\"/></svg>"
});
export const ORIGINAL_STATION_ACTION_LABEL = "到站后开门接送";
export const ORIGINAL_CONTROL_LABELS = Object.freeze({accelerate:"加速",decelerate:"减速",brake:"按住制动",pause:"暂停",stationAction:ORIGINAL_STATION_ACTION_LABEL});
