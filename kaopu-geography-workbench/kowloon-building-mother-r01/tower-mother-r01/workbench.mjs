import{mountWorkbench}from'../building-mother-workbench/shared-display/workbench-ui.mjs';
import{growBuilding}from'./building-mother.mjs';
import{StudioRenderer}from'./studio-renderer.mjs';
mountWorkbench({growBuilding,StudioRenderer,instance:{floors:8,width:6,depth:6,storeyHeight:3.6,railNoiseAmplitude:0},version:'TOWER-R01-SQUARE-SPIRAL',roofToggle:false});
