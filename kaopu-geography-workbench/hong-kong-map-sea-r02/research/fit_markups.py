#!/usr/bin/env python3
"""Recover approximate authored map markups. Read-only on R01, writes research outputs.
All image picks use display-resized 1000px-wide copies and are reported as such.
Camera starts from manually read label bottom-centres; labels are NOT final controls.
Final fit uses the rendered cyan reference-route pixels, including DSM elevation.
"""
from pathlib import Path
import json,numpy as np
from PIL import Image
from scipy.optimize import least_squares
from scipy.ndimage import distance_transform_edt, map_coordinates
BASE=Path(__file__).resolve().parents[2]; OUT=Path(__file__).resolve().parent
S=json.loads((BASE/'hong-kong-map-sea-r01/data/scene.json').read_text()); H=np.load(BASE/'hong-kong-map-sea-r01/data/heights.npy')
X0=S['x0']-S['origin'][0];Z0=S['origin'][1]-S['y0']

def heights(xz):
 xz=np.atleast_2d(xz);c=(xz[:,0]-X0)/30;r=(xz[:,1]-Z0)/30
 return map_coordinates(H,[r,c],order=1,mode='nearest')
def xyz(xz,raise_m=10):
 xz=np.atleast_2d(xz);return np.column_stack((xz[:,0],heights(xz)+raise_m,xz[:,1]))
def camera(p):
 yaw,pitch,camx,camy,camz,f,cx,cy=p
 fw=np.array([np.sin(yaw)*np.cos(pitch),np.sin(pitch),-np.cos(yaw)*np.cos(pitch)]);right=np.cross(fw,[0,1,0]);right/=np.linalg.norm(right);up=np.cross(right,fw)
 return np.array([camx,camy,camz]),fw,right,up

def project(pts,p):
 cam,fw,right,up=camera(p);v=pts-cam;d=v@fw
 return np.column_stack((p[6]+p[5]*(v@right)/d,p[7]-p[5]*(v@up)/d))

def ray_ground(uv,p):
 from scipy.optimize import brentq
 cam,fw,right,up=camera(p);direc=fw+(uv[0]-p[6])/p[5]*right-(uv[1]-p[7])/p[5]*up
 def diff(t):
  pt=cam+direc*t;return pt[1]-heights(pt[[0,2]])[0]
 t0=-cam[1]/direc[1]; ts=np.linspace(max(0,t0-8000),t0+4000,1500)
 vals=np.array([diff(t) for t in ts]);cross=np.flatnonzero((vals[:-1]>=0)&(vals[1:]<=0))
 if not len(cross):return None
 k=cross[0];t=brentq(diff,ts[k],ts[k+1]);pt=cam+direc*t
 return [S['origin'][0]+pt[0],S['origin'][1]-pt[2],pt[1]]

# Manually read label box bottom-centres on 1000px-wide inspection copies.
# Keys index R01 scene labels. Label positions initialize and weakly stabilize the route fit. Keys >=1000 denote modern-reference route vertex index key-1000.
PICKS={
 '105236':{0:[295,237],1:[657,423],2:[580,398],3:[535,390],4:[431,365],5:[309,444],6:[170,543],7:[710,395],8:[333,428]},
 '104923':{3:[220,505],4:[589,365],5:[633,167],8:[630,198],9:[537,400],10:[606,385],11:[674,323],12:[669,350]},
 '104949':{6:[120,86],5:[448,247],8:[504,276],4:[730,410],3:[789,655]},
 '105108':{2:[475,254],13:[572,248],1104:[360,254],1064:[234,333],1028:[375,470],1162:[321,186]},
 '105055':{1:[316,512],2:[537,259],3:[543,178],13:[596,253],14:[823,284],15:[368,366],16:[554,398]},
}
# Explicit user strokes, independently picked from image after inspecting original.
MARKUPS={
 '105236':{'crop_corners':[[132,195],[824,192],[832,685],[129,679]],'crop_corner_order':['image top-left','image top-right','image bottom-right','image bottom-left']},
 '104923':{'station_centres':[[645,359],[659,381]],'station_names':['upstream/northwest yellow circle','downstream/southeast yellow circle']},
 '104949':{'blue_route':[[757,584],[751,562],[746,540],[739,513],[734,491],[731,466],[731,440],[731,417],[740,401],[749,381],[747,367],[741,353],[732,338],[720,321],[707,313],[689,308],[666,301],[641,290],[619,282],[596,274],[574,264],[548,255],[519,249],[486,245],[456,240],[427,236],[400,231],[394,228]]},
 '105108':{'station_centres':[[550,266]],'station_names':['second grand shed station yellow circle'],'blue_route':[[327,367],[344,353],[366,340],[395,326],[417,315],[439,305],[461,296],[488,286],[513,275],[535,268],[550,266],[566,255],[573,244],[576,231],[574,220],[572,210],[567,197],[563,190],[556,180],[548,171]]},
 '105055':{'blue_route':[[316,514],[336,512],[359,510],[388,508],[409,505],[427,495],[445,482],[462,464],[477,445],[491,424],[505,400],[514,378],[520,353],[521,329],[520,304],[520,291],[525,279],[533,270],[548,265],[566,263],[584,258],[595,252],[600,241],[602,227],[601,213],[596,204],[587,192],[577,184],[568,174],[567,165],[571,157],[577,152],[588,146]]},
}

