"""Run the existing V063 pixel tests after real cache readiness, keeping all tolerances."""
from pathlib import Path
R=Path(__file__).resolve().parent
source=(R/'qa.py').read_text()
old="""   if page.evaluate('WeatherMother.qa.errors'):raise RuntimeError(page.evaluate('WeatherMother.qa.errors'))
"""
new="""   if page.evaluate('WeatherMother.qa.errors'):raise RuntimeError(page.evaluate('WeatherMother.qa.errors'))
   page.wait_for_function('''()=>{const r=WeatherMother.getReadiness();return !r.pendingVolume&&!r.pendingLight&&r.shadowDirectionError!==null&&r.shadowDirectionError<=.035001&&r.shadowEpoch===r.renderedShadowEpoch&&Math.abs(r.hour-r.targetHour)<.0001}''',timeout=90000)
"""
assert source.count(old)==1,'Pixel-readiness anchor changed'
source=source.replace(old,new)
# All checks, pixel thresholds, cases and A/B windows in qa.py remain unchanged.
exec(compile(source,str(R/'qa.py'),'exec'),{'__name__':'__main__','__file__':str(R/'qa.py')})
