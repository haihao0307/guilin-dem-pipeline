"""Append inferred support webs, retaining recovered513fields byte-for-byte."""
import pathlib,json,sys,numpy as np
P=pathlib.Path(__file__).parent;sys.path.insert(0,str(P/'reference'));import driving_crank_assembly as drive,crankpin_support as sup
D=json.loads((P/'scene.js').read_text()[13:].rstrip(';\n'));D['parts']=[x for x in D['parts']if x['group']!='wheel_attachment']
code=[]
for side,name in [(0,'left'),(2,'right')]:
 sign=-1 if side==0 else 1;b,_=drive.pose(.4,side)
 for k,z in enumerate(sup.CONFIG['axle_z']):
  a=np.array([1.016,z]);bb=b+[0,z];fn=f'repair_{name}_D{k+1}_crankpin_support';x=sign*.7425;pr=.06985 if k==1 else .04
  vec=lambda p:'vec2('+','.join(format(float(v),'.17g')if '.'in format(float(v),'.17g')else format(float(v),'.17g')+'.0'for v in p)+')'
  code.append(f'float {fn}(vec3 p){{return max(mFlat(p,{vec(a)},{vec(bb)},{x},.0475,.11),-min(length(p.yz-{vec(bb)})-{pr},length(p.yz-{vec(a)})-.102));}}')
  D['parts'].append({'id':f'wheel_attachment/{name}_D{k+1}_crankpin_support','group':'wheel_attachment','source':'attachment','glsl_function':fn,'aabb_min':[x-.047501,float(min(a[0],bb[0])-.110001),float(min(a[1],bb[1])-.110001)],'aabb_max':[x+.047501,float(max(a[0],bb[0])+.110001),float(max(a[1],bb[1])+.110001)],'lipschitz':1.000002,'status':'new inferred wheel-hub/crankpin support web, not historical casting profile','axle_z':z,'side':side})
# Reuse own mFlat/cylinder helper definitions, not the old motion scalar parts.
helper=D['sources']['motion'].split('float motion_')[0]
D['sources']['attachment']=helper+'\n'+'\n'.join(code);D['scope']='519analytic fields: retained513 plus6 inferred crankpin support candidates; dynamic adapter reconstructed';(P/'scene.js').write_text('window.SCENE='+json.dumps(D,separators=(',',':'))+';');print(len(D['parts']))
