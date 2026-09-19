"""V0.2.7b review-camera correction after browser screenshot inspection.

The first V0.2.7 geometry passed its numerical gates, but the arch inspection
camera sat on the landform's right crown envelope and rendered from inside the
rock.  Move only the review camera farther offshore and higher; world geometry,
shore physics, player state and the frozen Ocean Mother payload are unchanged.
"""


def apply(s: str) -> str:
    old = "if(cameraMode==='arch'){camera.eye=[219,16.8,215];camera.target=[191,10.5,144];camera.forward=norm(sub(camera.target,camera.eye));camera.right=norm(cross(camera.forward,[0,1,0]));camera.up=cross(camera.right,camera.forward);camera.fov=44*Math.PI/180;host.lookAt(camera.view,camera.eye,camera.target,[0,1,0]);host.perspective(camera.proj,camera.fov,aspect,.15,60000);return true;}"
    new = "if(cameraMode==='arch'){camera.eye=[246,32,258];camera.target=[184,10,144];camera.forward=norm(sub(camera.target,camera.eye));camera.right=norm(cross(camera.forward,[0,1,0]));camera.up=cross(camera.right,camera.forward);camera.fov=46*Math.PI/180;host.lookAt(camera.view,camera.eye,camera.target,[0,1,0]);host.perspective(camera.proj,camera.fov,aspect,.15,60000);return true;}"
    assert s.count(old) == 1, s.count(old)
    return s.replace(old, new)
