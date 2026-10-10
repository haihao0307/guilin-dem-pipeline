#!/usr/bin/env python3
"""FH88 R04 real-browser driving regression; Python standard library only.

Uses ci_render's reviewed isolated WebDriver, loopback HTTP/CSP, page-request
accounting, real-compositor PNG screenshots and 30 MB artifact budget. It does
NOT reuse the prescribed-time mechanical test as evidence of driving physics.
No installation, downloader, CI trigger, publication, or original asset access.

  python3 ci_drive.py --self-test
  python3 ci_drive.py --chromedriver /PREINSTALLED/chromedriver --out /tmp/fh88-drive-results

A browser PASS requires every driving, UI, geometry and native-codec check.
Missing Chrome/ChromeDriver/codec produces BLOCKED or FAIL, never a fake PASS.
Browser starts paused. The explicit QA external clock disables rAF integration;
all tested moving parts must follow the physics snapshot's one clock/angle.
"""
from __future__ import annotations

import argparse
import base64
import copy
import json
import math
from pathlib import Path
import re
import shutil
import signal
import sqlite3
import subprocess
import sys
import tempfile
import threading
import time
import traceback
import urllib.parse
import unittest
from http.server import ThreadingHTTPServer

import ci_render as core

ROOT = Path(__file__).resolve().parent
EPS = 1e-7
ELEMENT = "element-6066-11e4-a52e-4f735466cecf"


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def near(a, b, label, tolerance=EPS):
    require(isinstance(a, (int, float)) and isinstance(b, (int, float))
            and math.isfinite(a) and math.isfinite(b) and abs(a-b) <= tolerance,
            f"{label}: {a!r} != {b!r} (tol {tolerance})")


def distance(a, b):
    require(len(a) == len(b) == 3, "Expected 3D points")
    return math.sqrt(sum((x-y)**2 for x, y in zip(a, b)))


def same(a, b, label):
    require(core.stable_json(a) == core.stable_json(b), label)


def gear_assertions(snap, parameters, design):
    """Independent SI formulas against ACTUAL mesh-world rod endpoints.

    These are not a collision, inner-crank construction, adhesion or full-train
    dynamics certificate. The adapter reports precisely those limitations.
    """
    core.numeric_leaves(snap)  # reject NaN/Infinity, including all ledgers
    p, m = snap["physics"], snap["mechanism"]
    R, L, r = parameters["train"]["wheelDiameterM"]/2, design["rodPinCentresM"], design["strokeM"]/2
    theta = p["initialMechanicalThetaRad"] - p["wheelAngleRad"]
    near(p["timeS"], p["tick"]*parameters["clock"]["fixedDtS"], "fixed tick clock")
    near(m["timeS"], p["timeS"], "mechanism clock")
    near(m["state"]["worldTimeS"], p["timeS"], "shaft clock")
    near(m["state"]["commonThetaRad"], theta, "shaft phase")
    near(m["state"]["omegaRadS"], -p["wheelAngularSpeedRadS"], "shaft angular speed")
    near(m["state"]["alphaRadS2"], -p["wheelAngularAccelerationRadS2"], "shaft acceleration")
    near(m["bodyTravelM"], p["positionM"], "body/world position")
    near(p["positionM"]-p["rollingOriginPositionM"], R*p["wheelAngleRad"], "rolling origin/angle", 1e-6)
    near(p["speedMps"], R*p["wheelAngularSpeedRadS"], "rolling speed")
    near(p["accelerationMps2"], R*p["wheelAngularAccelerationRadS2"], "rolling acceleration")
    near(m["mechanicalConfiguration"]["wheelRadiusM"], R, "adapter wheel radius")
    near(m["mechanicalConfiguration"]["initialMechanicalThetaRad"], p["initialMechanicalThetaRad"], "adapter initial phase")
    require(m["oldUpdateCalls"] == 0, "Frozen source update must not run")
    cylinders = {c["id"]: c for c in design["cylinders"]}
    require({r0["id"] for r0 in m["mainRods"]} == {"left", "inside", "right"}
            and len(m["mainRods"]) == 3, "Exactly three main rods required")
    rod_errors = []
    for rod in m["mainRods"]:
        c = cylinders[rod["id"]]
        angle = theta+c["crankPhaseRad"]
        dx, dz = r*math.cos(angle), r*math.sin(angle)
        crank = [p["positionM"]+dx, c["axisYM"], R+dz]
        cross = [p["positionM"]+dx+math.sqrt(L*L-dz*dz), c["axisYM"], R]
        near(distance(rod["crankPinM"], crank), 0, rod["id"]+" crank phase")
        near(distance(rod["crossheadM"], cross), 0, rod["id"]+" slider phase")
        a, b = rod["endpointsM"]
        err = min(max(distance(a, crank), distance(b, cross)),
                  max(distance(b, crank), distance(a, cross)))
        near(err, 0, rod["id"]+" actual mesh endpoints")
        near(distance(a, b), L, rod["id"]+" actual mesh length")
        near(rod["lengthM"], L, rod["id"]+" declared length")
        rod_errors.append({"id":rod["id"], "actualEndpointErrorM":err})
    wheels = m["wheels"]
    require(len(wheels) > 0 and len({w["id"] for w in wheels}) == len(wheels), "Wheel identities")
    require(any(w["driver"] for w in wheels) and any(not w["driver"] for w in wheels), "Driver and carrying wheels required")
    for w in wheels:
        require(w["radiusM"] > 0, "Positive wheel radius")
        near(w["centreM"][2], w["radiusM"], w["id"]+" rail datum")
        if w["driver"]:
            near(w["radiusM"], R, w["id"]+" driver radius")
            phase = cylinders["right" if w["centreM"][1]<0 else "left"]["crankPhaseRad"]
            expected = -(theta+phase)
        else:
            expected = p["wheelAngleRad"]*R/w["radiusM"]
        near(w["rotationY"], expected, w["id"]+" physics-driven rotation", 1e-6)
    expected_couplers = sum(max(0,sum(w["driver"] and w["centreM"][1]*side>0 for w in wheels)-1) for side in [-1,1])
    require(len(m["couplingRods"]) == expected_couplers, "Coupling rod count")
    for rod in m["couplingRods"]:
        a, b = rod["endpointsM"]
        near(distance(a,b), rod["lengthM"], "Coupler actual mesh length")
        c = cylinders["right" if a[1]<0 else "left"]
        angle = theta+c["crankPhaseRad"]
        pins = [[w["centreM"][0]+r*math.cos(angle),c["axisYM"],R+r*math.sin(angle)]
                for w in wheels if w["driver"] and w["centreM"][1]*c["axisYM"]>0]
        require(pins, "Coupler has matching driver wheels")
        for point in (a,b):
            near(min(distance(point,pin) for pin in pins), 0, "Coupler actual endpoint matches physical-angle pin")
    require(m["nominalContact"]["pureRolling"] is True, "Nominal pure rolling")
    near(m["nominalContact"]["contactPointLongitudinalVelocityMS"], 0, "Nominal contact slip")
    require(m["nominalContact"]["actualTreadOrAdhesionValidated"] is False, "Nominal-contact limitation must remain explicit")
    return {"clockS":p["timeS"],"tick":p["tick"],"positionM":p["positionM"],"speedMps":p["speedMps"],
            "commonThetaRad":theta,"wheelCount":len(wheels),"actualMainRodEndpoints":rod_errors,
            "actualCouplingRodsChecked":len(m["couplingRods"])}


