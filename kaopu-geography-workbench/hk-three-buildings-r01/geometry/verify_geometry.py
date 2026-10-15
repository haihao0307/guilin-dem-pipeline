"""Independent numeric comparison of original triangles and reconstructed output.

This verifies sampled surface distance, multiple horizontal sections, retained
holes, bounds, winding and same-codec byte counts. It does not claim an exact
Hausdorff proof, historical fidelity, visual acceptance or cross-GPU identity.
"""
from pathlib import Path
import hashlib,json,zlib,collections
import numpy as np

HERE=Path(__file__).resolve().parent

def deflate(data):
    c=zlib.compressobj(6,zlib.DEFLATED,-15);return c.compress(data)+c.flush()

def samples(tris):
    bary=np.array([[1,0,0],[0,1,0],[0,0,1],[.5,.5,0],[0,.5,.5],[.5,0,.5],[1/3]*3,[.6,.2,.2],[.2,.6,.2],[.2,.2,.6]])
    return np.einsum('ki,tij->tkj',bary,tris).reshape(-1,3)

def distances_to_triangles(query,tris):
    a,b,c=tris[:,0],tris[:,1],tris[:,2];u=b-a;v=c-a;n=np.cross(u,v);nn=np.einsum('ij,ij->i',n,n)
    uu=np.einsum('ij,ij->i',u,u);uv=np.einsum('ij,ij->i',u,v);vv=np.einsum('ij,ij->i',v,v);denom=uu*vv-uv*uv
    output=[]
    for k in range(0,len(query),256):
        q=query[k:k+256];w=q[:,None,:]-a[None,:,:]
        wu=np.einsum('qti,ti->qt',w,u);wv=np.einsum('qti,ti->qt',w,v)
        s=(wu*vv-wv*uv)/np.maximum(denom,1e-30);t=(wv*uu-wu*uv)/np.maximum(denom,1e-30)
        plane=np.einsum('qti,ti->qt',w,n)**2/np.maximum(nn,1e-30)
        inside=(s>=-1e-9)&(t>=-1e-9)&(s+t<=1+1e-9)&(nn>1e-20)
        best=np.where(inside,plane,np.inf)
        for start,end in [(a,b),(b,c),(c,a)]:
            edge=end-start;length=np.einsum('ij,ij->i',edge,edge)
            delta=q[:,None,:]-start[None,:,:];f=np.einsum('qti,ti->qt',delta,edge)/np.maximum(length,1e-30)
            closest=start[None,:,:]+np.clip(f,0,1)[:,:,None]*edge[None,:,:]
            dist=np.sum((q[:,None,:]-closest)**2,axis=2);best=np.minimum(best,dist)
        output.extend(np.sqrt(np.maximum(best.min(axis=1),0)).tolist())
    return np.array(output)

def section(tris,height):
    lines=[]
    for tri in tris:
        p=[]
        for a,b in zip(tri,np.roll(tri,-1,axis=0)):
            da=a[1]-height;db=b[1]-height
            if da*db<0:p.append(a+(b-a)*(-da)/(db-da))
        if len(p)==2 and np.linalg.norm(p[0]-p[1])>1e-8:lines.append([p[0][[0,2]],p[1][[0,2]]])
    return np.asarray(lines)

def line_distance(a,b):
    if len(a)==0:return 0 if len(b)==0 else float('inf')
    if len(b)==0:return float('inf')
    q=np.concatenate([a[:,0]*f+a[:,1]*(1-f) for f in [0,.25,.5,.75,1]])
    u=b[:,1]-b[:,0];d=q[:,None,:]-b[None,:,0,:];t=np.einsum('qsi,si->qs',d,u)/np.maximum(np.sum(u*u,axis=1),1e-30)
    closest=b[None,:,0,:]+np.clip(t,0,1)[:,:,None]*u[None,:,:]
    return float(np.sqrt(np.sum((q[:,None,:]-closest)**2,axis=2).min(axis=1)).max())

def area(loop):
    p=np.array(loop);return abs(np.sum(p[:,0]*np.roll(p[:,1],-1)-np.roll(p[:,0],-1)*p[:,1]))/2

