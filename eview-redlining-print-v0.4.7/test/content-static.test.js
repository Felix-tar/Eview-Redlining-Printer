"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const source = fs.readFileSync(path.join(__dirname, "../src/content.js"), "utf8");
const entryStart = source.indexOf("function entryElements(panel, scroller, activeStatus)");
const captureStart = source.indexOf("async function captureVisibleEntries", entryStart);
const entryFunction = source.slice(entryStart, captureStart);

assert.ok(entryStart >= 0, "Status-aware entryElements function is required");
assert.ok(entryFunction.includes("statusLabels(panel).find((item) => item.status === activeStatus)"));
assert.ok(entryFunction.includes("if (activeStatus && !activeGroup) return []"));
assert.ok(entryFunction.includes("if (activeGroup && !activeGroup.contains(element)) continue"));

const statusGate = entryFunction.indexOf("!activeGroup.contains(element)");
const clickTarget = entryFunction.indexOf("let clickTarget = null");
assert.ok(statusGate >= 0 && statusGate < clickTarget, "Unselected status rows must be rejected before click target selection");
assert.ok(source.includes("entryElements(panel, scroller, activeStatus)"), "The active status must be applied during every scroll step");
assert.ok(source.includes('captureElement.style.setProperty("display", "none", "important")'), "The complete Redlining sidebar must be removed during capture");
assert.ok(source.includes('if (previousStyle === null) captureElement.removeAttribute("style")'), "Sidebar styles must be restored after capture");
assert.ok(source.includes('rightToolbar[rightToolbar.length - 3].element'), "The unlabeled eVIEW fit-view button needs a positional fallback");
assert.ok(source.includes("async function resetViewImmediatelyBeforeCapture(fitControl, options = {})"), "The 100 percent reset must support adaptive timing");
assert.ok(source.includes('data-eview-print-hidden-zoom-indicator'), "The centered 100 percent overlay must be suppressed");
assert.ok(source.includes("async function enterFullscreenForCapture(panel, fitControl, options = {})"), "Fullscreen handling must support a held automatic-scan session");
assert.ok(source.includes('{ key: "f", code: "KeyF"'), "The eVIEW F shortcut must be available as a fullscreen fallback");
const fullscreenStart = source.indexOf("const fullscreen = await enterFullscreenForCapture");
const resetStart = source.indexOf("await resetViewImmediatelyBeforeCapture", fullscreenStart);
const contextStart = source.indexOf("context: pageContext", resetStart);
assert.ok(fullscreenStart >= 0 && fullscreenStart < resetStart && resetStart < contextStart,
  "Capture order must be fullscreen, 100 percent reset, then cached screenshot context");
assert.ok(source.includes('const candidates = collect("canvas, svg", 0.08, false)'), "The drawing canvas/SVG must be preferred");
assert.ok(!source.includes("setTimeout(resolve, 850)"), "The old fixed per-entry wait must not return");
assert.ok(source.includes("async function prepareViewerForAutoCapture()"), "The automatic scan must prepare eVIEW fullscreen before iterating redlinings");
assert.ok(source.includes("const viewerSession = await prepareViewerForAutoCapture();"), "The automatic scan must enter the viewer fullscreen on its own");
assert.ok(source.includes("function findSidebarToggleControl()"), "The left drawer toggle must be available as a fallback in fullscreen");

assert.ok(source.includes("function viewerToolbarCandidates(panel)"), "The exact eVIEW viewer toolbar must be detected positionally");
assert.ok(source.includes("const rightmost = sameRow[0]"), "The fullscreen button must prefer the rightmost viewer toolbar icon");


assert.ok(source.includes('eplan-icon-button[data-t="ev-btn-full-screen"]'), "The exact eVIEW fullscreen control from the exported DOM must be used");
assert.ok(source.includes('document.querySelector("#ev-viewmenu-zoomall")'), "The exact eVIEW 100 percent control must be used");
assert.ok(source.includes("autoViewerFullscreenActive"), "Automatic scans must keep eVIEW fullscreen across all page captures");
assert.ok(source.includes("holdForAutoScan: true"), "The automatic scan must explicitly hold fullscreen until it finishes");
assert.ok(source.includes("function activateViewerFullscreenFromTrustedGesture()"), "Fullscreen must be activated synchronously from a trusted page gesture");
assert.ok(source.includes("Vollbild + Redlining-Suche starten"), "The popup-start fallback must expose an in-page trusted start button");
assert.ok(source.includes("startAutoScanAfterTrustedActivation"), "The scan must begin only after the trusted fullscreen activation");


assert.ok(source.includes("function snapshotEntriesForFilters(rawFilters)"), "Redlining rows must be snapshotted before fullscreen");
assert.ok(source.includes('"ev-redlining-status-committed"'), "The exact eVIEW review-status DOM id must be used");
assert.ok(source.includes("async function waitForNativeFullscreenSettled(beforeRect)"), "The native eVIEW fullscreen transition must settle before capture");
assert.ok(source.includes("const captureElement = autoViewerFullscreenActive ? null : captureSidebarElement(panel)"), "Per-page capture must not toggle the sidebar while native fullscreen is held");
assert.ok(source.includes("pendingTrustedSnapshot"), "Trusted-start scans must reuse the pre-fullscreen Redlining snapshot");
assert.ok(source.includes("captureSnapshotEntries"), "Hidden Redlining rows must be clickable without reopening the list");
assert.ok(source.includes("const TIMING_PROFILES"), "Adaptive fast/normal/slow timing profiles must exist");
assert.ok(source.includes("viewerDrawingLooksReady"), "The scan must verify that the drawing is actually loaded");
assert.ok(source.includes("clickRedliningAndWait"), "Slow connections must support a retryable Redlining click");
assert.ok(source.includes("autoPreparedPageKey"), "A prepared page must not be fitted a second time immediately before capture");
console.log("OK: Active-status scanning and clean drawing capture");