def motion_assertions(before, after):
    a, b = before["mechanism"], after["mechanism"]
    travel = after["physics"]["positionM"]-before["physics"]["positionM"]
    require(abs(travel)>1e-5, "Travel must actually change")
    aw = {w["id"]:w for w in a["wheels"]}
    for w in b["wheels"]:
        old=aw[w["id"]]
        near((w["rotationY"]-old["rotationY"])*w["radiusM"], travel, w["id"]+" integrated rolling", 1e-6)
        near(w["centreM"][0]-old["centreM"][0], travel, w["id"]+" rigid centre translation", 1e-6)
        near(w["centreM"][1],old["centreM"][1],w["id"]+" lateral centre")
    changes=[]
    for ra,rb in zip(a["mainRods"],b["mainRods"]):
        aa=[[x[0]-a["bodyTravelM"],x[1],x[2]] for x in ra["endpointsM"]]
        bb=[[x[0]-b["bodyTravelM"],x[1],x[2]] for x in rb["endpointsM"]]
        changed=core.compare_numeric(aa,bb)
        require(not changed["equal"], ra["id"]+" must articulate, not just translate")
        changes.append({"id":ra["id"],"localEndpointDeltaM":changed["maxDelta"]})
    return {"travelM":travel,"rodArticulation":changes}


def native_sqlite_info(data, path):
    require(data.startswith(b"SQLite format 3\0"), ".KaoPu must have SQLite magic, not renamed JSON/ZIP")
    require(0<len(data)<=300000, "Native settings size limit")
    core.artifact_write(path,data)
    with sqlite3.connect(path.as_uri()+"?mode=ro", uri=True) as db:
        integrity=db.execute("PRAGMA integrity_check").fetchall()
        require(integrity==[("ok",)], "SQLite integrity check")
        tables=db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()
        require(bool(tables), "Native SQLite requires real tables")
    return {"file":path.name,"bytes":len(data),"sha256":core.sha256(data),"sqliteIntegrity":"ok","tables":[r[0] for r in tables]}