def main():
    manifest=json.loads((HERE/'buildings.json').read_text());runtime=json.loads((HERE/'runtime-tests.json').read_text());reports=[]
    for item,run in zip(manifest['buildings'],runtime['tests']):
        model_id=item['id'];source=json.loads((HERE/f'{model_id}.source-preview.json').read_text());rebuilt=json.loads((HERE/f'{model_id}.reconstructed-preview.json').read_text());score=json.loads((HERE/f'{model_id}.score.json').read_text());audit=json.loads((HERE/f'{model_id}.extraction-audit.json').read_text());provenance=json.loads((HERE/f'{model_id}.provenance.json').read_text())
        src=np.array(source['positions']).reshape(-1,3,3);out=np.array(rebuilt['positions']).reshape(-1,3,3)
        ds=distances_to_triangles(samples(src),out);dr=distances_to_triangles(samples(out),src)
        levels=sorted(set(src[:,:,1].ravel()));heights=sorted(set([(a+b)/2 for a,b in zip(levels,levels[1:]) if b-a>1e-5]+[levels[0]+(levels[-1]-levels[0])*f for f in [.05,.2,.5,.8,.95]]))
        sections=[]
        for h in heights:
            a,b=section(src,h),section(out,h);sections.append({'heightLocalMetres':h,'sourceSegments':len(a),'rebuiltSegments':len(b),'maxSampledContourDistanceMetres':max(line_distance(a,b),line_distance(b,a))})
        bound_error=float(np.max(abs(np.stack([src.reshape(-1,3).min(0),src.reshape(-1,3).max(0)])-np.stack([out.reshape(-1,3).min(0),out.reshape(-1,3).max(0)]))))
        holes=[]
        min_dot=1.0
        for op,patch,plane in zip(score['reconstruction']['operations'],run['patches'],audit['patches']):
            triangles=out[patch['start']//3:(patch['start']+patch['count'])//3]
            face=np.cross(triangles[:,1]-triangles[:,0],triangles[:,2]-triangles[:,0]);norm=np.linalg.norm(face,axis=1);face=face/np.maximum(norm[:,None],1e-30)
            n=plane['normal'];n=np.array([n[0],n[2],-n[1]]);min_dot=min(min_dot,float((face[norm>1e-10]@n).min()))
            if len(op.get('loops',[]))>1:
                # x,z projection reverses north but retains polygon area.
                pa=(triangles[:,1]-triangles[:,0])[:,[0,2]];pb=(triangles[:,2]-triangles[:,0])[:,[0,2]]
                projected_area=float(np.sum(abs(pa[:,0]*pb[:,1]-pa[:,1]*pb[:,0]))/2)
                target=area(op['loops'][0])-sum(area(l) for l in op['loops'][1:])
                holes.append({'recipeId':op['id'],'holeCount':len(op['loops'])-1,'expectedPlanarProjectionArea':target,'rebuiltProjectedArea':projected_area,'absoluteAreaErrorSquareMetres':abs(target-projected_area)})
        original_files=[HERE/p for p in provenance['sourceRelativePaths']]
        originals_unchanged=all(hashlib.sha256(p.read_bytes()).hexdigest()==provenance['sourceFileSha256'][p.name] for p in original_files)
        score_bytes=(HERE/f'{model_id}.score.json').read_bytes();original_deflate=sum(len(deflate(p.read_bytes())) for p in original_files);score_deflate=len(deflate(score_bytes))
        report={'id':model_id,'sourceTriangles':len(src),'reconstructedTriangles':len(out),'recipeOperations':len(score['reconstruction']['operations']),'recipeKindCounts':dict(collections.Counter(o['kind'] for o in score['reconstruction']['operations'])),'originalBytes':sum(p.stat().st_size for p in original_files),'originalExistingZipCompressedMemberBytes':provenance['existingZipCompressedMemberBytes'],'originalSameCodecDeflate6Bytes':original_deflate,'scoreUtf8Bytes':len(score_bytes),'scoreSameCodecDeflate6Bytes':score_deflate,'scoreToOriginalSameCodecRatio':score_deflate/original_deflate,'scoreToExistingZipMemberRatio':score_deflate/provenance['existingZipCompressedMemberBytes'],'bboxMaxErrorMetres':bound_error,'planeMergeMaximumFitDeviationMetres':audit['maxPlaneFitErrorMetres'],'sourceToRebuiltSampledSurfaceErrorMetres':{'max':float(ds.max()),'rms':float(np.sqrt(np.mean(ds*ds))),'samples':len(ds)},'rebuiltToSourceSampledSurfaceErrorMetres':{'max':float(dr.max()),'rms':float(np.sqrt(np.mean(dr*dr))),'samples':len(dr)},'sectionSamples':sections,'maxSampledSectionErrorMetres':max(s['maxSampledContourDistanceMetres'] for s in sections),'holeChecks':holes,'minimumRebuiltFaceNormalDotSourcePlane':min_dot,'originalFileHashesUnchanged':originals_unchanged,'sourceDegenerateTriangleIds':audit['degenerateTriangles'],'runtimeDeterministicOnTestPlatform':run['repeatHashIdentical'],'claims':{'losslessSourceFileEncoding':False,'geometryErrorBoundIsSampledNotFormalHausdorffProof':True,'historicalReconstructionVerified':False,'fullBuildingSemanticDNA':False,'sourceMeshRuntimeDependency':False}}
        assert originals_unchanged
        assert bound_error<0.001 and ds.max()<0.001 and dr.max()<0.001
        assert report['maxSampledSectionErrorMetres']<0.001 and min_dot>0.999
        assert all(h['absoluteAreaErrorSquareMetres']<0.01 for h in holes)
        reports.append(report)
    shared=(HERE/'reconstruct.mjs').read_bytes()
    result={'status':'passed_numeric_research_checks','criteria':{'sampledSurfaceAndSectionToleranceMetres':0.001,'planeMergeToleranceMetres':0.00025,'boundaryCollinearToleranceMetres':0.00001,'sourceAndScoreCompression':'raw DEFLATE level 6, original glTF and BIN separately; score separately','comparisonScope':'source geometry package contains stored normals/colors; recipe reconstructs geometry and geometric normals, uses new procedural material, does not retain original COLOR_0 or original shading normals','runtimeSourcePreviewExcluded':True},'sharedReconstructorBytes':len(shared),'sharedReconstructorDeflate6Bytes':len(deflate(shared)),'sharedThreeLibraryBudget':'Existing Three.js dependency must be included at application level; not included in per-building ratio.','cases':reports}
    (HERE/'geometry-validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps([{k:r[k] for k in ['id','scoreUtf8Bytes','scoreSameCodecDeflate6Bytes','originalSameCodecDeflate6Bytes','scoreToOriginalSameCodecRatio','bboxMaxErrorMetres','maxSampledSectionErrorMetres']} for r in reports],indent=2))

if __name__=='__main__':main()