def main():
 result={'method':'Physical pinhole camera with no roll, fit to cyan modern reference-route pixels, DSM height retained. Corrected label ground anchors initialize the camera and provide a weak stabilizer. Initializer keys >=1000 denote modern-reference route vertex index (key-1000), not labels. Manual markup picks use 1000px-wide image frame.', 'crs':'EPSG:2326','vertical':'EGM2008 DSM, NOT HKPD; no vertical exaggeration','image_results':{}}
 for key,picks in PICKS.items():
  orig=Image.open(BASE/f'map-user-markups/屏幕截图 2026-10-13 {key}.png').convert('RGB');ww,hh=orig.size;wh=hh*1000/ww
  im=np.asarray(orig.resize((1000,round(wh))))
  # cyan rendered route, not dark blue handwritten marker or label text
  full=np.array(orig);r,g,b=full[:,:,0].astype(float),full[:,:,1].astype(float),full[:,:,2].astype(float)
  mask=(b>175)&(g>140)&(r<145)&(r>50)&(b-g>26)&(g-r>42)
  mask[:max(0,round(hh*.06))]=False
  if key=='105236':
   mask[:int(300*ww/1000)]=False
   mask[int(610*ww/1000):]=False
   mask[:,:int(145*ww/1000)]=False
   mask[:,int(680*ww/1000):]=False
  # Remove known yellow or hand-drawn blue overlays from fit by excluding no nearby cyan, naturally.
  dt=distance_transform_edt(~mask)/(ww/1000)
  ids=list(picks); target=np.array(list(picks.values())); ref_points=next(x['points'] for x in S['routes'] if x['kind']=='reference'); worlds=np.array([xyz(S['labels'][k]['point'],45)[0] if k<1000 else xyz(ref_points[k-1000],10)[0] for k in ids])
  # multiple rotations; labels are only bootstrap, allow principal point and focal length to vary
  best=None
  for yaw in ([1.55,1.4,1.8] if key=='105236' else [-.7,0,-.3]):
   pitch=-1.4 if key in ['105236','104949'] else (-.65 if key=='104923' else -.45)
   fw=np.array([np.sin(yaw)*np.cos(pitch),np.sin(pitch),-np.cos(yaw)*np.cos(pitch)])
   cen=worlds.mean(0); dist=32000 if key=='105236' else 15000
   cam=cen-fw*dist;p=np.array([yaw,pitch,*cam,wh/2/np.tan(np.radians(27.5)),500,wh/2])
   # fix principal point by soft prior; route adjustment can refine it later
   def initial_res(p):return np.r_[(project(worlds,p)-target).ravel(),(p[6]-500)/30,(p[7]-wh/2)/30,(p[5]-wh/2/np.tan(np.radians(27.5)))/100]
   fit=least_squares(initial_res,p,x_scale='jac',max_nfev=3000,bounds=([-3.2,-1.568,-1e5,100,-1e5,100,-500,-500],[3.2,-.08,1e5,2e5,1e5,3000,1500,1500]))
   err=np.linalg.norm(initial_res(fit.x))
   if best is None or err<best[0]:best=(err,fit.x)
  p=best[1];initial_p=p.copy(); initial_errors=project(worlds,p)-target
  # Densify modern route in world plane to 25m segments, matching rendered ~40m tessellation.
  route=np.array(next(x['points'] for x in S['routes'] if x['kind']=='reference'))
  samples=[]
  for a,b in zip(route[:-1],route[1:]):
   for t in np.linspace(0,1,max(2,int(np.linalg.norm(b-a)/25)+1))[:-1]:samples.append(a*(1-t)+b*t)
  pts=xyz(samples,10)
  initial_projection=project(pts,p)
  visible=(initial_projection[:,0]>10)&(initial_projection[:,0]<990)&(initial_projection[:,1]>wh*.07)&(initial_projection[:,1]<wh-10)
  pts=pts[visible]
  def resid(p):
   uv=project(pts,p);d=map_coordinates(dt,[uv[:,1]*ww/1000,uv[:,0]*ww/1000],order=1,mode='constant',cval=100)
   # Nearby label anchors lightly stabilize shape, never dominate dense route.
   return np.r_[d,((project(worlds,p)-target)/5).ravel(),(p[6]-initial_p[6])/50,(p[7]-initial_p[7])/50,(p[5]-initial_p[5])/100]
  fit=least_squares(resid,p,x_scale='jac',max_nfev=1800,loss='soft_l1',f_scale=2,bounds=([-3.2,-1.568,-1e5,100,-1e5,100,-500,-500],[3.2,-.08,1e5,2e5,1e5,3000,1500,1500]))
  p=fit.x;uv=project(pts,p);err=map_coordinates(dt,[uv[:,1]*ww/1000,uv[:,0]*ww/1000],order=1,mode='constant',cval=100)
  output={'source_image':orig.filename if hasattr(orig,'filename') else f'屏幕截图 2026-10-13 {key}.png','original_image_size':[ww,hh],'analysis_frame_width':1000,'analysis_frame_height':wh,'camera_parameter_order':['yaw_rad','pitch_rad','local_cam_x','local_cam_y','local_cam_z','focal_px','principal_x_px','principal_y_px'],'camera_parameters':p.tolist(),'label_initializer_picks':picks,'initial_label_residuals_px':initial_errors.tolist(),'final_label_residuals_px':(project(worlds,p)-target).tolist(),'cyan_route_sample_count':len(pts),'cyan_route_distance_median_px':float(np.median(err)),'cyan_route_distance_p90_px':float(np.percentile(err,90)),'cyan_route_distance_mean_px':float(err.mean()),'manual_markups':MARKUPS[key]}
  for name,pix in MARKUPS[key].items():
   if name.endswith('names') or name.endswith('order'):continue
   output[name+'_epsg2326']=[ray_ground(q,p) for q in pix]
  result['image_results'][key]=output
  # Diagnostic only: source reference route rendered in red, label ground controls outlined white.
  import matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
  fig,ax=plt.subplots(figsize=(10,wh/100),dpi=140);ax.imshow(im);ax.plot(uv[:,0],uv[:,1],'.',color='red',markersize=.65);pred=project(worlds,p);ax.scatter(pred[:,0],pred[:,1],facecolors='none',edgecolors='white',s=25);ax.set_xlim(0,1000);ax.set_ylim(wh,0);ax.axis('off');fig.subplots_adjust(0,0,1,1);fig.savefig(OUT/f'fit-{key}.png');plt.close(fig)
  print(key,'camera',np.round(p,3),'route_err',np.percentile(err,[50,90]),'markups',[(k,v) for k,v in output.items() if k.endswith('_epsg2326')],flush=True)
  (OUT/'markup_fit.json').write_text(json.dumps(result,indent=2,ensure_ascii=False))
if __name__=='__main__':main()
