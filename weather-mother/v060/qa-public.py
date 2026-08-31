import base64, hashlib, io, json, math, os, time, traceback, urllib.request
from pathlib import Path
from PIL import Image, ImageStat
from playwright.sync_api import sync_playwright

ROOT = Path("weather-mother/v060")
PUBLIC = "https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/v060/"
report = {"version":"0.6.0","sourceCommit":os.getenv("GITHUB_SHA"),
          "publicURL":PUBLIC,"storedImages":0,"sourceAssets":0,
          "visualAcceptance":False,"productionReady":False,"aaaQualityApproved":False,
          "userHardwarePerformanceVerified":False,"checks":[],"errors":[]}
def check(name, ok, detail=None):
    report["checks"].append({"name":name,"passed":bool(ok),"detail":detail})
    print("CHECK", name, bool(ok), flush=True)
    assert ok, name + ": " + str(detail)
try:
    files = {}
    for name in ["index.html","engine.js","cloud.glsl","field-worker.js"]:
        data=(ROOT/name).read_bytes()
        expected=hashlib.sha256(data).hexdigest()
        got=None
        for attempt in range(35):
            try:
                req=urllib.request.Request(PUBLIC+name+"?qa="+str(time.time_ns()), headers={"Cache-Control":"no-cache","User-Agent":"WeatherMotherQA"})
                with urllib.request.urlopen(req,timeout=25) as response:
                    body=response.read()
                    got=hashlib.sha256(body).hexdigest()
                    status=response.status
                if status==200 and got==expected: break
            except Exception as e:
                got=str(e)
            time.sleep(8)
        files[name]={"sourceBytes":len(data),"sha256":expected,"publicSha256":got,"httpStatus":status if 'status' in locals() else None}
        check("public "+name, got==expected, files[name])
    report["files"]=files
    check("no image assets", not any(p.suffix.lower() in {".png",".jpg",".jpeg",".webp",".hdr",".exr",".ktx",".ktx2"} for p in ROOT.iterdir()))
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=False,args=["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--disable-dev-shm-usage"])
        report["browser"]=browser.version
        report["rendererEnvironment"]="GitHub Actions Xvfb Chromium ANGLE SwiftShader; not user GPU"
        page=browser.new_page(viewport={"width":480,"height":320},device_scale_factor=1)
        page_errors=[]; failed=[]
        page.on("pageerror",lambda e: page_errors.append(str(e)))
        page.on("requestfailed",lambda r: failed.append({"url":r.url,"failure":r.failure}))
        page.add_init_script("window.WeatherMotherBoot={still:true,quality:'balanced'}")
        response=page.goto(PUBLIC+"?qa="+str(time.time_ns()),wait_until="domcontentloaded",timeout=90000)
        check("public HTML navigation",response.status==200)
        def ready(kind=None,after=-1,settle=False):
            page.wait_for_function("([kind,after,settle])=>{const q=window.WeatherMother?.qa;return q&&((q.errors.length>0)||(q.ready&&q.frames>after&&document.getElementById('loading').style.display==='none'&&(!kind||q.activeCloudKind===kind)&&(!settle||q.temporalFrames>=16)));}",arg=[kind,after,settle],timeout=120000)
            q=page.evaluate("window.WeatherMother.qa")
            check("render "+str(kind or "current"),q["ready"] and not q["errors"] and q.get("lastGLerror")==0,q)
            return q
        q=ready("Cu",settle=True)
        report["baseline"]=q
        cdp=page.context.new_cdp_session(page)
        def pixels():
            image=Image.open(io.BytesIO(base64.b64decode(cdp.send("Page.captureScreenshot",{"format":"png"})["data"]))).convert("RGB")
            crop=image.crop((image.width//2,image.height//4,image.width,image.height*4//5))
            st=ImageStat.Stat(crop)
            return {"sha256":hashlib.sha256(image.tobytes()).hexdigest(),"mean":st.mean,"stddev":st.stddev}
        first=pixels();time.sleep(.6);second=pixels()
        check("paused pixels exact after settle",first["sha256"]==second["sha256"],[first,second])
        check("nonblank cloud scene",max(first["stddev"])>4,first)
        report["times"]=[]
        for hour in [6.6,12,17.5,22]:
            before=page.evaluate("window.WeatherMother.qa.frames")
            page.evaluate("(v)=>{WeatherMother.set('hour',v);window.__WEATHER_QA_SNAP__=true}",hour)
            q=ready(after=before,settle=True);px=pixels()
            report["times"].append({"hour":hour,"qa":q,"pixels":px})
        check("four lighting outputs distinct",len({x["pixels"]["sha256"] for x in report["times"]})==4)
        page.evaluate("()=>{WeatherMother.set('hour',14.1);WeatherMother.set('direction',270);WeatherMother.set('wind',20);window.__WEATHER_QA_SNAP__=true;WeatherMother.play()}")
        q=ready(after=page.evaluate("WeatherMother.qa.frames"))
        a=page.evaluate("({t:WeatherMother.qa.simulationTimeS,w:WeatherMother.qa.windOffset})")
        time.sleep(1.5)
        q=ready(after=q["frames"]);page.evaluate("WeatherMother.pause()")
        b=page.evaluate("({t:WeatherMother.qa.simulationTimeS,w:WeatherMother.qa.windOffset})")
        dt=b["t"]-a["t"];dx=b["w"][0]-a["w"][0]
        check("west wind advects east at 20 m/s",dt>0 and abs(dx/dt-.020)<.0001,{"a":a,"b":b,"mps":dx/dt*1000})
        before=page.evaluate("WeatherMother.qa.frames")
        hold=page.evaluate("WeatherMother.qa.windOffset")
        page.evaluate("WeatherMother.set('count',4)")
        page.wait_for_function("WeatherMother.qa.groups===4",timeout=120000)
        q=ready(after=before,settle=True)
        check("count rebuild preserves wind offset",all(abs(x-y)<1e-8 for x,y in zip(hold,q["windOffset"])),[hold,q["windOffset"]])
        for key,start,end,period in [("direction",359,1,360),("hour",23.95,.05,24)]:
            page.evaluate("([k,v])=>{WeatherMother.set(k,v);window.__WEATHER_QA_SNAP__=true}",[key,start])
            q=ready(after=page.evaluate("WeatherMother.qa.frames"))
            page.evaluate("([k,v])=>WeatherMother.set(k,v)",[key,end])
            q=ready(after=q["frames"])
            value=page.evaluate("(k)=>WeatherMother.getState()[k]",key)
            distance=abs((value-start+period*1.5)%period-period*.5)
            check("periodic "+key+" short path",distance<3 if key=="direction" else distance<.15,{"value":value,"start":start,"end":end})
        report["genera"]=[]
        for kind in ["Cu","Cb","Sc","St","Ns","Ac","As","Ci","Cc","Cs"]:
            before=page.evaluate("WeatherMother.qa.frames")
            page.evaluate("(k)=>{WeatherMother.setKind(k);WeatherMother.set('hour',14.1);window.__WEATHER_QA_SNAP__=true}",kind)
            q=ready(kind,after=before)
            report["genera"].append(q)
        report["weatherCases"]=[]
        mapping={"fair":"Cu","coast":"Sc","mountain":"Cu","rain":"Ns","storm":"Cb","rainbow":"Cu","snow":"St","high":"Ci"}
        for case,kind in mapping.items():
            before=page.evaluate("WeatherMother.qa.frames")
            page.evaluate("(w)=>{WeatherMother.setWeather(w);window.__WEATHER_QA_SNAP__=true}",case)
            q=ready(kind,after=before)
            report["weatherCases"].append({"weather":case,"qa":q})
        check("no page errors",not page_errors,page_errors)
        check("no failed public requests",not failed,failed)
        report["pageErrors"]=page_errors;report["failedRequests"]=failed
        browser.close()
    report["passed"]=True
except Exception:
    report["passed"]=False
    report["errors"].append(traceback.format_exc())
finally:
    report["finishedUTC"]=time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())
    Path("weather-mother-v060-qa.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf8")
    print("QA_RESULT",json.dumps(report,ensure_ascii=False),flush=True)
if not report["passed"]: raise SystemExit(1)
