import re, pathlib, json, hashlib
root=pathlib.Path(__file__).resolve().parents[1]
# Translation is deliberately restricted to these source-locked, side-effect-free field leaves.
files=['brick-core','stone-fields','stone-slate','plaster-core']
returns={};structs={}
def typemap(s):
 return re.sub(r'\b(f32|i32|u32)\b',lambda m:{'f32':'float','i32':'int','u32':'uint'}[m[1]],re.sub(r'vec([234])<f32>',r'vec\1',s).replace('mat3x3<f32>','mat3'))
def split_top(s,seps):
 d=0
 for i,c in enumerate(s):
  if c in '([':d+=1
  elif c in ')]':d-=1
  elif d==0 and c in seps:yield i

def infer(s,env):
 s=s.strip()
 if s.startswith('(') and list(split_top(s[1:-1],''))==[]:
  # Only strip when the initial open parenthesis closes at the end.
  depth=0;end=0
  for i,c in enumerate(s):
   depth+=(c=='(')-(c==')')
   if depth==0:end=i;break
  if end==len(s)-1:return infer(s[1:-1],env)
 ids=list(split_top(s,'+-*/'))
 if ids:
  i=ids[-1]
  if i==0:return infer(s[1:],env)
  a,b=infer(s[:i],env),infer(s[i+1:],env)
  return a if a.startswith(('vec','mat')) else b if b.startswith(('vec','mat')) else 'float'
 m=re.match(r'^(\w+)\s*\((.*)\)$',s,re.S)
 if m:
  name,args=m.groups();first=args[:next(iter(split_top(args,',')),len(args))]
  if name in returns:return returns[name]
  if name.startswith(('vec','mat')) or name in ['float','int','uint']:return name
  if name in ['mix','floor','fract','abs','sin','cos','tan','tanh','exp','log2','pow','clamp','min','max','normalize','cross','step','smoothstep']:return infer(first,env)
  if name in ['dot','length','distance','atan','acos','sqrt','sign']:return 'float'
  raise Exception('unknown function '+name)
 m=re.match(r'^([A-Za-z_]\w*)(?:\.(\w+))?$',s)
 if m:
  name,field=m.groups();t=env.get(name,returns.get(name,'float'))
  if field:
   if t in structs:return structs[t][field]
   return 'float' if len(field)==1 else 'vec'+str(len(field))
  return t
 if re.match(r'^[\d.eE+-]+u?$',s):return 'float'
 raise Exception('cannot infer '+s)

def preserved_wgsl(name):
 text=(root/'mothers'/f'{name}.mjs').read_text()
 match=re.search(r'export const [A-Z_]+\s*=\s*(".*");',text,re.S)
 if not match: raise ValueError('No preserved WGSL export: '+name)
 return json.loads(match[1])
raws={f:preserved_wgsl(f) for f in files}
for raw in raws.values():
 s=typemap(raw)
 returns.update({n:t for n,a,t in re.findall(r'fn\s+(\w+)\(([^)]*)\)\s*->\s*(\w+)',s)})
 for n,body in re.findall(r'struct\s+(\w+)\s*\{([^}]+)\}',s):structs[n]={k:t for k,t in re.findall(r'(\w+)\s*:\s*(\w+)',body)}
allout=[];receipt=[]
for f,raw in raws.items():
 s=typemap(raw).replace('atan2','atan').replace('select(','mix(')
 # Function scopes and declarations are walked in order, so variable types are never guessed from field names.
 pieces=[];pos=0
 for m in list(re.finditer(r'fn\s+(\w+)\(([^)]*)\)\s*->\s*(\w+)\s*\{',s)):
  a=m.end();d=1;i=a
  while d:
   d+=(s[i]=='{')-(s[i]=='}');i+=1
  body=s[a:i-1];env={n:t for n,t in re.findall(r'(\w+)\s*:\s*(\w+)',m[2])};env.update({n:t for n,t in re.findall(r'const\s+(\w+)\s*:\s*(\w+)',s)})
  def dec(k):
   mode,n,explicit,expr=k.groups();t=explicit or ('int' if n in ['i','j'] and expr.strip()=='0' else infer(expr,env));env[n]=t;return t+' '+n+'='+expr+';'
  body=re.sub(r'\b(var|let)\s+(\w+)\s*(?::\s*(\w+))?\s*=\s*([^;]*);',dec,body)
  args=re.sub(r'(\w+)\s*:\s*(\w+)',r'\2 \1',m[2]);pieces.append(s[pos:m.start()]+m[3]+' '+m[1]+'('+args+'){'+body+'}');pos=i
 pieces.append(s[pos:]);s=''.join(pieces)
 s=re.sub(r'struct\s+(\w+)\s*\{([^}]+)\};?',lambda m:'struct '+m[1]+' {'+re.sub(r'(\w+)\s*:\s*(\w+)\s*,?',r'\2 \1;',m[2])+'};',s)
 s=re.sub(r'const\s+(\w+)\s*:\s*(\w+)\s*=',r'const \2 \1=',s)
 s=re.sub(r'\b(var|let)\s+(\w+)\s*:\s*(\w+)\s*;',r'\3 \2;',s)
 (root/'mothers'/f'{f}.glsl').write_text(s);allout.append(s);receipt.append({'source':f,'sha256':hashlib.sha256(raw.encode()).hexdigest(),'glslSha256':hashlib.sha256(s.encode()).hexdigest(),'functions':len(re.findall(r'\bfn\s+',raw))})
wood=(root/'mothers/wood-original.glsl').read_text();wood=wood.replace('struct KpSurface {float height;vec3 albedo;float roughness;};\n','')
s='\n'.join(allout+[wood]);(root/'mothers/all-fields.glsl').write_text(s);(root/'mothers/all-fields.mjs').write_text('export const MOTHER_FIELDS_GLSL='+json.dumps(s)+';\n');(root/'design/mother-port-sources.json').write_text(json.dumps(receipt,indent=2));print('Generated',len(s),'bytes',receipt)
