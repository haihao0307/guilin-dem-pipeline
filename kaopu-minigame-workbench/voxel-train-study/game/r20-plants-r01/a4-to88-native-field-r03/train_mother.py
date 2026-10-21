"""Authored relation/function-field mother. No source mesh, texture or animation.

A4 1935 Silver Link baseline. Units: m/rad. X forward, Y left, Z up.
This produces structural instances and analytic datums, not a finished exterior.
"""
from dataclasses import dataclass
from math import cos, sin, hypot, isfinite

SOURCE = 'https://theengineer.markallengroup.com/production/2018/09/Gresley-Silver-Jubilee.pdf#page=3'

def inch(n): return float(n) * 0.0254
def ftin(ft, inches=0): return inch(ft*12 + inches)

@dataclass(frozen=True)
class Parameter:
    value: float | None
    unit: str
    basis: str
    source: str | None
    meaning: str

def measured(value, meaning):
    return Parameter(value, 'm', 'observed', SOURCE, meaning + '; drawing, not teacher mesh')

@dataclass(frozen=True)
class Axle:
    instance_id: str
    component_id: str
    role: str
    x: float
    z: float
    radius: float
    axis: tuple = (0.,1.,0.)

    def sample(self, travel_m=0., phase0=0.):
        if not all(isfinite(v) for v in (travel_m, phase0)): raise ValueError('finite motion required')
        # phase0 is an authored pose, not inferred historical crank indexing.
        return {'instance_id':self.instance_id,'component_id':self.component_id,
                'axle_origin_m':[self.x,0.,self.z],'axis':list(self.axis),
                'wheel_phase_rad':phase0+travel_m/self.radius,
                'rolling_radius_m':self.radius,
                'left_wheel_back_y_m':None,'right_wheel_back_y_m':None,
                'back_to_back_m':None,'wheel_profile':None,
                'phase_basis':'specified no-slip illustration; historical crank offsets unknown'}

    def nominal_tread_circle_field(self, x, z):
        """2D analytic rolling-diameter datum. NOT a complete wheel surface."""
        return hypot(x-self.x,z-self.z)-self.radius

def back_planes(back_to_back_m):
    if back_to_back_m is None: return None
    if not isfinite(back_to_back_m) or back_to_back_m <= 0: raise ValueError('positive back-to-back required')
    return [-back_to_back_m/2,back_to_back_m/2]

def pin_center(axle_x, axle_z, side_plane_y, crank_radius, phase):
    vals=(axle_x,axle_z,side_plane_y,crank_radius,phase)
    if any(v is None for v in vals): return None
    if not all(isfinite(v) for v in vals) or crank_radius<=0: raise ValueError('invalid pin parameters')
    # Right-hand positive rotation about +Y: +X rotates toward -Z.
    return (axle_x+crank_radius*cos(phase),side_plane_y,axle_z-crank_radius*sin(phase))

def rod_length_residual(a,b,pin_length):
    if a is None or b is None or pin_length is None: return None
    return sum((x-y)**2 for x,y in zip(a,b))**.5 - pin_length

