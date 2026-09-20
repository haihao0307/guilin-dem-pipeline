from pathlib import Path

HERE = Path(__file__).resolve().parent
original = HERE / "build_r24.py"
code = original.read_text(encoding="utf-8")
code = code.replace(
    r'r"float caveField\\(vec3 p\\)\\{.*?\\}(?=float mapRock)"',
    r'r"float caveField\\(vec3 p\\)\\{.*?\\}(?=\\s*float mapRock)"',
)
code = code.replace(
    r'r"float mapRock\\(vec3 wp\\)\\{.*?\\}(?=float mapGround)"',
    r'r"float mapRock\\(vec3 wp\\)\\{.*?\\}(?=\\s*float mapGround)"',
)
namespace = {"__file__": str(original), "__name__": "__main__"}
exec(compile(code, str(original), "exec"), namespace)
