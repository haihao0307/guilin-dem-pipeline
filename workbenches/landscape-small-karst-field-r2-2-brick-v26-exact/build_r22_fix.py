from pathlib import Path

HERE = Path(__file__).resolve().parent
original = HERE / "build_r22.py"
code = original.read_text(encoding="utf-8")
# build_r22 embeds JavaScript inside a Python triple-quoted string. Keep the
# JavaScript error-message newline as an escaped sequence instead of emitting
# a literal line break inside a quoted JS string.
code = code.replace(r'shader compile:\n', r'shader compile:\\n')
code = code.replace(r'program link:\n', r'program link:\\n')
namespace = {"__file__": str(original), "__name__": "__main__"}
exec(compile(code, str(original), "exec"), namespace)
