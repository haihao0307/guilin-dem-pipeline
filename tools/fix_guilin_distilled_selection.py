from pathlib import Path

path = Path('pipeline/distill_online_runtime.py')
text = path.read_text(encoding='utf-8')
old_line = '    selected.update(int(index) for index in ordinary_river[source_width[ordinary_river] >= 40.0])\n'
if text.count(old_line) != 1:
    raise RuntimeError('unexpected source-width selection line count')
text = text.replace(old_line, '', 1)
old_policy = '            "ordinary_rivers": "top 12000 by downstream progress plus source width >= 40 m",\n'
new_policy = '            "ordinary_rivers": "top 12000 by downstream progress",\n'
if text.count(old_policy) != 1:
    raise RuntimeError('unexpected ordinary-river policy line count')
text = text.replace(old_policy, new_policy, 1)
path.write_text(text, encoding='utf-8')
print('Bounded distilled runtime selection to named mainstems plus fixed class budgets')
