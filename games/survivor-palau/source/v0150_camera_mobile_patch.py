from pathlib import Path

p=Path('games/survivor-palau/releases/v0.1.5.0/Survivor_Palau_V0.1.5.0_Canoe_Control_Direct_Open.html')
s=p.read_text(encoding='utf-8')

def R(a,b):
    global s
    c=s.count(a)
    if c!=1:
        raise SystemExit(f'expected exactly one marker, got {c}: {a[:160]!r}')
    s=s.replace(a,b,1)

R("@media(max-width:760px){#gameDock{left:10px;bottom:126px;right:10px;max-width:none}#canoeTelemetry{max-width:calc(100vw - 170px)}#boatPad{right:12px;bottom:172px}#boatMission{top:166px;right:10px;width:210px;background:rgba(236,247,249,.70)}}",
  "@media(max-width:760px){#gameDock{left:10px;bottom:126px;right:10px;max-width:none}#canoeTelemetry{max-width:calc(100vw - 170px)}#boatPad{right:12px;bottom:232px}#boatMission{top:245px;right:10px;width:190px;background:rgba(236,247,249,.70)}}")

R("const w=waveAt(CANOE_STATE.x,CANOE_STATE.z,physicalTime,config),followY=w.eta+.66;camera.target=[CANOE_STATE.x,followY,CANOE_STATE.z];camera.yaw=CANOE_STATE.yaw+Math.PI;camera.pitch=.24;camera.distance=10.5;camera.fov=54*Math.PI/180;cameraTween=null;",
  "const w=waveAt(CANOE_STATE.x,CANOE_STATE.z,physicalTime,config),followY=w.eta+.78,forwardX=Math.sin(CANOE_STATE.yaw),forwardZ=Math.cos(CANOE_STATE.yaw),mobileDrive=innerWidth<760;camera.target=[CANOE_STATE.x+forwardX*2.8,followY,CANOE_STATE.z+forwardZ*2.8];camera.yaw=CANOE_STATE.yaw+Math.PI;camera.pitch=mobileDrive?.48:.38;camera.distance=mobileDrive?28:22;camera.fov=58*Math.PI/180;cameraTween=null;")

for marker in ['mobileDrive?28:22','#boatPad{right:12px;bottom:232px}','camera.target=[CANOE_STATE.x+forwardX*2.8']:
    assert marker in s, marker
p.write_text(s,encoding='utf-8')
print(p, len(s.encode()))
