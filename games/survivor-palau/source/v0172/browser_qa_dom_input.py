"""Run V0172 reel QA through the real DOM event chain under sub-1 FPS SwiftShader.

The production workbench still owns every fishing rule. This wrapper replaces the external
Playwright hold/release polling loop with an in-page requestAnimationFrame controller that presses
the real button for exactly one rendered frame at a time. It never writes fishing state, tension,
progress, catches or inventory.
"""
from pathlib import Path

SOURCE_PATH = Path('games/survivor-palau/source/v0172/browser_qa.py')
source = SOURCE_PATH.read_text()
start_marker = "new_reel = '''def reel_to_end"
end_marker = "'''\nassert BASE.count(old_reel) == 1"
start = source.index(start_marker)
end = source.index(end_marker, start)

replacement = """new_reel = '''def reel_to_end(page, expect='caught', timeout_s=300):
    box = page.locator('#actionFish').bounding_box()
    assert box
    cx = box['x'] + box['width'] / 2
    cy = box['y'] + box['height'] / 2
    installed = page.evaluate(
        \"([expect,cx,cy])=>{const button=document.getElementById('actionFish');const state={expect,done:false,history:[],startedAt:performance.now(),failure:null};window.__palauQaReel=state;if(!button){state.failure='missing-actionFish';state.done=true;return state;}const emit=(type,buttons)=>{button.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,button:0,buttons,clientX:cx,clientY:cy}));if(type==='mouseup')button.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0,buttons:0,clientX:cx,clientY:cy}));};const tick=()=>{const f=PalauExperience.fishing;state.history.push({frame:OceanMotherR018.qa.frames,phase:f.phase,tension:f.tension,progress:f.progress,held:!!f.held,inputAck:{source:f.lastHoldInput||null,held:!!f.held,transitions:f.holdInputTransitions||0},pauseText:document.getElementById('uiPause')?.textContent||''});if(state.history.length>256)state.history.shift();if(f.phase!=='reel'){if(f.holdPointerActive||f.held)emit('mouseup',0);state.end={...f};state.done=true;state.completedAt=performance.now();return;}if(expect==='broken'){if(!f.held)emit('mousedown',1);}else{if(f.held)emit('mouseup',0);else if(f.tension<=.08)emit('mousedown',1);}requestAnimationFrame(tick);};requestAnimationFrame(tick);return{installed:true,expect};}\",
        [expect, cx, cy],
    )
    assert installed.get('installed') is True, installed
    page.wait_for_function(
        \"()=>window.__palauQaReel?.done===true\",
        timeout=timeout_s * 1000,
        polling=250,
    )
    result = page.evaluate('JSON.parse(JSON.stringify(window.__palauQaReel))')
    end = result.get('end') or page.evaluate('({...PalauExperience.fishing})')
    r['checks']['reelControl_' + expect] = {
        'controller': {
            'startedAt': result.get('startedAt'),
            'completedAt': result.get('completedAt'),
            'failure': result.get('failure'),
        },
        'history': result.get('history', [])[-96:],
        'end': end,
    }
    save()
    assert result.get('failure') is None, result
    assert end['phase'] == expect, end
    return end
'''
"""
source = source[:start] + replacement + source[end + 4:]

exec(compile(source, str(SOURCE_PATH) + ':dom-input', 'exec'), {
    '__name__': '__main__',
    '__file__': str(SOURCE_PATH),
})
