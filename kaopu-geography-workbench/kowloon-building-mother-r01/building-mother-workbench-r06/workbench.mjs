import{mountWorkbench}from'../building-mother-workbench/shared-display/workbench-ui.mjs';
import{growBuilding}from'./building-mother.mjs';
import{StudioRenderer}from'../tower-mother-r01/studio-renderer.mjs';
mountWorkbench({growBuilding,StudioRenderer,instance:{floors:2,storeyHeight:3.6,stage:7,roofVisible:false,railNoiseAmplitude:0},version:'MOTHER-R06-SHARED-CORE'});