class TrainMother:
    def __init__(self, tender_origin_x_m=None):
        if tender_origin_x_m is not None and not isfinite(tender_origin_x_m):
            raise ValueError('finite tender transform required')
        self.scope='1935 Silver Link dimensional baseline; not a surveyed 60009 or accepted 88'
        reference_tender_origin=-2*ftin(7,3)-ftin(9,6)-ftin(4,11.375)-ftin(4,2.25)
        self.parameters={
          'track_gauge':Parameter(1.435,'m','specified',None,'nominal standard-gauge design target, not measured from this drawing'),
          'wheel_back_to_back':Parameter(None,'m','unknown',None,'inside back faces of the two wheels; NOT rail gauge'),
          'wheel_profile':Parameter(None,'m','unknown',None,'tread/flange section and measurement convention required'),
          'driver_diameter':measured(ftin(6,8),'driver nominal diameter'),
          'leading_diameter':measured(ftin(3,2),'leading nominal diameter'),
          'trailing_diameter':measured(ftin(3,8),'trailing nominal diameter'),
          'tender_diameter':measured(ftin(4,2),'tender nominal diameter'),
          'tender_origin_x':measured(reference_tender_origin,'front tender axle in locomotive frame; static diagram chain 4ft11 3/8in + 4ft2 1/4in') if tender_origin_x_m is None else Parameter(tender_origin_x_m,'m','specified',None,'authored override, not official diagram'),
          'over_buffers':measured(ftin(70,3.375),'static over buffers length'),
          'total_wheelbase':measured(ftin(60,10.625),'locomotive plus tender outer axle spacing'),
        }
        driver_r=self.parameters['driver_diameter'].value/2
        leading_r=self.parameters['leading_diameter'].value/2
        trailing_r=self.parameters['trailing_diameter'].value/2
        tender_r=self.parameters['tender_diameter'].value/2
        # Source chain, anchored at leading coupled axle x=0.
        self.locomotive=[
          Axle('loco.leading.1','loco','leading',ftin(5,6)+ftin(6,3),leading_r,leading_r),
          Axle('loco.leading.2','loco','leading',ftin(5,6),leading_r,leading_r),
          Axle('loco.driver.1','loco','driver',0.,driver_r,driver_r),
          Axle('loco.driver.2','loco','driver',-ftin(7,3),driver_r,driver_r),
          Axle('loco.driver.3','loco','driver',-2*ftin(7,3),driver_r,driver_r),
          Axle('loco.trailing.1','loco','trailing',-2*ftin(7,3)-ftin(9,6),trailing_r,trailing_r)]
        # Tender local frame is retained even when the source static transform is known.
        tx=[0.,-ftin(5,3),-ftin(5,3)-ftin(5,6),-ftin(16)]
        self.tender=[Axle(f'tender.axle.{i+1}','tender','tender',x,tender_r,tender_r) for i,x in enumerate(tx)]
        self.parts=[
          {'id':'loco','category':'steam_locomotive','parts':['loco.frame','loco.leading_bogie','loco.coupled_drive','loco.trailing_support','loco.steam_system','loco.fairing','loco.cab']},
          {'id':'loco.frame','category':'frame','shape_mother':None},
          {'id':'loco.leading_bogie','category':'leading_bogie','axles':['loco.leading.1','loco.leading.2'],'yaw_pivot_m':None},
          {'id':'loco.coupled_drive','category':'coupled_axles','axles':[f'loco.driver.{i}' for i in (1,2,3)],'pin_planes_m':None,'crank_offsets_rad':None},
          {'id':'loco.trailing_support','category':'trailing_support','axles':['loco.trailing.1'],'pivot_m':None},
          {'id':'loco.steam_system','category':'three_cylinder_motion','cylinder_count':3,'cylinder_bore_m':inch(18.5),'stroke_m':inch(26),'bore_axes_m':None,'valve_gear_dimensions':None},
          {'id':'loco.fairing','category':'authored_body_surface','shape_mother':None,'must_not_erase_running_gear':True},
          {'id':'loco.cab','category':'cab','shape_mother':None},
          {'id':'tender','category':'coal_water_tender','axles':[a.instance_id for a in self.tender],'frame_vs_bogie_topology':None},
          {'id':'coach_candidate','category':'Mark3_reference_candidate','dimensioned':False,'blocks_locomotive_build':False}]
        self.connections=[
          {'a':'loco','b':'tender','type':'drawbar_and_services_candidate','static_transform_known':True,'joint_limits':None,'buffer_compression_m':None,'warning':'static diagram offset is NOT articulation travel or a drawbar pin measurement'},
          {'a':'tender','b':'coach_candidate','type':'coupler_brake_and_service_interfaces','compatibility_verified':False}]

    def sample(self, travel_m=0.):
        tx=self.parameters['tender_origin_x'].value
        global_tender=[a.sample(travel_m) for a in self.tender]
        for a in global_tender:a['axle_origin_m'][0]+=tx
        front_buffer_x=self.locomotive[0].x+ftin(4,1)
        rear_buffer_x=tx+self.tender[-1].x-ftin(5,3.75)
        return {'scope':self.scope,'coordinate_system':'X forward, Y left, Z up; m/rad',
          'locomotive': [a.sample(travel_m) for a in self.locomotive],
          'tender_local':[a.sample(travel_m) for a in self.tender],
          'tender_global':global_tender,
          'buffer_datums_x_m':[rear_buffer_x,front_buffer_x],
          'tender_origin_x_m':self.parameters['tender_origin_x'].value,
          'parts':self.parts,'connections':self.connections,'generated_meshes':0,
          'teacher_runtime_dependencies':[],'full_train_rendered':False}

    def rail_inner_faces(self):
        g=self.parameters['track_gauge'].value
        return {'y_m':[-g/2,g/2],'basis':'specified','measurement_height':None,
                'wheel_back_planes':back_planes(self.parameters['wheel_back_to_back'].value)}

    def full_vehicle_generation_blockers(self):
        return ['wheel back-to-back and tread/flange profile unknown',
                'bearing, suspension pivots, connecting rods and historical crank indexing unresolved',
                'static tender transform verified; articulation, drawbar pins and buffer travel remain unknown',
                'authored exterior and detailed part surfaces not implemented',
                'Mark3 subtype, dimensions and service/coupling compatibility unresolved']

if __name__=='__main__':
    import json
    print(json.dumps(TrainMother().sample(),ensure_ascii=False,indent=2))