class DriveRun:
    def __init__(self,browser,out,report,parameters,design):
        self.b,self.out,self.report,self.p,self.d=browser,out,report,parameters,design
    def js(self,script,*args):
        return self.b.js("const a=window.FH88_DRIVE; "+script,*args)
    def async_js(self,script,*args):
        result=self.b.cmd("POST","/execute/async",{"script":
            "const done=arguments[arguments.length-1],args=Array.from(arguments).slice(0,-1),a=window.FH88_DRIVE;"
            "Promise.resolve().then(async()=>{"+script+"}).then(value=>done({ok:true,value}),error=>done({ok:false,error:String(error.stack||error)}));",
            "args":list(args)})
        require(result["ok"],"Async browser operation: "+str(result.get("error")))
        return result.get("value")
    def element(self,identity):
        value=self.b.cmd("POST","/element",{"using":"css selector","value":"#"+identity})
        return value.get(ELEMENT) or value.get("ELEMENT")
    def click(self,identity):
        self.b.cmd("POST","/element/"+self.element(identity)+"/click",{})
        self.b.settle()
    def input(self,identity,value):
        # Real WebDriver keyboard input on the rendered range widget. No direct
        # a.controls call or JS-dispatched input is substituted for UI coverage.
        element=self.element(identity)
        bounds=self.b.js("const e=document.getElementById(arguments[0]);return [+e.min,+e.step];",identity)
        steps=round((value-bounds[0])/bounds[1])
        text="\ue011"+"\ue014"*steps
        self.b.cmd("POST","/element/"+element+"/value",{"text":text,"value":list(text)})
        self.b.settle()
        near(self.js("return a.snapshot().physics.controls[arguments[0]];",identity),value,"UI input "+identity)
    def snapshot(self):
        return self.js("return a.snapshot();")
    def checkpoint(self,name,screenshot=False):
        self.b.settle()
        s=self.snapshot()
        scene_frame=self.js("return a.sceneFrame();")
        near(scene_frame["groundCenterX"],s["physics"]["positionM"],name+" ground proxy follows world position")
        near(scene_frame["trainX"],s["physics"]["positionM"],name+" body follows world position")
        metrics=gear_assertions(s,self.p,self.d)
        telemetry=self.b.js("return Object.fromEntries(['speed','clock','distance','pressure','force','power','steam','stores','limit','status'].map(id=>[id,document.getElementById(id).textContent]));")
        near(float(telemetry["speed"]),round(s["physics"]["speedMps"]*3.6,1),name+" speed instrument",.051)
        record={"name":name,"sceneFrame":scene_frame,"gear":metrics,"telemetry":telemetry,"snapshot":name+"-snapshot.json"}
        core.json_write(self.out/(name+"-snapshot.json"),s)
        if screenshot: record["screenshot"]=self.b.capture(name,viewport=True)
        self.report["checks"].append(record)
        return s
    def advance(self,seconds):
        self.js("a.advanceSeconds(arguments[0]);",seconds)
        return self.snapshot()
    def run_all(self):
        b=self.b
        cold=self.checkpoint("00-cold-paused")
        require(cold["physics"]["paused"] is True,"Browser defaults paused")
        near(cold["physics"]["timeS"],0,"Cold time")
        # Explicitly separate QA time from wall time before any motion.
        require(self.js("return a.setExternalClock(true);") is True,"External QA clock")
        self.js("window.FH88_PREVIEW=a;") # helper alias only; no old setTime tests
        for cycle in range(3):
            for mode in ("full","mechanism"):
                self.click(mode);self.click(mode)
                require(self.snapshot()["view"]["mode"]==mode,"Repeated mode button")
            for camera in ("overview","side","inside","cab"):
                self.click(camera);self.click(camera)
                require(self.snapshot()["view"]["camera"]==camera,"Repeated camera button")
            self.click("run");require(self.snapshot()["physics"]["paused"] is False,"UI start toggle")
            self.click("run");require(self.snapshot()["physics"]["paused"] is True,"UI pause toggle")
            for direction,value in (("neutral",0),("forward",1)):
                self.click(direction);self.click(direction)
                require(self.snapshot()["physics"]["controls"]["reverser"]==value,"Repeated direction button")
            self.click("reset");self.click("reset")
            near(self.snapshot()["physics"]["timeS"],0,"Repeated reset")
        self.report["repeatedUI"]={"cycles":3,"controls":["full","mechanism","overview","side","inside","cab","run","reset","neutral","forward"],"inputMethod":"WebDriver element click/keyboard"}
        self.js("a.reset({positionM:137.25});")
        origin=self.checkpoint("01-nonzero-origin-reset")
        near(origin["physics"]["positionM"],137.25,"Nonzero origin")
        near(origin["physics"]["rollingOriginPositionM"],137.25,"Saved rolling origin")
        near(origin["physics"]["wheelAngleRad"],0,"Reset relative wheel angle")
        near(origin["mechanism"]["state"]["commonThetaRad"],self.p["train"]["initialMechanicalThetaRad"],"Reset phase")
        self.click("overview");self.click("run")
        require(not self.snapshot()["physics"]["paused"],"Start driving click")
        self.input("brake",0);self.input("cutoff",.60);self.input("throttle",.65)
        self.advance(15)
        start=self.checkpoint("02-started-instruments",True)
        require(start["physics"]["speedMps"]>self.p["engine"]["maxDirectionChangeSpeedMps"],"Released brake plus throttle must start forward")
        require(start["physics"]["positionM"]>137.25,"Forward travel")
        self.report["startMotion"]=motion_assertions(origin,start)
        same(start,self.snapshot(),"External clock prevents intervening wall-frame advance")
        self.click("mechanism");self.click("inside");self.advance(.5)
        gear=self.checkpoint("03-mechanism-running",True)
        self.report["runningMotion"]=motion_assertions(start,gear)
        before=self.snapshot();self.click("reverse");after=self.snapshot()
        same(before,after,"Illegal high-speed UI direction change must be atomic")
        require("DIRECTION_CHANGE_REQUIRES_NEAR_STOP" in self.b.js("return document.getElementById('status').textContent;"),"Illegal direction rejection visible")
        reject=self.js("try{a.controls({reverser:-1,throttle:0});return null}catch(e){return String(e.message)}")
        require(reject and "DIRECTION_CHANGE_REQUIRES_NEAR_STOP" in reject,"API direction rejection")
        same(before,self.snapshot(),"Rejected control patch must preserve all state")
        self.checkpoint("04-high-speed-reversal-rejected")
        self.click("run");paused=self.snapshot();require(paused["physics"]["paused"],"Pause button")
        self.advance(3);b.settle();same(paused,self.snapshot(),"Pause freezes time, heat, fuel, wheels, rods and position")
        self.checkpoint("05-paused-frozen")
        self.click("run");self.input("throttle",0)
        pre_coast=self.snapshot();self.advance(5)
        coast=self.checkpoint("06-throttle-closed-coasting")
        require(0<coast["physics"]["speedMps"]<pre_coast["physics"]["speedMps"],"Closed-throttle train coasts with deceleration")
        near(coast["physics"]["diagnostics"]["tractionForceN"],0,"No closed-throttle traction")
        self.report["coastingMotion"]=motion_assertions(pre_coast,coast)
        self.click("emergency");self.click("emergency")
        emergency=self.snapshot();near(emergency["physics"]["controls"]["throttle"],0,"Emergency closes throttle")
        near(emergency["physics"]["controls"]["brake"],1,"Emergency applies brake")
        brake_trace=[];brake_elapsed=0;previous_speed=emergency["physics"]["speedMps"]
        while brake_elapsed<60:
            # Observe EVERY fixed tick near the zero crossing, rather than
            # allowing an oscillation to hide between sparse quarter-seconds.
            dt=self.p["clock"]["fixedDtS"] if previous_speed<.4 else .25
            s=self.advance(dt);brake_elapsed+=dt;gear_assertions(s,self.p,self.d)
            previous_speed=s["physics"]["speedMps"]
            brake_trace.append({"stepS":dt,"timeS":s["physics"]["timeS"],"speedMps":s["physics"]["speedMps"],"positionM":s["physics"]["positionM"]})
            require(s["physics"]["speedMps"]>=-EPS,"Brake must never create backward bounce")
            if abs(s["physics"]["speedMps"])<1e-10: break
        else: raise AssertionError("Did not brake to rest within 60 simulated seconds")
        stopped_at=s["physics"]["positionM"]
        for _ in range(8):
            s=self.advance(.25)
            near(s["physics"]["speedMps"],0,"Remain stopped after braking")
            near(s["physics"]["positionM"],stopped_at,"No post-stop position bounce")
        self.click("side");stopped=self.checkpoint("07-stopped",True)
        core.json_write(self.out/"braking-trace.json",brake_trace)
        self.report["braking"]={"trace":"braking-trace.json","samples":len(brake_trace),"stoppedPositionM":stopped_at,"heldAtRestS":2}
        self.click("reverse");self.click("reverse")
        require(self.snapshot()["physics"]["controls"]["reverser"]==-1,"Near-stop reversal succeeds")
        self.input("brake",0);self.input("throttle",.5);self.advance(10)
        reverse=self.checkpoint("08-reversing")
        require(reverse["physics"]["speedMps"]<-.2 and reverse["physics"]["positionM"]<stopped_at,"Released brake plus reverse throttle moves backward")
        self.report["reverseMotion"]=motion_assertions(stopped,reverse)
        self.codec_tests(reverse)
        self.click("reset");self.click("reset")
        final=self.checkpoint("12-final-paused-reset")
        require(final["physics"]["paused"],"Final reset pauses")
        near(final["physics"]["timeS"],0,"Final reset clock")
        near(final["physics"]["positionM"],0,"Final default reset origin")
        # Chromium viewport/touch emulation only, never claim an iOS device test.
        self.mobile_tests()
        self.report["drivingScenariosComplete"]=True

    def mobile_tests(self):
        results=[]
        for height in (844, 664):
            self.b.cdp('Emulation.setDeviceMetricsOverride',{'width':390,'height':height,'deviceScaleFactor':1,'mobile':True})
            self.b.settle()
            frame=self.b.js("return {w:innerWidth,h:innerHeight,vw:visualViewport.width,vh:visualViewport.height,p:document.querySelector('.panel').getBoundingClientRect().toJSON(),t:document.querySelector('.telemetry').getBoundingClientRect().toJSON(),c:document.querySelector('canvas').getBoundingClientRect().toJSON()};")
            self.report['latestMobileLayout']=frame
            require(frame['w']==390 and frame['h']==height,'Exact mobile viewport: '+str(frame))
            require(abs(frame['c']['height']-height*.52)<2 and abs(frame['p']['top']-height*.52)<2,'Mobile camera and controls split')
            require(frame['t']['bottom']<=frame['p']['top'],'Mobile instruments never overlap control panel')
            hit=[]
            for identity in ['run','reset','emergency','throttle','brake','cutoff','reverse','neutral','forward','mechanism','full','cab','overview','side','inside','save','open']:
                result=self.b.js("const e=document.getElementById(arguments[0]);e.scrollIntoView({block:'center',inline:'nearest'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);return {id:e.id,rect:r.toJSON(),hit:hit?.id||hit?.tagName,ok:hit===e||e.contains(hit),w:innerWidth,h:innerHeight};",identity)
                rr=result['rect'];require(result['ok'] and rr['left']>=0 and rr['right']<=390 and rr['top']>=0 and rr['bottom']<=height,'Mobile control reachable without overlap: '+str(result));hit.append(result)
            self.click('reset')
            touches=[]
            for identity,ratio in [('brake',0),('throttle',.4),('cutoff',.5)]:
                point=self.b.js("const e=document.getElementById(arguments[0]);e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.left+8+(r.width-16)*arguments[1],y:r.top+r.height/2};",identity,ratio)
                self.b.cdp('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[dict(point,radiusX=1,radiusY=1,force=1,id=1)]})
                self.b.cdp('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});self.b.settle();touches.append({'id':identity,'point':point,'value':self.snapshot()['physics']['controls'][identity]})
            controls=self.snapshot()['physics']['controls'];require(controls['brake']<.1 and .2<controls['throttle']<.6 and .3<controls['cutoff']<.6,'Real mobile slider taps change physical controls: '+str(controls))
            self.click('run');require(not self.snapshot()['physics']['paused'],'Mobile start click')
            self.js("return a.setExternalClock(false);");before=self.snapshot()['physics'];time.sleep(1.1);after=self.snapshot()['physics'];self.js("return a.setExternalClock(true);")
            require(after['positionM']>before['positionM'] and after['timeS']>before['timeS'],'Mobile real-time start moves train')
            self.click('emergency');near(self.snapshot()['physics']['controls']['brake'],1,'Mobile emergency click')
            self.click('run');require(self.snapshot()['physics']['paused'],'Mobile pause click')
            self.b.js("document.querySelector('.panel').scrollTop=0;")
            x=8;y0=height-28;y1=frame['p']['top']+80
            self.b.cdp('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y0,'id':2}]})
            for k in range(1,6):
                self.b.cdp('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y0+(y1-y0)*k/5,'id':2}]});time.sleep(.035)
            self.b.cdp('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});self.b.settle()
            scrolled=self.b.js("return document.querySelector('.panel').scrollTop;");require(scrolled>10,'Real touch drag scrolls panel, not camera')
            self.b.js("document.querySelector('.panel').scrollTop=0;");self.b.settle();self.checkpoint('13-mobile-390x'+str(height)+'-paused',True)
            results.append({'actualDevice':False,'emulatedViewport':[390,height],'layout':frame,'reachableControls':hit,'realButtonClicks':['reset','run','emergency','run'],'sliderTouchCoordinates':touches,'touchScrolledPanelPx':scrolled,'realTimeMotionM':after['positionM']-before['positionM']})
        self.report['mobileViewports']=results
        self.b.cdp('Emulation.clearDeviceMetricsOverride',{});self.b.settle()

    def codec_tests(self,saved):
        require(self.js("return a.codecReady===true;"),"Native codec unavailable; full driving run cannot pass")
        self.click("cab");saved=self.snapshot()
        # Save a moving, depleted state, then require settings hot-start, not a
        # false thermal/motion resume. The archived snapshot is provenance only.
        payload=self.async_js("const bytes=await a.exportSettings();window.__FH88_DRIVE_SAVED=new Uint8Array(bytes);let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);")
        data=base64.b64decode(payload,validate=True)
        native=native_sqlite_info(data,self.out/"FH88_Driving_Settings_R04.KaoPu")
        self.report["nativeFile"]=native
        # Exercise the real save button and verify a browser download, not only
        # the export API. Downloads stay inside the disposable isolated profile.
        downloads=self.b.work/"downloads";downloads.mkdir()
        self.b.cdp("Page.setDownloadBehavior",{"behavior":"allow","downloadPath":str(downloads)})
        self.click("save")
        deadline=time.monotonic()+12;download=None
        while time.monotonic()<deadline:
            files=list(downloads.glob("*.KaoPu"))
            if files: download=files[0];break
            time.sleep(.1)
        require(download is not None,"UI save must produce real .KaoPu download")
        downloaded=download.read_bytes()
        require(downloaded.startswith(b"SQLite format 3\0"),"UI downloaded SQLite magic")
        same(core.sha256(downloaded),core.sha256(data),"UI and API native exports agree at identical external-clock state")
        self.report["uiSaveDownload"]={"bytes":len(downloaded),"sha256":core.sha256(downloaded),"name":download.name}
        self.input("throttle",.2);self.input("cutoff",.4);self.advance(2)
        changed=self.snapshot();require(changed["physics"]["timeS"]>saved["physics"]["timeS"],"State changed before reload")
        # Real Open button is clicked with intercepted file chooser; WebDriver
        # selects the local file into the actual hidden HTML file input.
        self.b.cdp("Page.setInterceptFileChooserDialog",{"enabled":True})
        self.click("open")
        path=str((self.out/"FH88_Driving_Settings_R04.KaoPu").resolve())
        self.b.cmd("POST","/element/"+self.element("load")+"/value",{"text":path,"value":list(path)})
        deadline=time.monotonic()+15
        while time.monotonic()<deadline:
            s=self.snapshot()
            if s["physics"]["paused"] and s["physics"]["timeS"]==0: break
            time.sleep(.1)
        restored=self.checkpoint("09-native-ui-hot-restart")
        self.assert_hot_restart(saved,restored)
        archive=self.js("return a.getImportedArchive();")
        require(archive["purpose"]=="inspection-only-not-restored","Archive inspection-only marker")
        near(archive["capturedAtSimulationTimeS"],saved["physics"]["timeS"],"Archived simulation time")
        same(archive["unifiedInstance"],saved["physics"],"Full archived physics retained separately from hot restart")
        self.report["archivedSnapshotRetainedButNotRestored"]=True
        require(self.b.js("return document.getElementById('load').value;")=="","File input cleared so same file can reload")
        self.async_js("await a.importSettings(window.__FH88_DRIVE_SAVED);return true;")
        same(restored,self.snapshot(),"Repeated native import yields same hot restart")
        self.report["nativeHotRestart"]={"resetTimeS":restored["physics"]["timeS"],"paused":restored["physics"]["paused"],"archivedTimeS":saved["physics"]["timeS"],"archivedSpeedMps":saved["physics"]["speedMps"],"savedOriginM":saved["physics"]["positionM"],"thermalBreakpointResumeClaimed":False}
        self.input("throttle",.31)
        atomic=self.snapshot()
        for kind in ("truncated","wrong-magic","last-byte","empty"):
            error=self.async_js("let bytes=new Uint8Array(window.__FH88_DRIVE_SAVED);if(args[0]==='truncated')bytes=bytes.slice(0,24);if(args[0]==='wrong-magic')bytes[0]^=255;if(args[0]==='last-byte')bytes[bytes.length-1]^=1;if(args[0]==='empty')bytes=new Uint8Array();try{await a.importSettings(bytes);return null}catch(e){return String(e.message)}",kind)
            require(bool(error),"Corrupt .KaoPu must reject: "+kind)
            same(atomic,self.snapshot(),"Corrupt import atomicity: "+kind)
            same(archive,self.js("return a.getImportedArchive();"),"Corrupt import preserves retained archive: "+kind)
            self.report.setdefault("corruptImports",[]).append({"case":kind,"rejected":True,"error":error,"snapshotUnchanged":True})
        self.checkpoint("10-corrupt-import-atomic")
        # Also cover UI file error and visible recovery, preserving current state.
        bad=self.out/"corrupt.KaoPu";core.artifact_write(bad,b"not a SQLite settings file")
        self.click("open");path=str(bad.resolve())
        self.b.cmd("POST","/element/"+self.element("load")+"/value",{"text":path,"value":list(path)})
        deadline=time.monotonic()+5
        while time.monotonic()<deadline:
            text=self.b.js("return document.getElementById('status').textContent;")
            if "未载入" in text:break
            time.sleep(.1)
        require("未载入" in text,"UI corrupt-load error must be visible")
        same(atomic,self.snapshot(),"UI corrupt-load state remains atomic")
        same(archive,self.js("return a.getImportedArchive();"),"UI corrupt load preserves archive")
        self.checkpoint("11-ui-corrupt-import-atomic")
        # A non-default initial shaft phase must survive native parameter encode,
        # import, and re-export, without creating wheel travel at nonzero origin.
        saved_recipe=self.async_js("const c=await import('./codec/codec.mjs');const p=c.defaultParameters();p.train.initialMechanicalThetaRad=1.123;const r=c.createRestartRecipe(p,{initial:{positionM:731.5,speedMps:0},view:{mode:'mechanism',camera:'cab'}});await a.importSettings(await c.encode(r));return await c.decode(await a.exportSettings());")
        self.p=copy.deepcopy(self.p);self.p['train']['initialMechanicalThetaRad']=1.123
        phase=self.checkpoint('11b-native-nondefault-phase-origin')
        near(phase['physics']['positionM'],731.5,'Native nonzero origin')
        near(phase['physics']['wheelAngleRad'],0,'Native phase preserves zero relative travel')
        near(phase['mechanism']['state']['commonThetaRad'],1.123,'Native nondefault phase')
        near(saved_recipe['parameters']['train']['initialMechanicalThetaRad'],1.123,'Re-export preserves changed parameter')
        self.report['nondefaultPhaseNativeRoundtrip']={'initialMechanicalThetaRad':1.123,'positionM':731.5,'reexported':True}

    def assert_hot_restart(self,saved,restored):
        old,p=saved["physics"],restored["physics"]
        require(p["paused"] is True,"Native reload pauses")
        near(p["timeS"],0,"Native reload resets clock");near(p["tick"],0,"Native reload resets tick")
        near(p["speedMps"],0,"Native reload is stationary hot start")
        near(p["positionM"],old["positionM"],"Native restart position")
        near(p["rollingOriginPositionM"],old["positionM"],"Native restart rolling origin")
        near(p["wheelAngleRad"],0,"Native reset phase offset")
        same(p["controls"],old["controls"],"Saved controls restored")
        same(restored["view"],saved["view"],"Saved mode/camera restored")
        near(p["boilerPressurePa"],self.p["supply"]["initialPressurePa"],"Hot-start parameter pressure")
        near(p["waterKg"],self.p["supply"]["waterInitialKg"],"Hot-start water reset")
        near(p["coalKg"],self.p["supply"]["coalInitialKg"],"Hot-start coal reset")
        for key,value in p["ledger"].items():near(value,0,"Hot-start ledger "+key)
        gear_assertions(restored,self.p,self.d)


def run(args):
    out=Path(args.out).resolve()
    require(out!=ROOT and not (ROOT in out.parents and out.name.startswith('.')),"Distinct non-hidden output directory required")
    require(not out.exists() or not any(out.iterdir()),"Use a fresh empty output directory; prior evidence is never removed")
    out.mkdir(parents=True,exist_ok=True);core.ARTIFACT_ROOT=out
    report={"result":"NOT_RUN","test":"FH88 R04 actual browser driving / UI / native settings",
            "entry":"drive.html","startedUTC":time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),"checks":[],
            "externalQAClock":True,"browserStartsPaused":True,"newBrowserProfile":True,"cacheDisabled":True,
            "artifactBudgetBytes":core.MAX_ARTIFACT_BYTES,"maximumRunSeconds":args.max_seconds,
            "browserEnvironmentAllowlist":["PATH","LANG","LC_ALL","TZ","HOME","TMPDIR","XDG_CONFIG_HOME","XDG_CACHE_HOME"],
            "syntheticImageGeneration":False,"noPackageInstallation":True,"noExternalAssetDownload":True,
            "noOriginalAssetRead":True,"noCITrigger":True,"previousMechanicalTestsClaimedAsDrivingCoverage":False,
            "sourceManifest":core.source_manifest(ROOT,out)}
    for name in ('ci_drive.py',):
        data=(ROOT/name).read_bytes();report['sourceManifest'].append({'path':name,'bytes':len(data),'sha256':core.sha256(data)})
    requests=[];lock=threading.Lock();browser=server=thread=work=None;origin=None
    alarm_available=hasattr(signal,'SIGALRM');old_handler=None
    try:
        if alarm_available:
            def timeout_handler(signum,frame):raise TimeoutError('Driving browser regression exceeded its wall-clock budget')
            old_handler=signal.signal(signal.SIGALRM,timeout_handler);signal.setitimer(signal.ITIMER_REAL,args.max_seconds)
        chrome=shutil.which(args.chrome) if args.chrome else next((p for n in ('google-chrome','google-chrome-stable','chromium','chromium-browser') if (p:=shutil.which(n))),None)
        driver=shutil.which(args.chromedriver) if args.chromedriver else shutil.which('chromedriver')
        if not chrome or not driver:
            report['result']='BLOCKED_MISSING_PREINSTALLED_BROWSER_OR_DRIVER'
            raise RuntimeError('Preinstalled Chrome and ChromeDriver required. Supply --chromedriver /existing/path; no installation or download attempted.')
        require((ROOT/'drive.html').is_file(),'drive.html missing')
        work=tempfile.TemporaryDirectory(prefix='fh88-drive-browser-');wp=Path(work.name)
        env=core.clean_environment(wp/'home')
        report['browserVersions']={name:subprocess.check_output([path,'--version'],text=True,timeout=15,env=env).strip() for name,path in [('chrome',chrome),('chromedriver',driver)]}
        require(re.search(r'\d+',report['browserVersions']['chrome']).group()==re.search(r'\d+',report['browserVersions']['chromedriver']).group(),'Preinstalled browser/driver major version mismatch')
        report['browserPaths']={'chrome':chrome,'chromedriver':driver}
        server=ThreadingHTTPServer(('127.0.0.1',0),core.make_handler(ROOT,out,requests,lock));server.daemon_threads=True
        origin=f'http://127.0.0.1:{server.server_port}';thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        browser=core.Browser(chrome,driver,out,wp,args.no_sandbox);browser.start()
        report['browserStarted']=True;report['sandboxDisabledByExplicitFlag']=args.no_sandbox
        browser.cmd('POST','/url',{'url':origin+'/drive.html'})
        deadline=time.monotonic()+args.ready_timeout;state={}
        while time.monotonic()<deadline:
            state=browser.js("return {ready:window.FH88_DRIVE?.ready===true,codecReady:window.FH88_DRIVE?.codecReady===true,error:window.FH88_DRIVE_ERROR||null,codecError:window.FH88_CODEC_ERROR||null};")
            if (state['ready'] and state['codecReady']) or state['error'] or state['codecError']:break
            time.sleep(.1)
        report['coldStart']=state
        require(state.get('ready') and not state.get('error'),'Driving entry failed cold start: '+repr(state))
        # Codec absence is a real blocker; never ignore its 404 or console error.
        if not state.get('codecReady'):
            report['result']='BLOCKED_NATIVE_CODEC_NOT_READY';raise RuntimeError('Driving native codec not ready: '+repr(state))
        browser.js('window.FH88_PREVIEW=window.FH88_DRIVE;window.FH88_DRIVE.setExternalClock(true);')
        report['webgl']=core.browser_information(browser);require(not report['webgl']['contextLost'],'WebGL context lost')
        parameters=json.loads((ROOT/'physics/parameters.json').read_text());design=json.loads((ROOT/'frozen/three-cylinder/design.json').read_text())
        DriveRun(browser,out,report,parameters,design).run_all()
        report['logs']=core.collect_logs(browser,origin)
        require(not report['logs']['externalRequests'] and not report['logs']['failedRequests'],'External or failed page request')
        require(not any(int(r['status'])>=400 for r in requests),'HTTP asset failure')
        hooks=report['logs']['javascript']
        require(not hooks['errors'] and not hooks['rejections'],'JavaScript errors/unhandled rejections')
        require(not any(x.get('level')=='SEVERE' for x in report['logs']['console']),'Severe browser console error')
        report['result']='PASS_REAL_BROWSER_DRIVING_UI_GEOMETRY_AND_NATIVE_RESTART'
        print(report['result'],flush=True);return 0
    except Exception as exc:
        if not report['result'].startswith('BLOCKED_'):report['result']='FAILED_OR_INCOMPLETE'
        report['error']=str(exc);report['traceback']=traceback.format_exc()
        if browser and browser.url and 'logs' not in report:
            try:report['logs']=core.collect_logs(browser,origin)
            except Exception as log_error:report['logCollectionError']=str(log_error)
        print(report['result']+': '+str(exc),file=sys.stderr,flush=True);return 1
    finally:
        if alarm_available:
            signal.setitimer(signal.ITIMER_REAL,0)
            if old_handler is not None:signal.signal(signal.SIGALRM,old_handler)
        if browser:browser.close()
        if server:server.shutdown();server.server_close()
        if thread:thread.join(timeout=5)
        if work:work.cleanup()
        report['serverRequests']=list(requests);report['finishedUTC']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
        report['artifactBytesBeforeFinalReport']=core.artifact_bytes(out)
        core.json_write(out/'TEST_RESULTS.json',report)
        require(core.artifact_bytes(out)<=core.MAX_ARTIFACT_BYTES,'Artifact budget exceeded')
        print('Saved '+str(out/'TEST_RESULTS.json'),flush=True)


def geometry_fixture():
    """Small self-test-only analytic fixture. Never rendered or used as evidence."""
    parameters=json.loads((ROOT/'physics/parameters.json').read_text())
    design=json.loads((ROOT/'frozen/three-cylinder/design.json').read_text())
    R=.95;origin=137.25;angle=1;theta=parameters['train']['initialMechanicalThetaRad']-angle;x=origin+R
    p={'timeS':1,'tick':120,'positionM':x,'rollingOriginPositionM':origin,'initialMechanicalThetaRad':.25,
       'wheelAngleRad':angle,'speedMps':.2,'wheelAngularSpeedRadS':.2/R,'accelerationMps2':.03,'wheelAngularAccelerationRadS2':.03/R}
    m={'timeS':1,'state':{'worldTimeS':1,'commonThetaRad':theta,'omegaRadS':-.2/R,'alphaRadS2':-.03/R},
       'mechanicalConfiguration':{'wheelRadiusM':R,'initialMechanicalThetaRad':.25},'bodyTravelM':x,'oldUpdateCalls':0,
       'mainRods':[],'couplingRods':[],'wheels':[],
       'nominalContact':{'pureRolling':True,'contactPointLongitudinalVelocityMS':0,'actualTreadOrAdhesionValidated':False}}
    r=design['strokeM']/2;L=design['rodPinCentresM']
    for c in design['cylinders']:
        t=theta+c['crankPhaseRad'];dx=r*math.cos(t);dz=r*math.sin(t)
        crank=[x+dx,c['axisYM'],R+dz];cross=[x+dx+math.sqrt(L*L-dz*dz),c['axisYM'],R]
        m['mainRods'].append({'id':c['id'],'lengthM':L,'endpointsM':[crank[:],cross[:]],'crankPinM':crank[:],'crossheadM':cross[:]})
        if c['id']!='inside':
            side=-1 if c['id']=='right' else 1
            for i in range(2):m['wheels'].append({'id':c['id']+str(i),'driver':True,'radiusM':R,'centreM':[x-2*i,side*.7525,R],'rotationY':-t})
            m['couplingRods'].append({'lengthM':2,'endpointsM':[[x+dx,c['axisYM'],R+dz],[x-2+dx,c['axisYM'],R+dz]]})
    m['wheels'].append({'id':'carrier','driver':False,'radiusM':.5,'centreM':[x+2,.7525,.5],'rotationY':angle*R/.5})
    return {'physics':p,'mechanism':m},parameters,design


def self_test():
    """Pure local helper/unit tests; no browser, network, subprocess, or CI."""
    class Tests(unittest.TestCase):
        def test_gear_fixture(self):
            s,p,d=geometry_fixture();metrics=gear_assertions(s,p,d)
            self.assertEqual(metrics['wheelCount'],5);self.assertEqual(len(metrics['actualMainRodEndpoints']),3)
        def test_clock_phase_and_mesh_mutations_are_rejected(self):
            original,p,d=geometry_fixture()
            mutations=[lambda s:s['mechanism'].__setitem__('timeS',2),
                       lambda s:s['mechanism']['state'].__setitem__('commonThetaRad',1),
                       lambda s:s['mechanism']['mainRods'][0]['endpointsM'][0].__setitem__(0,999),
                       lambda s:s['mechanism']['mainRods'][1]['crossheadM'].__setitem__(2,2),
                       lambda s:s['mechanism']['wheels'][-1].__setitem__('rotationY',0),
                       lambda s:s['mechanism']['couplingRods'][0]['endpointsM'][0].__setitem__(1,0),
                       lambda s:s['physics'].__setitem__('rollingOriginPositionM',0)]
            for mutation in mutations:
                with self.subTest(mutation=repr(mutation)):
                    s=copy.deepcopy(original);mutation(s)
                    with self.assertRaises(AssertionError):gear_assertions(s,p,d)
        def test_finite_numbers(self):
            with self.assertRaises(AssertionError):core.numeric_leaves({'physics':{'speedMps':math.nan}})
        def test_near_checks(self):
            near(1,1+1e-9,'tolerance')
            for value in (float('inf'),float('nan'),2):
                with self.assertRaises(AssertionError):near(value,1,'bad')
        def test_exact_atomic_comparison(self):
            same({'timeS':1,'control':0},{'control':0,'timeS':1},'same')
            with self.assertRaises(AssertionError):same({'timeS':1},{'timeS':2},'changed')
        def test_endpoint_distance(self):
            near(distance([0,0,0],[0,0,3.2]),3.2,'length')
            with self.assertRaises(AssertionError):distance([0,0],[0,0])
        def test_native_magic_rejects_json(self):
            with tempfile.TemporaryDirectory() as tmp:
                with self.assertRaises(AssertionError):native_sqlite_info(b'{"parameters":{}}',Path(tmp)/'fake.KaoPu')
        def test_sqlite_integrity(self):
            with tempfile.TemporaryDirectory() as tmp:
                src=Path(tmp)/'source.sqlite'
                with sqlite3.connect(src) as db:db.execute('CREATE TABLE settings(id INTEGER PRIMARY KEY,value TEXT)');db.execute("INSERT INTO settings VALUES(1,'test')")
                info=native_sqlite_info(src.read_bytes(),Path(tmp)/'test.KaoPu')
                self.assertEqual(info['tables'],['settings']);self.assertEqual(info['sqliteIntegrity'],'ok')
        def test_inherited_server_confinement(self):
            with tempfile.TemporaryDirectory() as tmp:
                root=Path(tmp);(root/'drive.html').write_text('test');(root/'ci_drive.py').write_text('secret')
                self.assertEqual(core.resolved_file(root,'/drive.html',root/'out'),root/'drive.html')
                for url in ('/ci_drive.py','/../secret','/%2e%2e/secret','/.hidden','/x.KaoPu'):
                    self.assertIsNone(core.resolved_file(root,url,root/'out'))
        def test_clean_environment_allowlist(self):
            with tempfile.TemporaryDirectory() as tmp:
                env=core.clean_environment(Path(tmp))
                self.assertEqual(set(env),{'PATH','LANG','LC_ALL','TZ','HOME','TMPDIR','XDG_CONFIG_HOME','XDG_CACHE_HOME'})
        def test_csp_forbids_external_connections(self):
            self.assertIn("connect-src 'self'",core.CSP);self.assertIn("object-src 'none'",core.CSP)
    result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Tests))
    print('SELF_TEST_ONLY: no real-browser driving PASS is claimed.')
    return 0 if result.wasSuccessful() else 1


def main():
    parser=argparse.ArgumentParser(description=__doc__,formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--out',default=str(ROOT/'drive-results'))
    parser.add_argument('--chrome',help='Preinstalled Chrome/Chromium path; no downloads')
    parser.add_argument('--chromedriver',help='Existing preinstalled ChromeDriver path; no downloads')
    parser.add_argument('--ready-timeout',type=float,default=60)
    parser.add_argument('--max-seconds',type=int,default=480)
    parser.add_argument('--no-sandbox',action='store_true',help='Explicit opt-in for an already isolated runner only')
    parser.add_argument('--self-test',action='store_true',help='Pure local tests only; no browser/network/subprocess/CI')
    args=parser.parse_args()
    if not 1<=args.ready_timeout<=180 or not 60<=args.max_seconds<=480:parser.error('ready-timeout 1..180; max-seconds 60..480')
    return self_test() if args.self_test else run(args)


if __name__=='__main__':raise SystemExit(main())
