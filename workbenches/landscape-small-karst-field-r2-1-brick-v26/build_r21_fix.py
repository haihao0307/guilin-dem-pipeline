from pathlib import Path

HERE = Path(__file__).resolve().parent
original = HERE / "build_r21.py"
code = original.read_text(encoding="utf-8")
code = code.replace('assert "STRICT_BRICK_V26_STONE_BLOCK" in source\n', '')
# The old page did not carry this diagnostic marker; inject the R2.1 marker in
# the output title block instead of requiring it in the source.
code = code.replace(
    'output = output.replace("STRICT_BRICK_V26_STONE_BLOCK", "STRICT_BRICK_V26_STONE_BLOCK_TWO_PASS", 1)',
    'output = output.replace("<body>", "<body data-transfer=\\"STRICT_BRICK_V26_STONE_BLOCK_TWO_PASS\\">", 1)',
)
# build_r21 replaces the tail of an already-open browser IIFE; close it after
# the new two-pass runtime is appended.
code = code.replace(
    "window.__KARST_DIAGNOSTICS__={renderer:'two-pass-continuous-field',material:'Brick Mother V2.6 stone-block locked'};'''",
    "window.__KARST_DIAGNOSTICS__={renderer:'two-pass-continuous-field',material:'Brick Mother V2.6 stone-block locked'};})();'''",
)
# The copied V2.6 stone material normalizes its field by the current overall
# object scale. R2's one-pass shader saw uOverall through the shared uniform
# block; the split material program must declare and bind it explicitly.
code = code.replace(
    "uniform float uSoil;\nuniform int uGray;",
    "uniform float uSoil,uOverall;\nuniform int uGray;",
)
code = code.replace(
    "UM=locations(materialProgram,['uRes','uPositionTex','uNormalTex','uCam','uSoil','uGray']);",
    "UM=locations(materialProgram,['uRes','uPositionTex','uNormalTex','uCam','uSoil','uOverall','uGray']);",
)
code = code.replace(
    "gl.uniform1f(UM.uSoil,state.soil);gl.uniform1i(UM.uGray,state.gray);",
    "gl.uniform1f(UM.uSoil,state.soil);gl.uniform1f(UM.uOverall,state.overall);gl.uniform1i(UM.uGray,state.gray);",
)
namespace = {"__file__": str(original), "__name__": "__main__"}
exec(compile(code, str(original), "exec"), namespace)
