#!/usr/bin/env node

import crypto from 'node:crypto';
import process from 'node:process';
import path from 'node:path';
import { constants as fsConstants, promises as fs } from 'node:fs';
import { chromium } from 'playwright-core';

const CORE_IDS = Object.freeze([
  'zhenbao-ding',
  'guilin-old-city',
  'yangtang-airfield',
  'yangshuo-county-seat',
]);
const REVIEW_HEIGHTS = Object.freeze([50, 2, 1.7]);
const PROFILES = new Set(['chrome', 'edge', 'mobile']);

function usage() {
  return `Usage: node tests/guilin_v050_stage_a_browser.mjs [options]

Options:
  --profile chrome|edge|mobile   Browser/profile to test
  --base-url URL                Repository-root served workbench URL
  --output-dir PATH             Report and screenshot directory
  --executable-path PATH        Override the system browser executable
  --timeout-ms NUMBER           Per-operation timeout, default 120000
  --help                        Show this help
`;
}

function parseArguments(argv) {
  const values = {
    profile: process.env.GUILIN_BROWSER_PROFILE || 'chrome',
    baseUrl: process.env.GUILIN_BASE_URL || 'http://127.0.0.1:8765/web/guilin-v050/',
    outputDir: process.env.GUILIN_BROWSER_OUTPUT || '',
    executablePath: process.env.GUILIN_BROWSER_EXECUTABLE || '',
    timeoutMs: Number(process.env.GUILIN_BROWSER_TIMEOUT_MS || 120_000),
  };
  const aliases = {
    '--profile': 'profile',
    '--base-url': 'baseUrl',
    '--output-dir': 'outputDir',
    '--executable-path': 'executablePath',
    '--timeout-ms': 'timeoutMs',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      process.stdout.write(usage());
      process.exit(0);
    }
    const equals = argument.indexOf('=');
    const flag = equals >= 0 ? argument.slice(0, equals) : argument;
    const key = aliases[flag];
    if (!key) throw new Error(`Unknown option: ${argument}\n${usage()}`);
    const value = equals >= 0 ? argument.slice(equals + 1) : argv[++index];
    if (value == null || value === '') throw new Error(`Missing value for ${flag}`);
    values[key] = key === 'timeoutMs' ? Number(value) : value;
  }
  values.profile = String(values.profile).toLowerCase();
  if (!PROFILES.has(values.profile)) throw new Error(`Unsupported profile: ${values.profile}`);
  if (!Number.isFinite(values.timeoutMs) || values.timeoutMs < 5_000) {
    throw new Error('--timeout-ms must be at least 5000');
  }
  const parsedUrl = new URL(values.baseUrl);
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('--base-url must use HTTP or HTTPS');
  if (!parsedUrl.pathname.endsWith('/')) parsedUrl.pathname += '/';
  values.baseUrl = parsedUrl.href;
  if (!values.outputDir) values.outputDir = `_stage_a_browser_qa/${values.profile}`;
  values.outputDir = path.resolve(values.outputDir);
  return values;
}

