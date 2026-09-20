from pathlib import Path

HERE = Path(__file__).resolve().parent
original = HERE / "build_r24.py"
code = original.read_text(encoding="utf-8")
old_cave = 'r"float caveField\\(vec3 p\\)\\{.*?\\}(?=float mapRock)"'
new_cave = 'r"float caveField\\(vec3 p\\)\\{.*?\\}(?=\\s*float mapRock)"'
old_map = 'r"float mapRock\\(vec3 wp\\)\\{.*?\\}(?=float mapGround)"'
new_map = 'r"float mapRock\\(vec3 wp\\)\\{.*?\\}(?=\\s*float mapGround)"'
if old_cave not in code:
    raise RuntimeError("cave regex marker missing")
if old_map not in code:
    raise RuntimeError("map regex marker missing")
code = code.replace(old_cave, new_cave, 1).replace(old_map, new_map, 1)
namespace = {"__file__": str(original), "__name__": "__main__"}
exec(compile(code, str(original), "exec"), namespace)
