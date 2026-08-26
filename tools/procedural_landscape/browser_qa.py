#!/usr/bin/env python3
"""Browser QA for the procedural landscape foundation status page."""

from __future__ import annotations

import argparse
import contextlib
import json
import os
import shutil
import socket
import threading
from dataclasses import dataclass, asdict
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from playwright.sync_api import Browser, Page, sync_playwright


@dataclass
class ViewportResult:
    name: str
    width: int
    height: int
    passed: bool
    screenshot: str
    branchCards: int
    projectCards: int
    consoleErrors: list[str]
    pageErrors: list[str]
    failedRequests: list[str]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:
        return


@contextlib.contextmanager
def serve(directory: Path):
    handler = lambda *args, **kwargs: QuietHandler(*args, directory=str(directory), **kwargs)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}/index.html"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def find_system_chromium() -> str | None:
    """Use a system browser only when explicitly requested.

    Managed Playwright Chromium avoids enterprise policies that can block local
    QA URLs in some build environments.
    """
    explicit = os.environ.get("CHROMIUM_PATH")
    if explicit and Path(explicit).is_file():
        return explicit
    return None


def inspect_page(page: Page, url: str, name: str, width: int, height: int, screenshot: Path, ignore_embedded_status_fetch: bool = False) -> ViewportResult:
    console_errors: list[str] = []
    page_errors: list[str] = []
    failed_requests: list[str] = []

    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    def record_failed_request(request) -> None:
        if ignore_embedded_status_fetch and request.url.endswith("/status.json"):
            return
        failed_requests.append(
            f"{request.method} {request.url}: {request.failure or 'unknown failure'}"
        )

    page.on("requestfailed", record_failed_request)

    page.goto(url, wait_until="networkidle", timeout=30_000)
    page.wait_for_function(
        "() => document.documentElement.dataset.statusLoaded === 'true'",
        timeout=15_000,
    )
    page.locator("[data-status-root]").wait_for(state="visible", timeout=10_000)
    page.locator("h1").filter(has_text="程序化地貌生产线").wait_for(state="visible")
    branch_cards = page.locator("#branches article.card").count()
    project_cards = page.locator("#projects article.card").count()
    title = page.title()
    footer = page.locator("#footer").inner_text()
    screenshot.parent.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(screenshot), full_page=True)

    assertions = [
        title == "程序化地貌生产线 v0.2",
        branch_cards >= 6,
        project_cards >= 3,
        "公开发布批准 尚未取得" in footer,
        not console_errors,
        not page_errors,
        not failed_requests,
    ]
    return ViewportResult(
        name=name,
        width=width,
        height=height,
        passed=all(assertions),
        screenshot=str(screenshot),
        branchCards=branch_cards,
        projectCards=project_cards,
        consoleErrors=console_errors,
        pageErrors=page_errors,
        failedRequests=failed_requests,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--output", type=Path, default=Path("reports/procedural-landscape-browser-v020"))
    parser.add_argument("--transport", choices=("http", "file"), default="http")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = args.root.resolve()
    output = args.output
    if not output.is_absolute():
        output = root / output
    output.mkdir(parents=True, exist_ok=True)

    web_dir = root / "web/procedural-landscape-skill"
    if not (web_dir / "index.html").is_file() or not (web_dir / "status.json").is_file():
        raise SystemExit("Status page files are missing.")

    if args.transport == "file":
        url_context = contextlib.nullcontext((web_dir / "index.html").resolve().as_uri())
        ignore_embedded_status_fetch = True
    else:
        url_context = serve(web_dir)
        ignore_embedded_status_fetch = False

    with url_context as url, sync_playwright() as playwright:
        launch_args: dict[str, Any] = {"headless": True}
        system_chromium = find_system_chromium()
        if system_chromium:
            launch_args["executable_path"] = system_chromium
        else:
            managed_chromium = Path(playwright.chromium.executable_path)
            if managed_chromium.is_file():
                launch_args["executable_path"] = str(managed_chromium)
        browser: Browser = playwright.chromium.launch(**launch_args)
        try:
            results: list[ViewportResult] = []
            for name, width, height in (
                ("desktop", 1440, 1000),
                ("mobile-390x844", 390, 844),
            ):
                context = browser.new_context(
                    viewport={"width": width, "height": height},
                    device_scale_factor=1,
                    locale="zh-CN",
                    color_scheme="dark",
                )
                try:
                    page = context.new_page()
                    results.append(
                        inspect_page(
                            page,
                            url,
                            name,
                            width,
                            height,
                            output / f"{name}.png",
                            ignore_embedded_status_fetch=ignore_embedded_status_fetch,
                        )
                    )
                finally:
                    context.close()
        finally:
            browser.close()

    report = {
        "schema": "dem_procedural_landscape_browser_qa@2.0.0",
        "passed": all(item.passed for item in results),
        "url": url,
        "transport": args.transport,
        "viewports": [asdict(item) for item in results],
    }
    report_path = output / "report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
