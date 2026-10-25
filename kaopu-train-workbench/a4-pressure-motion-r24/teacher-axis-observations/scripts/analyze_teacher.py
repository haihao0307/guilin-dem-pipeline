#!/usr/bin/env python3
"""Read-only source measurements. Source archive stays private; no mesh export.
Usage: python analyze_teacher.py /path/to/source-assets/a4 /path/to/results
Requires NumPy, SciPy, matplotlib. glTF column-major matrices and XYZW quaternions.
"""
import argparse, gzip, hashlib, json
from pathlib import Path
import numpy as np
from scipy.spatial.transform import Rotation

class Source:
    def __init__(self, root):
        self.root=Path(root)
        self.object_bytes=(self.root/'object.json').read_bytes()
        self.o=json.loads(self.object_bytes);self.c=self.o['content'];self.g=self.c['displaySkeleton']
        self.binary=gzip.decompress((self.root/'fields.bin.gz').read_bytes())
        assert hashlib.sha256(self.binary).hexdigest()==self.c['fieldPayload']['sha256']
        for f in self.c['fields']:
            assert hashlib.sha256(self.binary[f['byteOffset']:f['byteOffset']+f['byteLength']]).hexdigest()==f['sha256']
        self.parents={j:i for i,n in enumerate(self.g['nodes']) for j in n.get('children',[])}
    def acc(self, i):
        f=self.c['fields'][i];d=f['definition'];types={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'};sizes={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
        return np.frombuffer(self.binary,dtype=types[d['componentType']],count=d['count']*sizes[d['type']],offset=f['byteOffset']).reshape(d['count'],sizes[d['type']]).copy()
    def descendants(self,i):
        return [i]+[k for j in self.g['nodes'][i].get('children',[]) for k in self.descendants(j)]
    def matrices(self,time=None):
        nodes=[dict(n) for n in self.g['nodes']]
        if time is not None:
            a=self.g['animations'][0]
            for ch in a['channels']:
                s=a['samplers'][ch['sampler']];times=self.acc(s['input']).ravel();v=self.acc(s['output']);path=ch['target']['path']
                assert s.get('interpolation','LINEAR')=='LINEAR'
                if len(times)==1:
                    nodes[ch['target']['node']][path]=v[0]
                    continue
                i=max(0,min(len(times)-2,np.searchsorted(times,time)-1));u=np.clip((time-times[i])/(times[i+1]-times[i]),0,1)
                if path=='rotation':
                    p=v[i].astype(float);q=v[i+1].astype(float);dot=np.dot(p,q)
                    if dot<0:q=-q;dot=-dot
                    if dot>.9995:r=p+(q-p)*u;r/=np.linalg.norm(r)
                    else:
                        th=np.arccos(np.clip(dot,-1,1));r=(np.sin((1-u)*th)*p+np.sin(u*th)*q)/np.sin(th)
                else:r=v[i]*(1-u)+v[i+1]*u
                nodes[ch['target']['node']][path]=r
        matrices={}
        def world(i):
            if i in matrices:return matrices[i]
            n=nodes[i]
            if 'matrix' in n:m=np.array(n['matrix']).reshape(4,4,order='F')
            else:
                m=np.eye(4);m[:3,:3]=Rotation.from_quat(n.get('rotation',[0,0,0,1])).as_matrix()@np.diag(n.get('scale',[1,1,1]));m[:3,3]=n.get('translation',[0,0,0])
            matrices[i]=world(self.parents[i])@m if i in self.parents else m
            return matrices[i]
        for i in range(len(nodes)):world(i)
        return matrices
    def primitives(self,root=None,time=None):
        mats=self.matrices(time)
        for i in self.descendants(root) if root is not None else range(len(self.g['nodes'])):
            n=self.g['nodes'][i]
            if 'mesh' not in n:continue
            for pi,p in enumerate(self.g['meshes'][n['mesh']]['primitives']):
                v=self.acc(p['attributes']['POSITION']).astype(float);v=v@mats[i][:3,:3].T+mats[i][:3,3]
                faces=self.acc(p['indices']).reshape(-1,3).astype(int)
                yield i,pi,v,faces
    def vertices(self,root,time=None):return np.concatenate([v for i,j,v,f in self.primitives(root,time)])

def stats(v):
    v=np.unique(np.round(v,7),axis=0);mean=v.mean(0);e,axes=np.linalg.eigh(np.cov((v-mean).T));axis=axes[:,-1]
    if axis[2]<0:axis=-axis
    return {'unique_vertices':len(v),'bounds':[v.min(0).tolist(),v.max(0).tolist()],'mean':mean.tolist(),'pca_major_axis':axis.tolist(),'pca_eigenvalues':e.tolist(),'pca_pitch_deg':float(np.degrees(np.arctan2(axis[1],axis[2])))}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('source');ap.add_argument('output');args=ap.parse_args();s=Source(args.source);out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
    measurements=[]
    for i,n in enumerate(s.g['nodes']):
        if 'children' not in n or i<3:continue
        arrays=list(s.primitives(i))
        if not arrays:continue
        v=np.concatenate([a[2] for a in arrays]);m=stats(v);m.update(node=i,name=n.get('name'),mesh_nodes=[a[0] for a in arrays]);measurements.append(m)
    (out/'node_measurements.json').write_text(json.dumps(measurements,indent=2))
    result={'object_sha256':hashlib.sha256(s.object_bytes).hexdigest(),'payload_sha256':hashlib.sha256(s.binary).hexdigest(),'all_payload_hashes_verified':True,'source_units':'UNCHANGED_UNCALIBRATED','matrix_0':s.matrices()[0].tolist(),'matrix_2_world':s.matrices()[2].tolist(),'mesh_node_count':sum('mesh'in n for n in s.g['nodes']), 'animation_target_nodes':sorted(set(ch['target']['node'] for a in s.g['animations'] for ch in a['channels']))}
    (out/'source_checks.json').write_text(json.dumps(result,indent=2))
    for m in measurements:
        if m['node'] in [7,90,94,98,100,102,104,111,115,119,121,123,125,258,260,266,270,284,290,293,295,298,300]:
            print(m['node'],m['name'],'bounds',np.round(m['bounds'],5).tolist(),'axis',np.round(m['pca_major_axis'],5).tolist())
if __name__=='__main__':main()
