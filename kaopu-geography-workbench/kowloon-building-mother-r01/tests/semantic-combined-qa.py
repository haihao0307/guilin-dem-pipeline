#!/usr/bin/env python3
"""Run separately scoped candidate-only browser checks, preserving every report."""
import argparse, json, runpy, sys, time, traceback
from pathlib import Path
root = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--output', default='public-inspection-evidence')
args, _ = parser.parse_known_args()
out = Path(args.output).resolve()
out.mkdir(parents=True, exist_ok=True)
config = json.loads((root / 'semantic-combined-qa-config.json').read_text())
report = {'passed': False, 'candidateOnly': True, 'productionChanged': False,
          'startedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'steps': []}
def save():
    (out / 'combined-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
save()
for step in config['steps']:
    script = (root / step['script']).resolve()
    assert script.is_relative_to(root) and script.is_file()
    destination = (out / step['output']).resolve()
    assert destination.is_relative_to(out)
    item = {'name': step['name'], 'output': step['output'], 'passed': False,
            'startedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
    report['steps'].append(item)
    save()
    old_argv = sys.argv
    try:
        sys.argv = [str(script), '--output', str(destination)]
        runpy.run_path(str(script), run_name='__main__')
        item['passed'] = True
    except SystemExit as error:
        item['exitCode'] = error.code
        item['passed'] = error.code in (None, 0)
    except Exception:
        item['error'] = traceback.format_exc()
    finally:
        sys.argv = old_argv
        item['finishedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        save()
    if item['passed']:
        try:
            evidence = destination / step['reportFile']
            assert evidence.resolve().is_relative_to(destination)
            result = json.loads(evidence.read_text())
            item['passed'] = result.get('passed') is True
            item['reportFile'] = str(evidence.relative_to(out))
        except Exception:
            item['passed'] = False
            item['error'] = traceback.format_exc()
        save()
report['passed'] = bool(report['steps']) and all(item['passed'] for item in report['steps'])
report['finishedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
save()
raise SystemExit(0 if report['passed'] else 1)
