#!/usr/bin/env bash
set -euo pipefail
# The token is read only from the environment. It is never put in a URL or file.
clo_script_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
exec python3 - "$clo_script_dir" <<'PY'
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

project = Path(sys.argv[1]).resolve()
repo = os.environ.get("GITHUB_REPOSITORY", "")
source = os.environ.get("GITHUB_SHA", "")
branch = os.environ.get("GITHUB_REF_NAME", "")
token = os.environ.get("GITHUB_TOKEN", "")
task = "CLO-LEARNING-PILOT-R01-20261021"
expected_repo = "haihao0307/guilin-dem-pipeline"
expected_branch = "research/tailor-clo-learning-r01-20261021"
if repo != expected_repo or branch != expected_branch:
    raise SystemExit("Publication restricted to the frozen repository and research branch.")
if not re.fullmatch("[0-9a-f]{40}", source) or not token:
    raise SystemExit("A full GITHUB_SHA and an authorized GITHUB_TOKEN are required.")

dist = Path(os.environ.get("CLO_DIST_DIR", str(project / "dist"))).resolve()
proof_path = project / "evidence/PUBLICATION_PROOF.json"
local_report_path = project / "evidence/local-browser-smoke.json"
release_path = "kaopu-tailor-workbench/clo-learning/r01-" + source[:12]
public_url = "https://haihao0307.github.io/guilin-dem-pipeline/" + release_path + "/"
proof = {
    "schema": "kaopu.publication-proof/1",
    "taskId": task,
    "sourceHead": source,
    "releasePath": release_path,
    "fixedURL": public_url,
    "sourceModified": False,
    "interactive3D": False,
    "staticImageSubstitute": False,
    "buildPassed": False,
    "deployed": False,
    "httpPassed": False,
    "publicHttpsPassed": False,
    "browserPassed": False,
    "shareAllowed": False,
    "visualAcceptance": False,
    "productionReady": False,
}
def save_proof():
    proof["recordedAt"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    proof_path.parent.mkdir(parents=True, exist_ok=True)
    proof_path.write_text(json.dumps(proof, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def api(suffix, method="GET"):
    req = urllib.request.Request(
        "https://api.github.com/repos/" + repo + suffix,
        data=b"" if method == "POST" else None,
        method=method,
        headers={
            "Authorization": "Bearer " + token,
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2026-03-10",
            "User-Agent": "KAOPU-CLO-Publish/1",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)

def fail(message):
    raise RuntimeError(message)

try:
    html_path, manifest_path = dist / "index.html", dist / "manifest.json"
    payload = {}
    for name, file in (("index.html", html_path), ("manifest.json", manifest_path)):
        if file.is_symlink() or not file.is_file():
            fail("Missing regular build artifact: " + name)
        payload[name] = file.read_bytes()
        if not payload[name]:
            fail("Empty build artifact: " + name)
    manifest = json.loads(payload["manifest.json"])
    if manifest.get("sourceHead") != source or manifest.get("taskId") != task:
        fail("Build manifest does not belong to this source/task.")
    if source.encode() not in payload["index.html"]:
        fail("HTML does not include this exact source identity.")
    if not local_report_path.is_file():
        fail("Local real-browser report is required before publication.")
    report = json.loads(local_report_path.read_text(encoding="utf-8"))
    if not all(report.get(key) is True for key in ("passed", "desktopPassed", "mobileViewportPassed")):
        fail("Local browser checks have not all passed.")
    if report.get("sourceHead") != source or report.get("standaloneCoreNetworkRequests") != 0:
        fail("Browser report identity or standalone network gate failed.")
    # Source truth is checked in the current source checkout, not inferred from a title.
    base = "c84b16a0ae022dda9fe22c09df758fcb8095bc07"
    source_check = subprocess.run(
        ["git", "diff", "--name-only", base, source, "--", ":(top)kaopu-tailor-workbench/clo-learning-r01/src"],
        cwd=project, text=True, capture_output=True, check=True
    )
    if not source_check.stdout.strip():
        fail("No task-related source delta was found.")
    proof.update(sourceModified=True, interactive3D=True, buildPassed=True, localBrowserReport=report)
    proof["files"] = {
        name: {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
        for name, data in payload.items()
    }
    # Never switch the Pages source for the entire repository.
    pages = api("/pages")
    pages_source = pages.get("source") or {}
    if pages_source.get("branch") != "gh-pages" or pages_source.get("path") != "/" or pages.get("build_type") == "workflow":
        fail("Existing Pages source is not gh-pages at /. Publication configuration was not changed.")
    proof["pagesSource"] = {"branch": pages_source["branch"], "path": pages_source["path"]}

    with tempfile.TemporaryDirectory(prefix="clo-pages-") as temporary:
        temp = Path(temporary)
        checkout = temp / "checkout"
        askpass = temp / "askpass.sh"
        # This helper contains only an environment-variable reference, never the credential.
        askpass.write_text(
            '#!/bin/sh\ncase "$1" in\n'
            '  *Username*) printf "%s\\n" "x-access-token" ;;\n'
            '  *Password*) printf "%s\\n" "$GITHUB_TOKEN" ;;\n'
            '  *) exit 1 ;;\nesac\n', encoding="utf-8"
        )
        askpass.chmod(0o700)
        git_env = os.environ.copy()
        git_env.update(GIT_ASKPASS=str(askpass), GIT_TERMINAL_PROMPT="0", GIT_CONFIG_NOSYSTEM="1")
        def git(*args, check=True, binary=False, cwd=None):
            result = subprocess.run(
                ["git", "-c", "credential.helper=", *args],
                cwd=cwd or checkout, env=git_env, capture_output=True, text=not binary
            )
            if check and result.returncode:
                message = result.stderr.decode(errors="replace") if binary else result.stderr
                fail("Git operation failed: " + " ".join(args[:3]) + ": " + message.strip())
            return result
        git("clone", "--filter=blob:none", "--depth=1", "--single-branch", "--no-checkout",
            "--branch", "gh-pages", "https://github.com/" + repo + ".git", str(checkout), cwd=temp)
        git("sparse-checkout", "init", "--cone")
        git("sparse-checkout", "set", release_path)
        git("checkout", "gh-pages")
        git("config", "user.name", "github-actions[bot]")
        git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com")
        parent = git("rev-parse", "HEAD").stdout.strip()

        def assert_remote_compatible(ref):
            for name, data in payload.items():
                object_name = ref + ":" + release_path + "/" + name
                exists = git("cat-file", "-e", object_name, check=False)
                if exists.returncode == 0:
                    tree_entry = git("ls-tree", ref, "--", release_path + "/" + name).stdout
                    if not tree_entry.startswith("100644 blob ") and not tree_entry.startswith("100755 blob "):
                        fail("Immutable target is not a regular file.")
                    actual = git("show", object_name, binary=True).stdout
                    if actual != data:
                        fail("Immutable target already exists with different bytes: " + name)
        assert_remote_compatible("HEAD")
        target = checkout / release_path
        for item in (target, *target.parents):
            if item == checkout:
                break
            if item.is_symlink():
                fail("Symlink in publication target.")
        target.mkdir(parents=True, exist_ok=True)
        for name, data in payload.items():
            dest = target / name
            if dest.exists():
                if not dest.is_file() or dest.read_bytes() != data:
                    fail("Refusing to overwrite an immutable artifact: " + name)
            else:
                dest.write_bytes(data)
        git("add", "--sparse", "--", release_path + "/index.html", release_path + "/manifest.json")

        allowed = {release_path + "/index.html", release_path + "/manifest.json"}
        def guard_diff(*args):
            parts = git("diff", "--no-renames", "--name-status", "-z", *args).stdout.split("\0")
            parts = [part for part in parts if part]
            if len(parts) % 2:
                fail("Unexpected publication diff format.")
            for status, name in zip(parts[::2], parts[1::2]):
                if status != "A" or name not in allowed:
                    fail("Publication touched a protected path or changed existing bytes.")
            return bool(parts)
        changed = guard_diff("--cached")
        if changed:
            git("commit", "-m", "publish(clo-learning-r01): immutable verified source " + source[:12])
            for attempt in range(5):
                guard_diff(parent, "HEAD")
                result = git("push", "origin", "HEAD:refs/heads/gh-pages", check=False)
                if result.returncode == 0:
                    break
                git("fetch", "origin", "gh-pages", "--depth=1")
                next_parent = git("rev-parse", "origin/gh-pages").stdout.strip()
                if next_parent == parent:
                    fail("Pages push failed without a concurrent head change: " + result.stderr.strip())
                assert_remote_compatible("origin/gh-pages")
                # Only the local, unpublished addition is replayed. Published history is never rewritten.
                rebase = git("rebase", "--empty=drop", "--onto", next_parent, parent, check=False)
                if rebase.returncode:
                    git("rebase", "--abort", check=False)
                    fail("Concurrent Pages update conflicts with this immutable path; stopped.")
                parent = next_parent
                if git("rev-parse", "HEAD").stdout.strip() == next_parent:
                    break
            else:
                fail("Concurrent Pages writers prevented a fast-forward publication after five attempts.")
        proof["pagesParentCommit"] = parent
        proof["publicationCommit"] = git("rev-parse", "HEAD").stdout.strip()
        proof["changedOnlyInsideNewSnapshot"] = True
        for name, data in payload.items():
            actual = git("show", "HEAD:" + release_path + "/" + name, binary=True).stdout
            if actual != data:
                fail("Committed publication bytes do not match the tested build.")
        proof["publicationSourcePushed"] = True

    # GITHUB_TOKEN pushes do not automatically trigger a Pages build.
    requested = api("/pages/builds", method="POST")
    proof["pagesBuildRequested"] = {"status": requested.get("status"), "url": requested.get("url")}
    save_proof()

    def public_bytes(url, maximum):
        req = urllib.request.Request(url, headers={"Cache-Control": "no-cache", "User-Agent": "KAOPU-CLO-Public-QA/1"})
        with urllib.request.urlopen(req, timeout=30) as response:
            if response.status != 200 or urllib.parse.urlsplit(response.url).hostname != "haihao0307.github.io":
                fail("Unexpected final public response.")
            data = response.read(maximum + 1)
            return data, response.url

    last_error = None
    for attempt in range(40):
        try:
            html, actual_url = public_bytes(public_url, len(payload["index.html"]))
            meta, _ = public_bytes(public_url + "manifest.json", len(payload["manifest.json"]))
            if html != payload["index.html"] or meta != payload["manifest.json"]:
                fail("Public bytes are not this tested immutable build.")
            proof.update(deployed=True, httpPassed=True, publicHttpsPassed=True, finalURL=actual_url, httpStatus=200)
            proof["publicVerifiedAt"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            save_proof()
            if os.environ.get("GITHUB_OUTPUT"):
                with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as out:
                    out.write("public_url=" + public_url + "\n")
                    out.write("pages_commit=" + proof["publicationCommit"] + "\n")
                    out.write("release_path=" + release_path + "\n")
            print("PUBLISHED_HTTP_VERIFIED " + public_url, flush=True)
            print("Public browser verification is still required; shareAllowed remains false.", flush=True)
            break
        except (urllib.error.URLError, TimeoutError, RuntimeError) as error:
            last_error = str(error)
            print("Waiting for exact Pages bytes, attempt " + str(attempt + 1) + "/40: " + last_error, flush=True)
            if attempt < 39:
                time.sleep(8)
    else:
        fail("Public HTTPS readback failed: " + str(last_error))
except Exception as error:
    proof["failure"] = str(error)
    save_proof()
    raise
PY

