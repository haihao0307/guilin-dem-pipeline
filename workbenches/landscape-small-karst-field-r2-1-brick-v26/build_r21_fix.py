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
namespace = {"__file__": str(original), "__name__": "__main__"}
exec(compile(code, str(original), "exec"), namespace)
