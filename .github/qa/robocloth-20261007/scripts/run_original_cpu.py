"""Run the original renderer; CPU-only device adapter, exact official model/scene."""
import os,sys,runpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
os.environ['HOME']=str(ROOT/'local-home');os.environ['DRJIT_LIBLLVM_PATH']='/usr/lib/x86_64-linux-gnu/libLLVM-17.so'
os.environ['MESH_DIR']=str(ROOT/'assets/render_assets/cloth_on_bar');os.environ['BRDF_CKPT_ROOT']=str(ROOT/'assets/checkpoints/stage2/RoboCloth')
import torch,mitsuba as mi
mi.set_variant('llvm_ad_rgb');torch.set_num_threads(2);torch.manual_seed(7)
sys.path.insert(0,str(ROOT/'runtime_cpu/rendering'))
from model_cpu import load_model
import brdf_plugin.mlp as mlp
mlp.create_anisotropic_model=load_model
os.chdir(ROOT/'runtime_cpu/rendering')
sys.argv=['render.py','scene=examples/cloth_on_bar','variant=llvm_ad_rgb','seed=7','render.width=64','render.height=64','render.spp=4','render.batch_spp=1',f'output_base={ROOT}/runs/original-cpu','output_name=smoke64',*sys.argv[1:]]
runpy.run_path(str(ROOT/'runtime_cpu/rendering/render.py'),run_name='__main__')
