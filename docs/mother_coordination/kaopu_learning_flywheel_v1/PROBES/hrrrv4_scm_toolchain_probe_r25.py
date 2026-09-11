#!/usr/bin/env python3
import json
import shutil
import subprocess
import tempfile
from pathlib import Path


def cmd_exists(name):
    return shutil.which(name) is not None


def run(cmd):
    p = subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    return p.returncode, p.stdout.strip()


checks = []


def add(name, ok, detail):
    checks.append({"name": name, "pass": bool(ok), "detail": detail})


# Source/document contracts are kept separate from runtime environment checks.
source_contract = {
    "case": "em_scm_xy",
    "case_kind": "1-D idealized SCM",
    "serial_build_permitted_and_current_officially_required_for_1D": True,
    "locked_hrrrv4_gnu_arch_advertises_serial": True,
    "locked_hrrrv4_mpi_probe_is_conditional_on_DMPARALLEL": True,
    "locked_scm_io_form_history": 2,
    "locked_scm_io_form_input": 2,
    "locked_scm_io_form_auxinput3": 2,
}

add(
    "source_contract_serial_scm",
    all(
        [
            source_contract["serial_build_permitted_and_current_officially_required_for_1D"],
            source_contract["locked_hrrrv4_gnu_arch_advertises_serial"],
            source_contract["locked_hrrrv4_mpi_probe_is_conditional_on_DMPARALLEL"],
        ]
    ),
    "serial SCM path does not require MPI by contract",
)

for tool in ["gfortran", "gcc", "make", "perl", "m4", "cpp", "ar", "sed", "awk"]:
    add(f"tool_{tool}", cmd_exists(tool), shutil.which(tool) or "missing")

add("tool_csh", cmd_exists("csh"), shutil.which("csh") or "missing (locked compile script uses /bin/csh -f)")
add("tool_mpif90", cmd_exists("mpif90"), shutil.which("mpif90") or "missing, but not a hard blocker for serial SCM")
add("tool_nc_config", cmd_exists("nc-config"), shutil.which("nc-config") or "missing")
add("tool_nf_config", cmd_exists("nf-config"), shutil.which("nf-config") or "missing")
add("netcdf_inc", Path("/usr/include/netcdf.inc").exists(), "/usr/include/netcdf.inc")
add("netcdf_mod", Path("/usr/include/netcdf.mod").exists(), "/usr/include/netcdf.mod")

with tempfile.TemporaryDirectory() as td:
    c = Path(td) / "p.c"
    exe = Path(td) / "p"
    c.write_text('#include <netcdf.h>\nint main(void){return nc_inq_libvers()?0:2;}\n')
    rc, out = run(["gcc", str(c), "-lnetcdf", "-o", str(exe)])
    if rc == 0:
        rc2, out2 = run([str(exe)])
        add("netcdf_c_compile_link_run", rc2 == 0, out2 or "compiled, linked, ran")
    else:
        add("netcdf_c_compile_link_run", False, out)

with tempfile.TemporaryDirectory() as td:
    f = Path(td) / "p.f90"
    exe = Path(td) / "p"
    f.write_text("program p\n include 'netcdf.inc'\n print *, NF_NOERR\nend program p\n")
    rc, out = run(["gfortran", str(f), "-lnetcdff", "-lnetcdf", "-o", str(exe)])
    add("netcdf_fortran_compile_link", rc == 0, out[:500] if out else "compiled and linked")

netcdf_fortran_ready = (
    cmd_exists("nf-config")
    or Path("/usr/include/netcdf.inc").exists()
    or Path("/usr/include/netcdf.mod").exists()
)
csh_ready = cmd_exists("csh")
canonical_netcdf_io = all(
    source_contract[k] == 2
    for k in ["locked_scm_io_form_history", "locked_scm_io_form_input", "locked_scm_io_form_auxinput3"]
)
ready_for_locked_serial_scm = (
    csh_ready
    and netcdf_fortran_ready
    and cmd_exists("gfortran")
    and cmd_exists("gcc")
    and cmd_exists("make")
)

result = {
    "schema": "kaopu-hrrrv4-scm-toolchain-probe/r25",
    "source_contract": source_contract,
    "derived": {
        "mpi_is_hard_blocker_for_serial_l1_scm": False,
        "canonical_scm_requires_netcdf_io": canonical_netcdf_io,
        "netcdf_fortran_ready": netcdf_fortran_ready,
        "csh_ready": csh_ready,
        "ready_for_locked_serial_scm_configure_compile": ready_for_locked_serial_scm,
        "blocking_requirements": [
            name
            for name, ok in [("csh", csh_ready), ("netcdf-fortran", netcdf_fortran_ready)]
            if not ok
        ],
    },
    "checks": checks,
}

print(json.dumps(result, indent=2))

# A successful probe means the dependency boundary was classified correctly;
# it does not mean all build dependencies are present.
assert result["derived"]["mpi_is_hard_blocker_for_serial_l1_scm"] is False
assert result["derived"]["canonical_scm_requires_netcdf_io"] is True
assert any(c["name"] == "netcdf_c_compile_link_run" and c["pass"] for c in checks)
assert any(c["name"] == "netcdf_fortran_compile_link" and not c["pass"] for c in checks)
assert result["derived"]["ready_for_locked_serial_scm_configure_compile"] is False
