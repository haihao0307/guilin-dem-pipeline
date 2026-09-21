"""Run the V0172 QA with deterministic DOM mouse events under sub-1 FPS SwiftShader.

The production workbench still uses real pointer, mouse, touch and keyboard input. This wrapper only
replaces Playwright's asynchronously queued low-level mouse hold/release calls with synchronous
mousedown/mouseup/click dispatch through the same button event chain. It never writes fishing state
or bypasses tension, progress, bite, gear-loss or catch rules.
"""
from pathlib import Path

SOURCE_PATH = Path('games/survivor-palau/source/v0172/browser_qa.py')
source = SOURCE_PATH.read_text()

old_transition = '''        if desired != actual_held:
            (page.mouse.down if desired else page.mouse.up)()
            held = desired
            page.wait_for_function(
                "(v)=>PalauExperience.fishing.phase!=='reel'||PalauExperience.fishing.held===v",
                arg=desired,
                timeout=5000,
                polling=50,
            )
'''
new_transition = '''        if desired != actual_held:
            event_init = {
                'button': 0,
                'buttons': 1 if desired else 0,
                'clientX': box['x'] + box['width'] / 2,
                'clientY': box['y'] + box['height'] / 2,
                'bubbles': True,
                'cancelable': True,
            }
            page.locator('#actionFish').dispatch_event('mousedown' if desired else 'mouseup', event_init)
            if not desired:
                # A physical mouse emits click after mouseup. Mirror that event so the runtime's
                # release-click suppression is exercised and cleared exactly as it is for a player.
                page.locator('#actionFish').dispatch_event('click', event_init)
            ack = page.evaluate('({...PalauExperience.fishing})')
            history[-1]['inputAck'] = {
                'desired': desired,
                'held': bool(ack['held']),
                'phase': ack['phase'],
                'source': ack.get('lastHoldInput'),
                'transitions': ack.get('holdInputTransitions'),
            }
            assert ack['phase'] != 'reel' or bool(ack['held']) == desired, history[-1]
            held = bool(ack['held']) if ack['phase'] == 'reel' else False
'''
assert source.count(old_transition) == 1, 'V0172 reel transition patch point drifted'
source = source.replace(old_transition, new_transition, 1)

old_cleanup = '''    if held or page.evaluate("PalauExperience.fishing.held"):
        page.mouse.up()
'''
new_cleanup = '''    if held or page.evaluate("PalauExperience.fishing.held"):
        release_init = {
            'button': 0,
            'buttons': 0,
            'clientX': box['x'] + box['width'] / 2,
            'clientY': box['y'] + box['height'] / 2,
            'bubbles': True,
            'cancelable': True,
        }
        page.locator('#actionFish').dispatch_event('mouseup', release_init)
        page.locator('#actionFish').dispatch_event('click', release_init)
'''
assert source.count(old_cleanup) == 1, 'V0172 reel cleanup patch point drifted'
source = source.replace(old_cleanup, new_cleanup, 1)

exec(compile(source, str(SOURCE_PATH) + ':dom-input', 'exec'), {
    '__name__': '__main__',
    '__file__': str(SOURCE_PATH),
})