async function pathExists(candidate) {
  if (!candidate) return false;
  try {
    await fs.access(candidate, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function compactCandidates(values) {
  return [...new Set(values.filter(Boolean).map((value) => path.normalize(value)))];
}

async function resolveBrowserExecutable(profile, override) {
  if (override) {
    if (!(await pathExists(override))) throw new Error(`Browser executable is not accessible: ${override}`);
    return path.resolve(override);
  }
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const programFiles = process.env.ProgramFiles || process.env.PROGRAMFILES || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || process.env.PROGRAMFILES_X86 || 'C:\\Program Files (x86)';
  const localAppData = process.env.LOCALAPPDATA || '';
  const wantsEdge = profile === 'edge';
  const candidates = wantsEdge
    ? compactCandidates([
      process.env.EDGE_PATH,
      process.env.MSEDGE_PATH,
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      localAppData && path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      '/usr/bin/microsoft-edge-stable',
      '/usr/bin/microsoft-edge',
      home && path.join(home, 'Applications', 'Microsoft Edge.app', 'Contents', 'MacOS', 'Microsoft Edge'),
    ])
    : compactCandidates([
      process.env.CHROME_PATH,
      process.env.GOOGLE_CHROME_SHIM,
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      localAppData && path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ]);
  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate;
  }
  throw new Error(
    `No system ${wantsEdge ? 'Edge' : 'Chrome'} executable found. ` +
    `Set ${wantsEdge ? 'EDGE_PATH' : 'CHROME_PATH'} or pass --executable-path.\n` +
    `Checked: ${candidates.join(', ')}`,
  );
}

function serialiseError(error) {
  return {
    name: error?.name || 'Error',
    message: String(error?.message || error),
    stack: error?.stack || null,
  };
}

function requireValue(condition, message, detail = null) {
  if (condition) return;
  const error = new Error(message);
  error.detail = detail;
  throw error;
}

function relativeArtifact(outputDir, filename) {
  return path.relative(outputDir, filename).split(path.sep).join('/');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function projectedCoordinate(text) {
  const match = String(text).match(/E\s+(-?\d+(?:\.\d+)?)\s+·\s+N\s+(-?\d+(?:\.\d+)?)/);
  return match ? { easting: Number(match[1]), northing: Number(match[2]) } : null;
}

async function writeReports(report, outputDir) {
  report.completedAt = new Date().toISOString();
  report.summary = {
    checkCount: report.checks.length,
    failedCheckCount: report.checks.filter((check) => !check.ok).length,
    http404Count: report.events.http404.length,
    requestFailedCount: report.events.requestFailed.length,
    consoleErrorCount: report.events.consoleErrors.length,
    pageErrorCount: report.events.pageErrors.length,
    coreScreenshotCount: report.coreScreenshots.length,
    artifactCount: report.artifacts.length,
  };
  report.ok = !report.fatalError &&
    report.summary.failedCheckCount === 0 &&
    report.summary.http404Count === 0 &&
    report.summary.requestFailedCount === 0 &&
    report.summary.consoleErrorCount === 0 &&
    report.summary.pageErrorCount === 0 &&
    report.summary.coreScreenshotCount === CORE_IDS.length * REVIEW_HEIGHTS.length;
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const lines = [
    '# Guilin v0.5 Stage A browser QA',
    '',
    `- Result: ${report.ok ? 'PASS' : 'FAIL'}`,
    `- Profile: ${report.profile}`,
    `- Browser: ${report.browser?.version || 'not launched'}`,
    `- Base URL: ${report.baseUrl}`,
    `- Core screenshots: ${report.summary.coreScreenshotCount}/12`,
    `- HTTP 404: ${report.summary.http404Count}`,
    `- Request failed: ${report.summary.requestFailedCount}`,
    `- Console errors: ${report.summary.consoleErrorCount}`,
    `- Page errors: ${report.summary.pageErrorCount}`,
  ];
  if (report.fatalError) lines.push('', `Fatal: ${report.fatalError.message}`);
  await fs.writeFile(path.join(outputDir, 'summary.md'), `${lines.join('\n')}\n`, 'utf8');
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  await fs.mkdir(options.outputDir, { recursive: true });
  const report = {
    schema: 'guilin-v050-stage-a-browser-report/v1',
    startedAt: new Date().toISOString(),
    completedAt: null,
    ok: false,
    profile: options.profile,
    baseUrl: options.baseUrl,
    outputDirectory: options.outputDir,
    executablePath: null,
    browser: null,
    viewport: options.profile === 'mobile' ? { width: 390, height: 844 } : { width: 1600, height: 1000 },
    checks: [],
    events: { http404: [], requestFailed: [], consoleErrors: [], pageErrors: [] },
    cores: [],
    coreScreenshots: [],
    gaea: null,
    mobile: null,
    artifacts: [],
    fatalError: null,
  };
  let browser = null;
  let context = null;
  let page = null;

  const check = async (name, callback) => {
    const startedAt = new Date().toISOString();
    try {
      const detail = await callback();
      report.checks.push({ name, ok: true, startedAt, completedAt: new Date().toISOString(), detail: detail ?? null });
      return detail;
    } catch (error) {
      report.checks.push({
        name,
        ok: false,
        startedAt,
        completedAt: new Date().toISOString(),
        error: serialiseError(error),
        detail: error.detail ?? null,
      });
      throw error;
    }
  };

  const screenshot = async (filename, kind, metadata = {}) => {
    const target = path.join(options.outputDir, filename);
    const buffer = await page.screenshot({ path: target, type: 'png', fullPage: false });
    const artifact = { file: relativeArtifact(options.outputDir, target), kind, sha256: sha256(buffer), ...metadata };
    report.artifacts.push(artifact);
    return { target, buffer, artifact };
  };

  try {
    report.executablePath = await resolveBrowserExecutable(options.profile, options.executablePath);
    browser = await chromium.launch({
      executablePath: report.executablePath,
      headless: true,
      args: [
        '--no-first-run',
        '--disable-default-apps',
        '--disable-background-networking',
        '--disable-component-update',
        '--disable-features=Translate,MediaRouter',
        '--ignore-gpu-blocklist',
        '--enable-unsafe-swiftshader',
        '--use-angle=swiftshader',
      ],
    });
    const mobile = options.profile === 'mobile';
    context = await browser.newContext({
      viewport: report.viewport,
      screen: report.viewport,
      deviceScaleFactor: mobile ? 1 : 1,
      hasTouch: mobile,
      isMobile: mobile,
      locale: 'zh-CN',
      colorScheme: 'dark',
    });
    page = await context.newPage();
    page.setDefaultTimeout(options.timeoutMs);
    page.setDefaultNavigationTimeout(options.timeoutMs);

    page.on('response', (response) => {
      if (response.status() !== 404) return;
      const request = response.request();
      report.events.http404.push({
        url: response.url(),
        method: request.method(),
        resourceType: request.resourceType(),
      });
    });
    page.on('requestfailed', (request) => {
      report.events.requestFailed.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        errorText: request.failure()?.errorText || 'unknown',
      });
    });
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      report.events.consoleErrors.push({
        text: message.text(),
        location: message.location(),
      });
    });
    page.on('pageerror', (error) => report.events.pageErrors.push(serialiseError(error)));

    await check('open-workbench', async () => {
      const response = await page.goto(options.baseUrl, { waitUntil: 'domcontentloaded' });
      requireValue(response, 'Main document returned no HTTP response');
      requireValue(response.status() < 400, `Main document returned HTTP ${response.status()}`, { url: response.url() });
      return { status: response.status(), url: response.url() };
    });

    await check('wait-demo-ready', async () => {
      await page.waitForFunction(() => (
        (window.__DEMO_READY__ === true &&
          window.GuilinWorkbench &&
          window.__GUILIN_WORKBENCH_DIAGNOSTICS__?.ready === true) ||
        document.querySelector('#errorCard')?.classList.contains('visible')
      ));
      const fatalVisible = await page.locator('#errorCard.visible').count();
      const fatalText = fatalVisible ? await page.locator('#errorCard').textContent() : null;
      requireValue(fatalVisible === 0, 'Runtime fatal error card is visible', { fatalText });
      requireValue(await page.evaluate(() => window.__DEMO_READY__ === true), 'window.__DEMO_READY__ did not become true');
      return await page.evaluate(() => window.GuilinWorkbench.getDiagnostics());
    });

    report.browser = {
      version: browser.version(),
      userAgent: await page.evaluate(() => navigator.userAgent),
    };

    await check('single-runtime-surface', async () => {
      const surface = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        const bounds = canvas?.getBoundingClientRect();
        return {
          iframeCount: document.querySelectorAll('iframe').length,
          canvasCount: document.querySelectorAll('canvas').length,
          canvasId: canvas?.id || null,
          canvasVisible: Boolean(bounds && bounds.width > 0 && bounds.height > 0),
          diagnostics: window.GuilinWorkbench.getDiagnostics().sharedRuntime,
        };
      });
      requireValue(surface.iframeCount === 0, 'An iframe is present in the unified workbench', surface);
      requireValue(surface.canvasCount === 1, 'The unified workbench must contain exactly one canvas', surface);
      requireValue(surface.canvasId === 'gl' && surface.canvasVisible, 'The shared #gl canvas is not visible', surface);
      requireValue(surface.diagnostics.iframeCount === 0 && surface.diagnostics.canvasCount === 1, 'Runtime diagnostics disagree with the DOM', surface);
      return surface;
    });

    await check('four-core-manifests-and-review-heights', async () => {
      for (const coreId of CORE_IDS) {
        await page.locator(`[data-core="${coreId}"]`).click();
        await page.evaluate(() => window.GuilinWorkbench.waitForIdle());
        await page.waitForFunction((expectedId) => {
          const diagnostics = window.GuilinWorkbench?.getDiagnostics?.();
          return diagnostics?.activeCoreId === expectedId &&
            diagnostics?.dataset?.id === expectedId &&
            diagnostics?.dataset?.gridWidth === 800 &&
            diagnostics?.dataset?.gridHeight === 800;
        }, coreId);
        const core = await page.evaluate(() => {
          const state = window.GuilinWorkbench.getState();
          const diagnostics = window.GuilinWorkbench.getDiagnostics();
          const manifest = state.dataset?.manifest || {};
          return {
            activeCoreId: diagnostics.activeCoreId,
            datasetId: diagnostics.dataset?.id,
            manifestId: manifest.id,
            schemaVersion: manifest.schemaVersion,
            rasterWidth: manifest.raster?.width,
            rasterHeight: manifest.raster?.height,
            resolutionMeters: manifest.raster?.resolutionMeters,
            widthMeters: manifest.widthMeters,
            heightMeters: manifest.heightMeters,
            sourceStatus: manifest.sourceStatus || manifest.status,
            activeButton: document.querySelector(`[data-core="${manifest.id}"]`)?.classList.contains('active') || false,
          };
        });
        requireValue(core.activeCoreId === coreId && core.datasetId === coreId && core.manifestId === coreId, `Active core identity mismatch for ${coreId}`, core);
        requireValue(core.rasterWidth === 800 && core.rasterHeight === 800, `${coreId} is not backed by an 800x800 manifest`, core);
        requireValue(core.resolutionMeters === 12.5 && core.widthMeters === 10_000 && core.heightMeters === 10_000, `${coreId} manifest has the wrong metric grid`, core);
        requireValue(core.activeButton, `${coreId} button did not become active`, core);
        core.screenshots = [];
        for (const height of REVIEW_HEIGHTS) {
          await page.evaluate((reviewHeight) => window.GuilinWorkbench.setCameraHeight(reviewHeight), height);
          await page.waitForFunction((expectedHeight) => {
            const camera = window.GuilinWorkbench?.getDiagnostics?.().camera;
            return camera &&
              Math.abs(Number(camera.reviewHeightMeters) - expectedHeight) < 0.01 &&
              Math.abs(Number(camera.altitudeAboveGroundMeters) - expectedHeight) < 0.15;
          }, height);
          await page.waitForTimeout(850);
          const camera = await page.evaluate(() => window.GuilinWorkbench.getDiagnostics().camera);
          const heightLabel = String(height).replace('.', '_');
          const image = await screenshot(`core-${coreId}-${heightLabel}m.png`, 'core-review', { coreId, heightMeters: height });
          const entry = { coreId, heightMeters: height, camera, file: image.artifact.file };
          core.screenshots.push(entry);
          report.coreScreenshots.push(entry);
        }
        report.cores.push(core);
      }
      requireValue(report.coreScreenshots.length === 12, 'Exactly 12 four-core height screenshots are required', { count: report.coreScreenshots.length });
      return { cores: report.cores, screenshotCount: report.coreScreenshots.length };
    });

    await check('gaea-browser-preview-before-after', async () => {
      await page.locator('[data-workspace="gaea"]').click();
      await page.waitForFunction(() => document.querySelector('[data-panel="gaea"]')?.classList.contains('active'));
      await page.evaluate(() => { document.querySelector('.controller-scroll').scrollTop = 0; });
      await page.waitForTimeout(300);
      const beforeState = await page.evaluate(() => window.GuilinWorkbench.getDiagnostics().gaea);
      const beforeImage = await screenshot('gaea-before.png', 'gaea-before');
      const revision = Number(beforeState.preview?.revision || 0);
      const changes = { verticalEx: '2.20', mountainBoost: '0.82', karstStrength: '0.88', erosionStrength: '0.84' };
      for (const [id, value] of Object.entries(changes)) {
        await page.locator(`#${id}`).evaluate((input, nextValue) => {
          input.value = nextValue;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }, value);
      }
      await page.locator('[data-gaea-mode="browser"]').click();
      await page.locator('#gaeaBuildButton').click();
      await page.waitForFunction((previousRevision) => {
        const gaea = window.GuilinWorkbench?.getDiagnostics?.().gaea;
        return gaea?.preview?.approximation === true && Number(gaea.preview.revision) > previousRevision;
      }, revision);
      await page.evaluate(() => { document.querySelector('.controller-scroll').scrollTop = 0; });
      await page.waitForTimeout(850);
      const afterState = await page.evaluate(() => window.GuilinWorkbench.getDiagnostics().gaea);
      const afterImage = await screenshot('gaea-after.png', 'gaea-after');
      requireValue(afterState.preview?.approximation === true, 'GAEA browser preview lost its approximation label', afterState);
      requireValue(afterState.preview?.authoritativeElevationChanged === false, 'Browser preview claimed to change authoritative elevation', afterState);
      requireValue(Math.abs(afterState.preview?.runtimeParameters?.verticalEx - 2.2) < 0.001, 'GAEA vertical preview parameter did not reach the shared runtime', afterState);
      report.gaea = {
        before: beforeState,
        after: afterState,
        beforeScreenshot: beforeImage.artifact.file,
        afterScreenshot: afterImage.artifact.file,
      };
      return report.gaea;
    });

    if (options.profile === 'mobile') {
      await check('mobile-390x844-controls-and-touch-movement', async () => {
        const viewport = page.viewportSize();
        requireValue(viewport?.width === 390 && viewport?.height === 844, 'Mobile viewport is not 390x844', viewport);
        if (await page.locator('#controller.open').count()) await page.locator('#closePanel').click();
        const reachable = [];
        for (const selector of [
          '[data-workspace="gaea"]',
          '[data-core="yangshuo-county-seat"]',
          '#touchPad [data-move="forward"]',
        ]) {
          const locator = page.locator(selector);
          await locator.scrollIntoViewIfNeeded();
          await locator.click({ trial: true });
          const box = await locator.boundingBox();
          requireValue(box && box.width > 0 && box.height > 0, `Mobile control is not reachable while the panel is closed: ${selector}`, box);
          reachable.push({ selector, panel: 'closed', box });
        }
        const toggleBox = await page.locator('#panelToggle').boundingBox();
        requireValue(toggleBox, 'Mobile controller toggle is not reachable');
        await page.touchscreen.tap(toggleBox.x + toggleBox.width / 2, toggleBox.y + toggleBox.height / 2);
        await page.waitForFunction(() => document.querySelector('#controller')?.classList.contains('open'));
        const reachableSelectors = [
          '#verticalEx',
          '[data-camera="1.7m"]',
          '#closePanel',
        ];
        for (const selector of reachableSelectors) {
          const locator = page.locator(selector);
          await locator.scrollIntoViewIfNeeded();
          await locator.click({ trial: true });
          const box = await locator.boundingBox();
          requireValue(box && box.width > 0 && box.height > 0, `Mobile control is not reachable: ${selector}`, box);
          reachable.push({ selector, panel: 'open', box });
        }
        const closeBox = await page.locator('#closePanel').boundingBox();
        await page.touchscreen.tap(closeBox.x + closeBox.width / 2, closeBox.y + closeBox.height / 2);
        await page.waitForFunction(() => !document.querySelector('#controller')?.classList.contains('open'));

        const forward = page.locator('#touchPad [data-move="forward"]');
        const forwardBox = await forward.boundingBox();
        requireValue(forwardBox, 'Touch movement pad is not visible');
        const beforeText = await page.locator('#cameraDiagnostics').textContent();
        const beforeCoordinate = projectedCoordinate(beforeText);
        requireValue(beforeCoordinate, 'Could not read the camera coordinate before touch movement', { beforeText });
        const beforeImage = await screenshot('mobile-touch-before.png', 'mobile-touch-before');
        const cdp = await context.newCDPSession(page);
        const point = {
          x: Math.round(forwardBox.x + forwardBox.width / 2),
          y: Math.round(forwardBox.y + forwardBox.height / 2),
          radiusX: 4,
          radiusY: 4,
          force: 1,
          id: 1,
        };
        try {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
          await page.waitForTimeout(900);
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } finally {
          await cdp.detach();
        }
        await page.waitForTimeout(950);
        const afterText = await page.locator('#cameraDiagnostics').textContent();
        const afterCoordinate = projectedCoordinate(afterText);
        requireValue(afterCoordinate, 'Could not read the camera coordinate after touch movement', { afterText });
        const distanceMeters = Math.hypot(
          afterCoordinate.easting - beforeCoordinate.easting,
          afterCoordinate.northing - beforeCoordinate.northing,
        );
        const afterImage = await screenshot('mobile-touch-after.png', 'mobile-touch-after');
        requireValue(distanceMeters >= 1, 'Touch hold did not move the shared camera', { beforeCoordinate, afterCoordinate, distanceMeters });
        requireValue(beforeImage.artifact.sha256 !== afterImage.artifact.sha256, 'Touch movement did not alter the rendered viewport');
        report.mobile = {
          viewport,
          reachable,
          beforeCoordinate,
          afterCoordinate,
          distanceMeters,
          beforeScreenshot: beforeImage.artifact.file,
          afterScreenshot: afterImage.artifact.file,
        };
        return report.mobile;
      });
    }

    await page.waitForTimeout(1_000);
    await check('zero-http-and-runtime-errors', async () => {
      const finalSurface = await page.evaluate(() => ({
        iframeCount: document.querySelectorAll('iframe').length,
        canvasCount: document.querySelectorAll('canvas').length,
      }));
      const counts = {
        http404: report.events.http404.length,
        requestFailed: report.events.requestFailed.length,
        consoleErrors: report.events.consoleErrors.length,
        pageErrors: report.events.pageErrors.length,
      };
      requireValue(finalSurface.iframeCount === 0 && finalSurface.canvasCount === 1, 'Unified surface changed during interaction', finalSurface);
      requireValue(Object.values(counts).every((count) => count === 0), 'HTTP or runtime error channels are not zero', {
        counts,
        events: report.events,
      });
      return { ...counts, ...finalSurface };
    });
  } catch (error) {
    report.fatalError = serialiseError(error);
    if (page) {
      try {
        const failure = await screenshot('failure.png', 'failure', { error: report.fatalError.message });
        report.failureScreenshot = failure.artifact.file;
      } catch {
        // The page or browser may already be gone. The JSON report remains authoritative.
      }
    }
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    await writeReports(report, options.outputDir);
  }

  process.stdout.write(`${JSON.stringify({
    ok: report.ok,
    profile: report.profile,
    report: path.join(options.outputDir, 'report.json'),
    summary: report.summary,
    fatalError: report.fatalError,
  }, null, 2)}\n`);
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
