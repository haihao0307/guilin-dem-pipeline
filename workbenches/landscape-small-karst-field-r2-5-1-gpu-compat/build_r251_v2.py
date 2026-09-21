from pathlib import Path

builder = Path(__file__).with_name("build_r251.py")
code = builder.read_text(encoding="utf-8")
code = code.replace("pack_code=r'''", "pack_code='''", 1)
code = code.replace("unpack_code=r'''", "unpack_code='''", 1)
namespace = {"__file__": str(builder), "__name__": "__main__"}
exec(compile(code, str(builder), "exec"), namespace)
