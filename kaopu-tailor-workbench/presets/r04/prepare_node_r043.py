from pathlib import Path
P=Path(__file__).parent;f=P/'native/kaopu-tailor-workbench/catalogue/native-adapter.mjs';s=f.read_text()
(f.parent/'native-adapter-r043-test.mjs').write_text(s+'\nexport function __probe43(){return {spec,analytic,lab,nativeBinding,stages,stageIndex,stageFrame}}\n')
