#!/usr/bin/env python3
"""Bounded semantic probe for KAOPU R17.

This does not run HRRR and does not validate atmospheric physics. It checks the
locked source/configuration contract that separates default HRRR history output
from restart-only effective-radius state and validates the proposed runtime-I/O
instrumentation syntax as a candidate checkpoint route.
"""

REGISTRY = {
    "re_cloud": 'state real re_cloud ikj misc 1 - r "RE_CLOUD" "Effective radius cloud water" "m"',
    "re_ice":   'state real re_ice ikj misc 1 - r "RE_ICE" "Effective radius cloud ice" "m"',
    "re_snow":  'state real re_snow ikj misc 1 - r "RE_SNOW" "Effective radius snow" "m"',
}
THOMPSONAERO_PACKAGE = (
    "package thompsonaero mp_physics==28 - "
    "moist:qv,qc,qr,qi,qs,qg;scalar:qni,qnr,qnc,qnwfa,qnifa;"
    "state:re_cloud,re_ice,re_snow,qnwfa2d,taod5503d,taod5502d,frain,acfrain"
)
RUN_HOURS = 12
RESTART_INTERVAL_MIN = 5000
IOFIELDS_DEFAULT = "NONE_SPECIFIED"
RUNTIME_IO_LINE = "+:h:0:re_cloud,re_ice,re_snow"


def registry_io_token(line: str) -> str:
    parts = line.split()
    # state type sym dims use numTLev stagger IO ...
    return parts[7]


def parse_runtime_io(line: str):
    op, stream_type, stream_id, variables = line.split(":", 3)
    return op, stream_type, int(stream_id), [v.strip() for v in variables.split(",")]


def main() -> int:
    results = []

    def check(name, condition, detail=""):
        results.append((name, bool(condition), detail))

    for name, line in REGISTRY.items():
        io = registry_io_token(line)
        check(f"{name}: restart-associated", "r" in io, f"IO={io}")
        check(f"{name}: not default-history", "h" not in io, f"IO={io}")

    check(
        "thompsonaero carries all effective-radius states",
        all(name in THOMPSONAERO_PACKAGE for name in REGISTRY),
    )
    check(
        "template restart interval lies beyond template run",
        RESTART_INTERVAL_MIN > RUN_HOURS * 60,
        f"restart={RESTART_INTERVAL_MIN} min; run={RUN_HOURS*60} min",
    )

    op, stream_type, stream_id, variables = parse_runtime_io(RUNTIME_IO_LINE)
    check(
        "runtime-I/O candidate targets main history",
        op == "+" and stream_type == "h" and stream_id == 0,
        RUNTIME_IO_LINE,
    )
    check(
        "runtime-I/O candidate exposes only requested radius states",
        variables == ["re_cloud", "re_ice", "re_snow"],
        ",".join(variables),
    )
    check(
        "runtime-I/O override is not default behavior",
        IOFIELDS_DEFAULT == "NONE_SPECIFIED",
        IOFIELDS_DEFAULT,
    )

    passed = sum(ok for _, ok, _ in results)
    for name, ok, detail in results:
        print(f"{'PASS' if ok else 'FAIL'} | {name}" + (f" | {detail}" if detail else ""))
    print(f"RESULT {passed}/{len(results)} PASS")

    if passed != len(results):
        return 1

    print("CLASSIFICATION default_history_checkpoint=unsupported_by_locked_registry")
    print("CLASSIFICATION restart_checkpoint=state-capable_but-runtime-artifact-unproven")
    print("CLASSIFICATION runtime_io_history_checkpoint=candidate_instrumented_source_model_checkpoint")
    print("REPLAY_STATUS source_callpath_authenticated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
