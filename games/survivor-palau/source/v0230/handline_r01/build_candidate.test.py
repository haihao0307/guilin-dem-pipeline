import importlib.util, pathlib
p=pathlib.Path(__file__).with_name('build_candidate.py')
s=importlib.util.spec_from_file_location('b',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
fixture='HEAD<script>'+m.LOCATE+'\n'+m.API_PREFIX+'()=>({})};</script></body>'
core="'use strict'; module.exports={createFishingSession(){},stepFishingSession(){}};"
controller='window.__controllerLoaded=true;'
browser='window.__browserLoaded=true;'
out=m.build(fixture,core,controller,browser)
assert 'HANDLINE_OVERRIDES' in out
assert 'handlineCandidate' in out
assert 'smi-existing-fishing-core' in out
assert '__controllerLoaded' in out and '__browserLoaded' in out
assert out.count('</body>')==1
print('handline candidate builder fixture: PASS')
