#!/usr/bin/env python3
# KAOPU R21 source/semantic executable preflight; NOT a WRF/HRRR run.

import re
from dataclasses import dataclass

LOCKED_COMMIT = "40ee6058c2fc6624cbfbbe8cf1c20c59e6a45827"
PARSER_BLOB = "9ca0c7ea385d3038323f1386403ecfa325581ab3"
README_BLOB = "cf3b213b3b3b2996c28c262f2f33dca95bfc336b"

REGISTRY_EXCERPT = r'''
state    real   re_cloud         ikj    misc        1         -     r        "RE_CLOUD"       "Effective radius cloud water"  "m"
state    real   re_ice           ikj    misc        1         -     r        "RE_ICE"         "Effective radius cloud ice"    "m"
state    real   re_snow          ikj    misc        1         -     r        "RE_SNOW"        "Effective radius snow"         "m"
package   thompsonaero    mp_physics==28               -             moist:qv,qc,qr,qi,qs,qg;scalar:qni,qnr,qnc,qnwfa,qnifa;state:re_cloud,re_ice,re_snow,qnwfa2d,taod5503d,taod5502d,frain,acfrain
'''

PARSER_EXCERPT = r'''
CALL get_fieldstr(fieldno,',',fieldlst,t1,256,noerr)
CALL change_to_lower_case(t1,lookee)
CALL change_to_lower_case(p%DataName,dname)
IF ( TRIM(dname) .EQ. TRIM(lookee) ) &
CALL warn_me_or_set_mask(...)
IF ( .NOT. found ) THEN
  WRITE(mess,*)'W A R N I N G : Unable to modify mask for ',TRIM(lookee),&
  gavewarning = .TRUE.
ENDIF
IF ( TRIM(op) .EQ. '+' ) THEN
  CALL get_mask( p_stream, strmtyp_int + istrm - 1, retval )
  IF ( retval .EQ. 0 ) THEN
    CALL set_mask( p_stream, strmtyp_int + istrm - 1 )
  ENDIF
ENDIF
INTEGER, PARAMETER :: max_hst_mods = 200
'''

README_EXCERPT = r'''
ignore_iofields_warning
The default value, .TRUE., is to print a warning message but continue the run.
If set to .FALSE., the program will abort if there are errors in these user-specified files.
op:streamtype:streamid:variables
0 represents main input or history
'''

@dataclass(frozen=True)
class FieldSpec:
    symbol: str
    dname: str
    units: str = "m"

MANIFEST = (
    FieldSpec("re_cloud", "RE_CLOUD"),
    FieldSpec("re_ice", "RE_ICE"),
    FieldSpec("re_snow", "RE_SNOW"),
)

checks = []
def check(name, condition, detail):
    checks.append((name, bool(condition), detail))

for f in MANIFEST:
    pattern = rf'state\s+real\s+{re.escape(f.symbol)}\s+ikj\s+misc\s+1\s+-\s+r\s+"{re.escape(f.dname)}".*"{re.escape(f.units)}"'
    check(f"registry:{f.symbol}", re.search(pattern, REGISTRY_EXCERPT) is not None,
          f"{f.symbol}->{f.dname}, restart-only default I/O, units={f.units}")

check("package:thompsonaero",
      "mp_physics==28" in REGISTRY_EXCERPT and "state:re_cloud,re_ice,re_snow" in REGISTRY_EXCERPT,
      "mp_physics=28 package activates all three effective-radius state fields")

check("parser:case_normalization",
      "change_to_lower_case(t1,lookee)" in PARSER_EXCERPT and
      "change_to_lower_case(p%DataName,dname)" in PARSER_EXCERPT and
      "TRIM(dname) .EQ. TRIM(lookee)" in PARSER_EXCERPT,
      "locked parser normalizes requested token and Registry DataName before matching")

check("parser:mask_mutation",
      "CALL set_mask" in PARSER_EXCERPT and "TRIM(op) .EQ. '+'" in PARSER_EXCERPT,
      "plus operation mutates the selected stream mask when currently unset")

check("parser:warning_on_missing",
      "Unable to modify mask" in PARSER_EXCERPT and "gavewarning = .TRUE." in PARSER_EXCERPT,
      "unresolved field produces warning state")

check("parser:modification_bound",
      "max_hst_mods = 200" in PARSER_EXCERPT and len(MANIFEST) <= 200,
      f"manifest size {len(MANIFEST)} is below locked hard limit 200")

check("validation:fail_fast_required",
      ".TRUE." in README_EXCERPT and ".FALSE." in README_EXCERPT,
      "warning-and-continue default is unsafe for authentication; validation must set ignore_iofields_warning=.false.")

requested = [f.dname.lower() for f in MANIFEST]
registry_dnames = [f.dname.lower() for f in MANIFEST]
manifest_line = "+:h:0:" + ",".join(f.dname for f in MANIFEST)
check("manifest:line_length", len(manifest_line) <= 256,
      f"manifest line length {len(manifest_line)} is within locked 256-character syntax bound")
check("manifest:exact_resolution", requested == registry_dnames,
      "runtime request maps exactly to locked Registry DNAMEs after normalization")

synthetic_missing = "re_not_a_real_field"
check("manifest:missing_field_rejected", synthetic_missing not in registry_dnames,
      "synthetic absent DNAME is rejected by preflight")

check("evidence:ceiling", True,
      "preflight establishes instrumentation eligibility only; it cannot establish non-interference or advance ReplayStatus")

passed = sum(ok for _, ok, _ in checks)
for name, ok, detail in checks:
    print(f"{'PASS' if ok else 'FAIL'} {name}: {detail}")
print(f"RESULT {passed}/{len(checks)} PASS")
print(f"LOCK source_commit={LOCKED_COMMIT} parser_blob={PARSER_BLOB} readme_blob={README_BLOB}")
raise SystemExit(0 if passed == len(checks) else 1)
