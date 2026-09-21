#!/usr/bin/env python3
"""Browser QA for the Airai R12 evidence runtime.

The script injects the exact shipped files into a browser page instead of using
network navigation, so it also works in locked-down review environments. For
WebGL2 under Linux software rendering, run it inside xvfb-run without --headless.
"""
from __future__ import annotations
import argparse, asyncio, json, pathlib, re
from playwright.async_api import async_playwright

HERE=pathlib.Path(__file__).resolve().parent

def extract_page():
    html=(HERE/'index.html').read_text(encoding='utf-8')
    blocks=re.findall(r'<script(?: src="([^"]+)")?>(.*?)</script>',html,re.S)
    skeleton=re.sub(r'<script(?: [^>]*)?>.*?</script>','',html,flags=re.S)
    paths=[HERE/src for src,body in blocks if src]
    inline=blocks[-1][1]
    return skeleton,paths,inline

async def run_case(pw,name,w,h,mobile,out,headless,executable_path):
    launch_options={
        'headless':headless,
        'args':['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'],
    }
    if executable_path:
        launch_options['executable_path']=executable_path
    browser=await pw.chromium.launch(**launch_options)
    ctx=await browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1,is_mobile=mobile,has_touch=mobile)
    page=await ctx.new_page();console=[];page_errors=[]
    page.on('console',lambda m:console.append({'type':m.type,'text':m.text}) if m.type in ('error','warning') else None)
    page.on('pageerror',lambda e:page_errors.append(str(e)))
    skeleton,paths,inline=extract_page()
    await page.set_content(skeleton,wait_until='load',timeout=30000)
    for p in paths: await page.add_script_tag(path=str(p))
    await page.add_script_tag(content=inline)
    await page.wait_for_function('window.__AIRAI_R12_QA && window.__AIRAI_R12_QA.ready === true',timeout=60000)
    await page.wait_for_timeout(1200)
    initial=await page.evaluate('''() => ({
      qa:window.__AIRAI_R12_QA,
      sample:window.PalauWorld.sample(134.57,7.35),
      canvas:[document.querySelector('canvas').width,document.querySelector('canvas').height],
      status:document.querySelector('#status').innerText,
      errorDisplay:getComputedStyle(document.querySelector('#error')).display,
      overflow:{x:document.documentElement.scrollWidth-document.documentElement.clientWidth,y:document.documentElement.scrollHeight-document.documentElement.clientHeight}
    })''')
    await page.screenshot(path=str(out/f'{name}_depth_initial.png'))
    await page.select_option('#mode','1')
    box=await page.locator('#gl').bounding_box()
    if box:
        await page.mouse.move(box['x']+box['width']*.52,box['y']+box['height']*.47)
        await page.mouse.down();await page.mouse.move(box['x']+box['width']*.69,box['y']+box['height']*.59,steps=8);await page.mouse.up();await page.mouse.wheel(0,-420)
    await page.fill('#lon','134.585');await page.fill('#lat','7.345');await page.click('#sample');await page.wait_for_timeout(900)
    after=await page.evaluate('''() => ({
      mode:document.querySelector('#mode').value,
      sampleText:document.querySelector('#sampleOut').innerText,
      camera:window.__AIRAI_R12_QA.camera,
      fps:window.__AIRAI_R12_QA.metrics.fps,
      glError:document.querySelector('canvas').getContext('webgl2').getError()
    })''')
    await page.screenshot(path=str(out/f'{name}_uncertainty_interaction.png'))
    result={'name':name,'viewport':[w,h],'initial':initial,'afterInteraction':after,'console':console,'pageErrors':page_errors}
    await ctx.close();await browser.close();return result

async def async_main(args):
    out=pathlib.Path(args.out).resolve();out.mkdir(parents=True,exist_ok=True)
    async with async_playwright() as pw:
        results=[
            await run_case(pw,'desktop_1440x900',1440,900,False,out,args.headless,args.executable_path),
            await run_case(pw,'mobile_390x844',390,844,True,out,args.headless,args.executable_path),
        ]
    (out/'browser-qa.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    failures=[]
    for r in results:
        if not r['initial']['qa']['actualWebGL2']: failures.append(f"{r['name']}: WebGL2 false")
        if r['initial']['errorDisplay']!='none': failures.append(f"{r['name']}: error overlay visible")
        if r['console']: failures.append(f"{r['name']}: console {r['console']}")
        if r['pageErrors']: failures.append(f"{r['name']}: page errors {r['pageErrors']}")
        if r['afterInteraction']['glError']!=0: failures.append(f"{r['name']}: glError {r['afterInteraction']['glError']}")
        if r['initial']['overflow']!={'x':0,'y':0}: failures.append(f"{r['name']}: overflow {r['initial']['overflow']}")
    print(json.dumps({'status':'FAIL' if failures else 'PASS','failures':failures,'results':results},ensure_ascii=False,indent=2))
    if failures: raise SystemExit(1)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--out',default=str(HERE/'evidence'));ap.add_argument('--headless',action='store_true');ap.add_argument('--executable-path');args=ap.parse_args()
    asyncio.run(async_main(args))
if __name__=='__main__':main()
