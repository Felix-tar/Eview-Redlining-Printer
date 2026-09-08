(function startContentBridge() {
  "use strict";

  const core = self.EviewRedliningCore;
  const observations = [];
  const records = [];
  const unresolved = [];
  const STATUS_NAMES = Object.values(core.STATUS_ALIASES).flat();
  const DEFAULT_FILTERS = {
    statuses: ["review"],
    assignment: { enabled: true, source: "ST", target: "MOE", customPatterns: [] },
    timingMode: "normal"
  };
  const NON_ENTRY_TEXT = new Set([
    "redlining", "redlinings", "greenlining", "greenlinings", "seiten", "pages", "geräte", "geraete", "devices",
    "suchen", "search", "aktualisieren", "refresh"
  ].concat(STATUS_NAMES));

  function mergeUnique(target, incoming, keyBuilder) {
    const existing = new Set(target.map(keyBuilder));
    for (const item of incoming) {
      const key = keyBuilder(item);
      if (existing.has(key)) continue;
      existing.add(key);
      target.push(item);
    }
  }

  document.addEventListener("eview-redlining-print:network", (event) => {
    const detail = event.detail || {};
    if (/\/assets\/|\/translations\//i.test(detail.endpoint || "")) {
      observations.push({ endpoint: detail.endpoint, status: detail.status || 0, ignored: "static-translation" });
      return;
    }
    const result = core.extractCandidates(detail.payload);
    mergeUnique(records, result.records, (item) => `${item.redliningId}|${item.pageRef}|${item.sourcePath}`);
    mergeUnique(unresolved, result.unresolved, (item) => `${item.redliningId}|${item.sourcePath}`);
    observations.push({
      endpoint: detail.endpoint || "unknown",
      status: detail.status || 0,
      records: result.records.length,
      unresolved: result.unresolved.length,
      visitedNodes: result.visited,
      topLevelKeys: detail.payload && !Array.isArray(detail.payload) && typeof detail.payload === "object"
        ? Object.keys(detail.payload).slice(0, 30)
        : []
    });
    if (observations.length > 50) observations.shift();
  });

  function visible(element) {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 2 && rect.height > 2;
  }

  function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  const STATUS_OVERLAY_ID = "eview-redlining-print-status";
  let statusOverlayTimer = null;
  let autoViewerFullscreenActive = false;
  let autoViewerFullscreenControl = null;
  let autoScanChromeState = null;
  let autoViewerBaselineWidth = 0;
  const AUTO_FULLSCREEN_STYLE_ID = "eview-redlining-auto-fullscreen-layout";
  let autoScanPanelReference = null;
  let pendingTrustedSnapshot = null;
  const TRUSTED_START_OVERLAY_ID = "eview-redlining-trusted-start";
  let pendingTrustedFilters = null;
  const STATUS_DOM_IDS = {
    draft: "ev-redlining-status-new",
    review: "ev-redlining-status-committed",
    confirmed: "ev-redlining-status-approved",
    completed: "ev-redlining-status-done",
    rejected: "ev-redlining-status-removed"
  };
  const TIMING_PROFILES = {
    fast: {
      mode: "fast", poll: 60, samePageGrace: 220, changedMinDelay: 320,
      pageLoadTimeout: 2600, retryCount: 0, retryDelay: 160,
      layoutDelay: 70, layoutRetryDelay: 180, fitAttempts: 1, fitDelay: 120, postFitDelay: 60
    },
    normal: {
      mode: "normal", poll: 80, samePageGrace: 300, changedMinDelay: 520,
      pageLoadTimeout: 6500, retryCount: 1, retryDelay: 280,
      layoutDelay: 90, layoutRetryDelay: 240, fitAttempts: 2, fitDelay: 150, postFitDelay: 80
    },
    slow: {
      mode: "slow", poll: 120, samePageGrace: 450, changedMinDelay: 900,
      pageLoadTimeout: 18000, retryCount: 2, retryDelay: 700,
      layoutDelay: 180, layoutRetryDelay: 650, fitAttempts: 3, fitDelay: 260, postFitDelay: 180
    }
  };
  let autoTimingProfile = TIMING_PROFILES.normal;
  let autoPreparedPageKey = null;
  let autoPreparedAt = 0;

  function snapshotEntriesForFilters(rawFilters) {
    const filters = rawFilters || DEFAULT_FILTERS;
    const statuses = Array.isArray(filters.statuses) && filters.statuses.length ? filters.statuses : DEFAULT_FILTERS.statuses;
    const result = [];
    const seen = new Set();
    for (const status of statuses) {
      const containerId = STATUS_DOM_IDS[status];
      const container = containerId ? document.getElementById(containerId) : null;
      if (!container) continue;
      const rows = Array.from(container.querySelectorAll(
        'pv-annotation-list-item[id^="ev-annotationlist-row-"], [id^="ev-annotationlist-row-"]'
      ));
      for (const row of rows) {
        const rowId = row.id || "";
        const titleNode = row.querySelector('.ev-annotationlist-title, [class*="annotationlist-title" i]');
        const title = String((titleNode && titleNode.textContent) || row.textContent || "").replace(/\s+/g, " ").trim();
        if (!title) continue;
        const key = rowId || `${status}|${title}|${result.length}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({ rowId, element: row, text: title, key, status });
      }
    }
    return result;
  }

  function viewerRect() {
    const element = document.querySelector('#ev-viewer-cadview, #ev-viewer-canvas, .cadview-container');
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, area: rect.width * rect.height };
  }

  async function waitForNativeFullscreenSettled(beforeRect) {
    const beforeArea = beforeRect && beforeRect.area || 0;
    const startedAt = performance.now();
    let previousArea = 0;
    let stableSamples = 0;
    let sawFullscreenSignal = false;
    while (performance.now() - startedAt < 2800) {
      await delay(100);
      const current = viewerRect();
      const area = current && current.area || 0;
      const classSignal = Boolean(document.querySelector(
        '.header-content-container.fullscreen-mode, .fullscreen-mode, [class*="fullscreen-mode" i]'
      ));
      const areaSignal = beforeArea > 0 && area >= beforeArea * 1.04;
      if (classSignal || areaSignal) sawFullscreenSignal = true;
      if (sawFullscreenSignal && area > 0) {
        const delta = previousArea > 0 ? Math.abs(area - previousArea) / area : 1;
        stableSamples = delta < 0.004 ? stableSamples + 1 : 0;
        if (stableSamples >= 3) break;
      }
      previousArea = area;
    }
    // eVIEW animiert Header/Sidebars. Erst nach dem Ende der Animation darf
    // Zoom 100 % berechnet werden, sonst passt eVIEW auf die alte Viewerbreite ein.
    await delay(sawFullscreenSignal ? 320 : 900);
    window.dispatchEvent(new Event('resize'));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return sawFullscreenSignal;
  }

  function exactFullscreenControl() {
    return document.querySelector('eplan-icon-button[data-t="ev-btn-full-screen"]')
      || document.querySelector('.ev-fullscreen-control[data-t="ev-btn-full-screen"]')
      || document.querySelector('.ev-fullscreen-control');
  }

  function viewerFullscreenLooksActive() {
    if (document.fullscreenElement) return true;
    if (document.querySelector('.fullscreen-mode, [class*="fullscreen-mode" i]')) return true;
    const control = exactFullscreenControl();
    if (!control) return false;
    const nearby = control.closest('.ev-label-position, .ev-btn-group-dropdown') || control.parentElement || control;
    const signature = [
      control.getAttribute('aria-label'),
      control.getAttribute('title'),
      control.getAttribute('aria-pressed'),
      control.innerHTML,
      nearby && nearby.textContent
    ].filter(Boolean).join(' ');
    return /(full.?screen.?exit|exit.?full.?screen|vollbild.*(beenden|verlassen)|restore|compress|minimi[sz]e)/i.test(signature);
  }

  function activateViewerFullscreenFromTrustedGesture() {
    if (viewerFullscreenLooksActive()) {
      autoViewerFullscreenActive = true;
      autoViewerFullscreenControl = exactFullscreenControl();
      return true;
    }
    const control = exactFullscreenControl();
    if (!control || !control.isConnected) return false;
    try { control.focus({ preventScroll: true }); } catch (_) {}
    // Wichtig: Dieser click() läuft synchron innerhalb eines echten Maus-/Tastatur-
    // Ereignisses auf der eVIEW-Seite. Falls eVIEW intern requestFullscreen() nutzt,
    // bleibt dadurch die erforderliche Browser-User-Activation erhalten.
    control.click();
    autoViewerFullscreenActive = true;
    autoViewerFullscreenControl = control;
    return true;
  }

  function removeTrustedStartOverlay() {
    const node = document.getElementById(TRUSTED_START_OVERLAY_ID);
    if (node) node.remove();
  }

  async function startAutoScanAfterTrustedActivation(filters, beforeRect) {
    removeTrustedStartOverlay();
    showExtensionStatus('Vollbild wird aufgebaut …', 'running');
    try {
      await waitForNativeFullscreenSettled(beforeRect);
      showExtensionStatus('Vollbild aktiv – Redlining-Suche startet …', 'running');
      const response = await chrome.runtime.sendMessage({ type: 'AUTO_CAPTURE_ALL', filters });
      if (!response || !response.ok) throw new Error(response && response.error || 'Automatische Erfassung fehlgeschlagen.');
    } catch (error) {
      showExtensionStatus(error.message, 'error');
    }
  }

  function beginTrustedAutoScan(filters) {
    // Wichtig: Redlining-Zeilen VOR dem Vollbild merken. Im echten eVIEW-
    // Vollbild verschwinden die Sidebars, die Angular-Elemente bleiben aber
    // anklickbar bzw. können über ihre stabilen IDs erneut gefunden werden.
    autoScanPanelReference = findRedliningPanel() || autoScanPanelReference;
    pendingTrustedSnapshot = snapshotEntriesForFilters(filters);
    const beforeRect = viewerRect();
    if (!activateViewerFullscreenFromTrustedGesture()) {
      showExtensionStatus('Der eVIEW-Vollbildknopf wurde nicht gefunden.', 'error');
      return;
    }
    void startAutoScanAfterTrustedActivation(filters, beforeRect);
  }

  function showTrustedStartOverlay(filters) {
    pendingTrustedFilters = filters || DEFAULT_FILTERS;
    removeTrustedStartOverlay();
    const wrap = document.createElement('div');
    wrap.id = TRUSTED_START_OVERLAY_ID;
    Object.assign(wrap.style, {
      position: 'fixed', inset: '0', zIndex: '2147483646',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,.28)'
    });
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Vollbild + Redlining-Suche starten';
    Object.assign(button.style, {
      font: '600 16px/1.2 "Segoe UI", Arial, sans-serif', padding: '16px 22px',
      borderRadius: '10px', border: '0', cursor: 'pointer',
      boxShadow: '0 8px 28px rgba(0,0,0,.35)'
    });
    button.addEventListener('click', () => beginTrustedAutoScan(pendingTrustedFilters), { once: true });
    wrap.addEventListener('click', (event) => { if (event.target === wrap) removeTrustedStartOverlay(); });
    wrap.append(button);
    document.body.append(wrap);
  }

  document.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey && event.shiftKey && (event.code === 'Digit8' || event.key === '8'))) return;
    event.preventDefault();
    event.stopPropagation();
    // Vor dem Vollbild alle aktuell vorhandenen Redlining-Zeilen merken. So
    // funktioniert auch der Shortcut, ohne die linke Liste später zu öffnen.
    autoScanPanelReference = findRedliningPanel() || autoScanPanelReference;
    const allSnapshot = snapshotEntriesForFilters({ statuses: Object.keys(STATUS_DOM_IDS) });
    const beforeRect = viewerRect();
    if (!activateViewerFullscreenFromTrustedGesture()) {
      showExtensionStatus('Der eVIEW-Vollbildknopf wurde nicht gefunden.', 'error');
      return;
    }
    chrome.runtime.sendMessage({ type: 'GET_STATE' }).then((state) => {
      const filters = state && state.filters || DEFAULT_FILTERS;
      const selected = new Set(filters.statuses || DEFAULT_FILTERS.statuses);
      pendingTrustedSnapshot = allSnapshot.filter((entry) => selected.has(entry.status));
      return startAutoScanAfterTrustedActivation(filters, beforeRect);
    }).catch((error) => showExtensionStatus(error.message, 'error'));
  }, true);

  function showExtensionStatus(message, kind = "info") {
    if (!document.body || !message) return;
    let node = document.getElementById(STATUS_OVERLAY_ID);
    if (!node) {
      node = document.createElement("div");
      node.id = STATUS_OVERLAY_ID;
      node.setAttribute("aria-live", "polite");
      Object.assign(node.style, {
        position: "fixed",
        top: "18px",
        right: "18px",
        zIndex: "2147483647",
        maxWidth: "420px",
        padding: "11px 14px",
        borderRadius: "8px",
        background: "rgba(23, 32, 42, .94)",
        color: "white",
        font: '600 13px/1.35 "Segoe UI", Arial, sans-serif',
        boxShadow: "0 4px 18px rgba(0,0,0,.28)",
        pointerEvents: "none"
      });
      document.body.append(node);
    }
    node.textContent = message;
    node.dataset.kind = kind;
    node.style.setProperty("display", "block", "important");
    node.style.background = kind === "error"
      ? "rgba(153, 27, 27, .95)"
      : kind === "success" ? "rgba(22, 101, 52, .95)" : "rgba(23, 32, 42, .94)";
    clearTimeout(statusOverlayTimer);
    if (kind === "success" || kind === "error") {
      statusOverlayTimer = setTimeout(() => {
        if (node && node.isConnected) node.style.display = "none";
      }, 8000);
    }
  }

  function elementClass(element) {
    return String(element.className && element.className.baseVal || element.className || "");
  }

  function drawingBounds(excludedPanel) {
    const viewportArea = innerWidth * innerHeight;
    const collect = (selector, minimumArea, rejectChrome) => Array.from(document.querySelectorAll(selector))
      .filter((element) => !excludedPanel || (!excludedPanel.contains(element) && element !== excludedPanel))
      .filter(visible)
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ element, rect }) => {
        if (rect.width * rect.height < viewportArea * minimumArea) return false;
        if (rejectChrome && /(side.?bar|navigator|toolbar|menu|header|annotation.?list|redlining.?list)/i.test(elementClass(element))) return false;
        return rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight;
      })
      .sort((a, b) => (b.rect.width * b.rect.height) - (a.rect.width * a.rect.height));

    // Das eigentliche Zeichen-Canvas/SVG hat Vorrang. Dadurch werden Navigation,
    // Redlining-Liste und Werkzeugleisten nicht versehentlich Teil des Bildausschnitts.
    const candidates = collect("canvas, svg", 0.08, false);
    if (!candidates.length) {
      candidates.push(...collect(
        "[class*='viewer' i], [class*='schematic' i], [class*='drawing' i], [class*='page-view' i], [class*='view-content' i]",
        0.12,
        true
      ));
    }

    const selected = candidates[0];
    if (!selected) {
      return { x: 0, y: 0, width: innerWidth, height: innerHeight, fallback: true };
    }
    const rect = selected.rect;
    const x = Math.max(0, rect.left);
    const y = Math.max(0, rect.top);
    return {
      x,
      y,
      width: Math.min(innerWidth - x, rect.right - x),
      height: Math.min(innerHeight - y, rect.bottom - y),
      fallback: false,
      element: selected.element.tagName.toLowerCase(),
      className: elementClass(selected.element).slice(0, 180)
    };
  }

  function selectedPageLabel() {
    const selectors = [
      "[aria-current='page']", "[aria-selected='true']", "[class*='page' i][class*='selected' i]",
      "[class*='page' i][class*='active' i]"
    ];
    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        if (!visible(element)) continue;
        const text = (element.getAttribute("aria-label") || element.textContent || "").trim();
        if (text && text.length < 180) return text;
      }
    }
    return `${document.title || "eVIEW-Seite"} | ${location.pathname}${location.hash}`;
  }

  function pageKey() {
    const match = location.pathname.match(/^(.*\/projects\/[^/]+\/pages\/[^/?#]+)/i);
    return match ? match[1] : `${location.pathname}${location.hash}`;
  }

  function pageContext(excludedPanel, pageRefOverride) {
    return {
      pageKey: pageKey(),
      pageRef: pageRefOverride || selectedPageLabel(),
      bounds: drawingBounds(excludedPanel),
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio }
    };
  }

  function directText(element) {
    return Array.from(element.childNodes || [])
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent || "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizedText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function fireShortcutFive() {
    const target = document.activeElement && !/^(input|textarea|select)$/i.test(document.activeElement.tagName)
      ? document.activeElement : document.body;
    for (const type of ["keydown", "keyup"]) {
      target.dispatchEvent(new KeyboardEvent(type, { key: "5", code: "Digit5", bubbles: true, cancelable: true }));
    }
  }

  function findRedliningPanel() {
    const labels = Array.from(document.querySelectorAll("body *"))
      .filter(visible)
      .filter((element) => ["redlining", "redlinings"].includes(normalizedText(directText(element) || element.getAttribute("aria-label"))));
    const candidates = [];
    for (const label of labels) {
      let current = label;
      for (let depth = 0; current && current !== document.body && depth < 10; depth += 1, current = current.parentElement) {
        const rect = current.getBoundingClientRect();
        if (rect.left < innerWidth * 0.25 && rect.width >= 180 && rect.width <= 700 && rect.height >= innerHeight * 0.35) {
          candidates.push({ element: current, area: rect.width * rect.height });
        }
      }
    }
    candidates.sort((a, b) => a.area - b.area);
    return candidates.length ? candidates[0].element : null;
  }

  function rememberInlineStyle(element) {
    return element ? { element, style: element.getAttribute("style") } : null;
  }

  function restoreInlineStyle(snapshot) {
    if (!snapshot || !snapshot.element || !snapshot.element.isConnected) return;
    if (snapshot.style === null) snapshot.element.removeAttribute("style");
    else snapshot.element.setAttribute("style", snapshot.style);
  }

  function installAutoFullscreenLayoutStyle() {
    let style = document.getElementById(AUTO_FULLSCREEN_STYLE_ID);
    if (style) return style;
    style = document.createElement("style");
    style.id = AUTO_FULLSCREEN_STYLE_ID;
    style.textContent = `
      /* eVIEW itself reserves 80px for pv-nav-bar via
         .ev-view-content { width: calc(100vw - 80px) }. During the automatic
         fullscreen scan that stale reservation must be removed as well as the
         left drawer itself, otherwise a white strip remains after page changes. */
      pv-nav-bar {
        display: none !important;
        width: 0 !important;
        min-width: 0 !important;
        max-width: 0 !important;
        flex: 0 0 0 !important;
      }
      #ev-page-view,
      .ev-view-content {
        width: 100vw !important;
        max-width: 100vw !important;
        min-width: 0 !important;
      }
      .ev-view-content {
        flex: 1 1 100vw !important;
      }
      .ev-main-content {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        flex: 1 1 auto !important;
        margin-left: 0 !important;
      }
      pv-left-side-bar,
      pv-left-side-bar > eplan-left-side-bar,
      eplan-left-side-bar {
        width: 0 !important;
        min-width: 0 !important;
        max-width: 0 !important;
        flex: 0 0 0 !important;
      }
      pv-left-side-bar .fl-left-side-container,
      .fl-left-side-container {
        width: 0 !important;
        min-width: 0 !important;
        max-width: 0 !important;
        margin-left: 0 !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        box-shadow: none !important;
      }
      pv-left-side-bar button[data-name="fl-lsb-show-btn"],
      pv-left-side-bar button[data-name="fl-lsb-hide-btn"] {
        display: none !important;
      }
      .cadview-container,
      #ev-viewer-cadview,
      #ev-viewer-canvas {
        max-width: 100% !important;
      }
    `;
    (document.head || document.documentElement).append(style);
    return style;
  }

  async function nativelyCollapseLeftSidebar() {
    const container = document.querySelector('pv-left-side-bar .fl-left-side-container, .fl-left-side-container');
    if (!container || container.classList.contains('fl-lsb-closed')) return true;
    const hideButton = document.querySelector('pv-left-side-bar button[data-name="fl-lsb-hide-btn"], button[data-name="fl-lsb-hide-btn"]');
    if (hideButton) {
      hideButton.click();
      const startedAt = performance.now();
      while (performance.now() - startedAt < 900) {
        await delay(60);
        const current = document.querySelector('pv-left-side-bar .fl-left-side-container, .fl-left-side-container');
        if (!current || current.classList.contains('fl-lsb-closed')) break;
      }
    }
    return true;
  }

  async function forceAutoFullscreenLayout() {
    if (!autoScanChromeState) {
      const root = document.documentElement;
      autoScanChromeState = {
        rootVars: {
          navSpacing: root.style.getPropertyValue("--fl-p-nav-bar-spacing"),
          lsbSpacing: root.style.getPropertyValue("--fl-p-lsb-spacing"),
          navWidth: root.style.getPropertyValue("--fl-w-nav-bar")
        }
      };
    }

    // eVIEW zuerst selbst einklappen lassen, damit Angulars Zustand korrekt bleibt.
    // Der CSS-Guard verhindert anschließend, dass ein neu gerenderter Seitenbaum
    // wieder Breite für Navigation/Sidebar reserviert.
    await nativelyCollapseLeftSidebar();
    installAutoFullscreenLayoutStyle();

    const root = document.documentElement;
    root.style.setProperty("--fl-p-nav-bar-spacing", "0px", "important");
    root.style.setProperty("--fl-p-lsb-spacing", "0px", "important");
    root.style.setProperty("--fl-w-nav-bar", "0px", "important");

    // Nur noch ein schneller Resize-Puls im Normalfall. Ein zweiter Puls folgt
    // gezielt in stabilizeAutoViewerAfterNavigation(), falls die Breite wirklich
    // noch nicht stimmt. Das spart pro Redlining mehrere hundert Millisekunden.
    window.dispatchEvent(new Event("resize"));
    await delay(autoTimingProfile.layoutDelay);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  async function stabilizeAutoViewerAfterNavigation() {
    await forceAutoFullscreenLayout();

    let rect = viewerRect();
    if (autoViewerBaselineWidth && rect && rect.width < autoViewerBaselineWidth * 0.975) {
      // Nur wenn Angular die alte Seitenbreite wirklich wiederhergestellt hat,
      // einen zweiten Layout-Zyklus ausführen.
      await delay(autoTimingProfile.layoutRetryDelay);
      await forceAutoFullscreenLayout();
      rect = viewerRect();
    }

    const fitControl = document.querySelector("#ev-viewmenu-zoomall") || findFitViewControl(null);
    await resetViewImmediatelyBeforeCapture(fitControl, {
      attempts: autoTimingProfile.fitAttempts,
      delayMs: autoTimingProfile.fitDelay,
      postDelayMs: autoTimingProfile.postFitDelay
    });
    window.dispatchEvent(new Event("resize"));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    autoPreparedPageKey = pageKey();
    autoPreparedAt = performance.now();
  }

  async function restoreAutoScanChrome() {
    const state = autoScanChromeState;
    autoScanChromeState = null;
    autoViewerBaselineWidth = 0;
    const style = document.getElementById(AUTO_FULLSCREEN_STYLE_ID);
    if (style) style.remove();
    if (!state) return;
    const root = document.documentElement;
    const restoreVar = (name, value) => {
      if (value) root.style.setProperty(name, value);
      else root.style.removeProperty(name);
    };
    restoreVar("--fl-p-nav-bar-spacing", state.rootVars && state.rootVars.navSpacing);
    restoreVar("--fl-p-lsb-spacing", state.rootVars && state.rootVars.lsbSpacing);
    restoreVar("--fl-w-nav-bar", state.rootVars && state.rootVars.navWidth);
    window.dispatchEvent(new Event("resize"));
    await delay(280);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  function captureSidebarElement(panel) {
    if (!panel) return null;
    return panel.closest(
      ".fl-left-side-container, [class*='left-side-container' i], eplan-left-side-bar, pv-left-side-bar"
    ) || panel;
  }

  function findFitViewControl(panel) {
    // Exakter eVIEW-DOM aus dem aktuellen Build: der 100%-/Einpassen-Knopf
    // besitzt eine stabile ID. Diesen immer zuerst verwenden.
    const exact = document.querySelector("#ev-viewmenu-zoomall");
    if (exact && visible(exact) && (!panel || !panel.contains(exact))) return exact;

    const controls = Array.from(document.querySelectorAll("button, a, [role='button'], [title], [aria-label], [data-name], [data-testid]"));
    const usable = controls.filter((element) => {
      if (!visible(element) || (panel && panel.contains(element))) return false;
      if (element.disabled || element.getAttribute("aria-disabled") === "true" || /fl-disabled/i.test(elementClass(element))) return false;
      return true;
    });
    const semanticMatch = usable.find((element) => {
      const signature = [
        directText(element),
        element.getAttribute("aria-label"),
        element.getAttribute("title"),
        element.getAttribute("data-name"),
        element.getAttribute("data-testid"),
        elementClass(element),
        element.outerHTML.slice(0, 5000)
      ].filter(Boolean).join(" ");
      return /(fit.?to.?(view|page|screen)|zoom.?(fit|all|page)|page.?fit|ansicht.?einpassen|seite.?einpassen|alles.?anzeigen|gesamte.?seite)/i.test(signature);
    });
    if (semanticMatch) return semanticMatch;

    // eVIEW beschriftet die Symbolknöpfe in manchen Builds nicht. Rechts in der
    // horizontalen Viewer-Leiste stehen immer: Zoom -, Einpassen, Zoom +, Vollbild.
    const drawing = drawingBounds(panel);
    if (drawing.fallback || drawing.y <= 0) return null;
    const toolbarButtons = usable
      .filter((element) => /ev-icon-btn/i.test(elementClass(element)))
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.top < drawing.y && drawing.y - rect.bottom >= -12 && drawing.y - rect.bottom <= 110)
      .sort((a, b) => a.rect.left - b.rect.left);
    const rows = [];
    for (const item of toolbarButtons) {
      let row = rows.find((candidate) => Math.abs(candidate.centerY - (item.rect.top + item.rect.height / 2)) < 6);
      if (!row) {
        row = { centerY: item.rect.top + item.rect.height / 2, items: [] };
        rows.push(row);
      }
      row.items.push(item);
    }
    const clusters = [];
    for (const row of rows) {
      let cluster = [];
      for (const item of row.items) {
        const previous = cluster[cluster.length - 1];
        if (previous && item.rect.left - previous.rect.right > 90) {
          if (cluster.length >= 4) clusters.push(cluster);
          cluster = [];
        }
        cluster.push(item);
      }
      if (cluster.length >= 4) clusters.push(cluster);
    }
    clusters.sort((a, b) => b[b.length - 1].rect.right - a[a.length - 1].rect.right);
    const rightToolbar = clusters[0];
    return rightToolbar ? rightToolbar[rightToolbar.length - 3].element : null;
  }

  function viewerToolbarCandidates(panel) {
    const drawing = drawingBounds(panel);
    if (drawing.fallback || drawing.y <= 0) return [];

    // In eVIEW liegt der Vollbild-Knopf in derselben horizontalen Symbolleiste
    // wie Zoom/Einpassen, direkt oberhalb der Zeichnung. Wir suchen daher nicht
    // nur nach aria-labels, sondern erfassen die real sichtbaren Icon-Buttons in
    // genau diesem Bereich. Das ist robuster, weil der Vollbild-Button je nach
    // eVIEW-Build keine brauchbare Beschriftung besitzt.
    const selectors = [
      "button", "a", "[role='button']", "[tabindex]",
      "[class*='icon-btn' i]", "[class*='toolbar' i] button", "[class*='toolbar' i] [role='button']"
    ].join(",");

    const seen = new Set();
    const candidates = [];
    for (const element of document.querySelectorAll(selectors)) {
      if (seen.has(element) || !visible(element)) continue;
      seen.add(element);
      if (element.disabled || element.getAttribute("aria-disabled") === "true" || /fl-disabled/i.test(elementClass(element))) continue;
      if (panel && panel.contains(element)) continue;

      const rect = element.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const centerX = rect.left + rect.width / 2;
      const aboveDrawing = centerY >= drawing.y - 115 && centerY <= drawing.y + 18;
      const nearDrawingWidth = centerX >= Math.max(0, drawing.x - 30) && centerX <= Math.min(innerWidth, drawing.x + drawing.width + 30);
      const buttonLikeSize = rect.width >= 18 && rect.width <= 86 && rect.height >= 18 && rect.height <= 86;
      if (!aboveDrawing || !nearDrawingWidth || !buttonLikeSize) continue;

      const signature = [
        directText(element),
        element.getAttribute("aria-label"),
        element.getAttribute("title"),
        element.getAttribute("data-name"),
        element.getAttribute("data-testid"),
        elementClass(element),
        element.innerHTML.slice(0, 3000)
      ].filter(Boolean).join(" ");
      const iconLike = /ev-icon-btn|icon|svg|path|toolbar/i.test(signature) || element.querySelector("svg, img, i");
      if (!iconLike) continue;
      candidates.push({ element, rect, signature, drawing });
    }
    return candidates;
  }

  function findFullscreenControl(panel, fitControl) {
    // Exakter Selektor aus dem vom Benutzer exportierten eVIEW-DOM.
    // Das ist der echte Viewer-Vollbildknopf (Beschriftung: "Vollbild (F)").
    const exact = document.querySelector('eplan-icon-button[data-t="ev-btn-full-screen"]')
      || document.querySelector('.ev-fullscreen-control[data-t="ev-btn-full-screen"]')
      || document.querySelector('.ev-fullscreen-control');
    if (exact && visible(exact) && (!panel || !panel.contains(exact))) return exact;

    const candidates = viewerToolbarCandidates(panel);

    // 1) Fallback für andere eVIEW-Builds: rechter äußerer Viewer-Button.
    //    Icon-Button der Viewer-Leiste. Dieser Positions-Fallback hat Vorrang,
    //    weil eVIEW den Button in manchen Versionen nicht semantisch beschriftet.
    const sameRow = candidates
      .filter(({ rect }) => {
        if (!fitControl || !fitControl.isConnected) return true;
        const fitRect = fitControl.getBoundingClientRect();
        return Math.abs((rect.top + rect.height / 2) - (fitRect.top + fitRect.height / 2)) < 12;
      })
      .sort((a, b) => b.rect.right - a.rect.right);
    if (sameRow.length) {
      const rightmost = sameRow[0];
      // Nur einen Button wählen, der deutlich in der rechten Hälfte des Viewers
      // sitzt. So vermeiden wir den linken Drawer-/Navigationspfeil.
      if (rightmost.rect.left > rightmost.drawing.x + rightmost.drawing.width * 0.55) return rightmost.element;
    }

    // 2) Falls die Position nicht eindeutig ist, nach Beschriftung/Icon-Signatur.
    const semanticMatch = candidates.find(({ signature }) =>
      /(full.?screen|fullscreen|vollbild|maximi[sz]e.?view|expand.?view|open.?in.?full|arrows?.?(out|expand)|diagonal.?arrow)/i.test(signature));
    if (semanticMatch) return semanticMatch.element;

    // 3) Klassischer Fallback: rechts vom Einpassen-Knopf den äußersten Button.
    if (fitControl && fitControl.isConnected) {
      const fitRect = fitControl.getBoundingClientRect();
      const toTheRight = candidates
        .filter(({ rect }) => rect.left > fitRect.right - 2
          && Math.abs((rect.top + rect.height / 2) - (fitRect.top + fitRect.height / 2)) < 12)
        .sort((a, b) => b.rect.right - a.rect.right);
      if (toTheRight.length) return toTheRight[0].element;
    }
    return null;
  }

  function clickViewerControl(control) {
    if (!control || !control.isConnected) return false;
    try {
      control.scrollIntoView({ block: "nearest", inline: "nearest" });
    } catch (_) {}
    control.click();
    return true;
  }

  function fireShortcutF() {
    const target = document.activeElement && !/^(input|textarea|select)$/i.test(document.activeElement.tagName)
      ? document.activeElement : document.body;
    for (const type of ["keydown", "keyup"]) {
      target.dispatchEvent(new KeyboardEvent(type, { key: "f", code: "KeyF", bubbles: true, cancelable: true }));
    }
  }

  async function toggleFullscreen(control) {
    if (!clickViewerControl(control)) fireShortcutF();
    await delay(520);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  async function enterFullscreenForCapture(panel, fitControl, options = {}) {
    // Während eines automatischen Suchlaufs halten wir eVIEW bewusst im
    // Viewer-Vollbild. Einzelne Screenshots dürfen den Modus dann NICHT wieder
    // aus- und einschalten. Genau das war in 0.4.1 noch eine Fehlerquelle.
    if (autoViewerFullscreenActive && !options.forceToggle) {
      return { active: true, changed: false, restore: async () => {} };
    }

    const control = findFullscreenControl(panel, fitControl);
    if (!control) {
      showExtensionStatus("Der eVIEW-Vollbildknopf wurde nicht gefunden.", "error");
      return { active: false, changed: false, restore: async () => {} };
    }

    const before = drawingBounds(panel);
    const beforeArea = before.width * before.height;

    // Direkter Klick auf den exakten eVIEW-Host:
    // eplan-icon-button[data-t="ev-btn-full-screen"]
    await toggleFullscreen(control);
    await delay(350);

    const after = drawingBounds(findRedliningPanel() || panel);
    const afterArea = after.width * after.height;

    // eVIEW-Vollbild ist ein eigener Viewer-Modus und nicht zwingend die
    // Browser-Fullscreen-API. Deshalb ist document.fullscreenElement hier kein
    // verlässlicher Indikator. Wir merken uns stattdessen den von uns ausgelösten
    // Zustand und prüfen zusätzlich, ob sich die Viewer-Fläche plausibel verändert.
    const areaChanged = beforeArea <= 0 || afterArea >= beforeArea * 1.01;

    if (options.holdForAutoScan) {
      autoViewerFullscreenActive = true;
      autoViewerFullscreenControl = control;
    }

    if (!areaChanged) {
      // Kein zweiter Klick: Bei eVIEW kann der DOM-Reflow zeitversetzt erfolgen.
      // Ein automatischer Gegenklick würde den gerade aktivierten Vollbildmodus
      // sonst sofort wieder verlassen.
      await delay(500);
    }

    return {
      active: true,
      changed: true,
      restore: async () => {
        if (options.holdForAutoScan) return;
        if (control && control.isConnected) await toggleFullscreen(control);
      }
    };
  }

  async function leaveAutoViewerFullscreen() {
    if (!autoViewerFullscreenActive) return;
    const control = (autoViewerFullscreenControl && autoViewerFullscreenControl.isConnected)
      ? autoViewerFullscreenControl
      : findFullscreenControl(findRedliningPanel(), findFitViewControl(findRedliningPanel()));
    autoViewerFullscreenActive = false;
    autoViewerFullscreenControl = null;
    if (control) {
      await toggleFullscreen(control);
      await delay(220);
    }
  }

  function suppressZoomIndicator() {
    const candidates = Array.from(document.querySelectorAll("body *"))
      .filter(visible)
      .filter((element) => /^100\s*%$/.test(directText(element)))
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => {
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        return rect.width <= 320 && rect.height <= 180
          && centerX > innerWidth * 0.25 && centerX < innerWidth * 0.75
          && centerY > innerHeight * 0.2 && centerY < innerHeight * 0.8;
      });
    for (const candidate of candidates) {
      let overlay = candidate.element;
      for (let depth = 0; overlay.parentElement && depth < 3; depth += 1) {
        const parentRect = overlay.parentElement.getBoundingClientRect();
        if (parentRect.width > 340 || parentRect.height > 200) break;
        overlay = overlay.parentElement;
      }
      // Das ist nur die kurz eingeblendete eVIEW-Zoomanzeige. Sie darf dauerhaft
      // unsichtbar bleiben, falls eVIEW dasselbe Element beim nächsten Zoom wiederverwendet.
      overlay.style.setProperty("visibility", "hidden", "important");
      overlay.style.setProperty("opacity", "0", "important");
      overlay.setAttribute("data-eview-print-hidden-zoom-indicator", "true");
    }
    return candidates.length > 0;
  }

  async function resetViewImmediatelyBeforeCapture(fitControl, options = {}) {
    if (!fitControl) return;
    const attempts = Number.isFinite(options.attempts) ? Math.max(1, options.attempts) : 3;
    const delayMs = Number.isFinite(options.delayMs) ? Math.max(40, options.delayMs) : 220;
    const postDelayMs = Number.isFinite(options.postDelayMs) ? Math.max(20, options.postDelayMs) : 100;
    // Im automatischen Lauf werden die Impulse je nach Verbindungstempo reduziert.
    // Langsam/instabil behält mehrere Impulse, Schnell/Normal vermeidet unnötige
    // Wartezeit. Manuelle Einzelaufnahmen nutzen weiterhin die bewährten 3 Impulse.
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      fitControl.click();
      await delay(delayMs);
      suppressZoomIndicator();
    }
    await delay(postDelayMs);
    suppressZoomIndicator();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  async function prepareCleanCapture(panel) {
    const pageRef = selectedPageLabel();
    const statusOverlay = document.getElementById(STATUS_OVERLAY_ID);
    const previousOverlayStyle = statusOverlay ? statusOverlay.getAttribute("style") : null;
    if (statusOverlay) statusOverlay.style.setProperty("display", "none", "important");
    const initialFitControl = findFitViewControl(panel);
    const fullscreen = await enterFullscreenForCapture(panel, initialFitControl);
    // Im automatischen Lauf bleibt der Drawer für die gesamte Serie transparent.
    // Deshalb nicht mehr pro Screenshot öffnen/schließen.
    const captureElement = autoViewerFullscreenActive ? null : captureSidebarElement(panel);
    const previousStyle = captureElement ? captureElement.getAttribute("style") : null;
    if (captureElement) {
      captureElement.style.setProperty("display", "none", "important");
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const fitControl = findFitViewControl(panel) || (initialFitControl && initialFitControl.isConnected ? initialFitControl : null);
    const alreadyPrepared = autoViewerFullscreenActive
      && autoPreparedPageKey === pageKey()
      && performance.now() - autoPreparedAt < Math.max(1800, autoTimingProfile.pageLoadTimeout * 0.35);
    if (!alreadyPrepared) {
      await resetViewImmediatelyBeforeCapture(fitControl, autoViewerFullscreenActive ? {
        attempts: autoTimingProfile.fitAttempts,
        delayMs: autoTimingProfile.fitDelay,
        postDelayMs: autoTimingProfile.postFitDelay
      } : {});
      if (!fitControl) await delay(autoViewerFullscreenActive ? autoTimingProfile.postFitDelay : 220);
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    return {
      context: pageContext(captureElement, pageRef),
      async restore() {
        if (captureElement) {
          if (previousStyle === null) captureElement.removeAttribute("style");
          else captureElement.setAttribute("style", previousStyle);
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        }
        await fullscreen.restore();
        if (statusOverlay) {
          if (previousOverlayStyle === null) statusOverlay.removeAttribute("style");
          else statusOverlay.setAttribute("style", previousOverlayStyle);
        }
      }
    };
  }

  async function sendCleanCapture(type, panel, entry) {
    const prepared = await prepareCleanCapture(panel);
    try {
      return await chrome.runtime.sendMessage({ type, context: prepared.context, entry });
    } finally {
      await prepared.restore();
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }

  function redliningRowLooksSelected(rowId, fallbackElement) {
    const row = rowId ? document.getElementById(rowId) : fallbackElement;
    if (!row || !row.isConnected) return false;
    const className = elementClass(row);
    if (row.getAttribute("aria-selected") === "true" || row.getAttribute("aria-current") === "true") return true;
    if (/(selected|active|current|highlight)/i.test(className)) return true;
    const selectedChild = row.querySelector('[aria-selected="true"], [aria-current="true"], [class*="selected" i], [class*="active" i]');
    return Boolean(selectedChild);
  }

  function viewerHasVisibleLoader() {
    const viewer = document.querySelector('#ev-page-view, #ev-viewer-cadview, #ev-viewer-canvas, .cadview-container');
    if (!viewer) return false;
    const loaders = viewer.querySelectorAll(
      '[aria-busy="true"], .fl-spinner, [class*="spinner" i], [class*="loading" i], [class*="loader" i]'
    );
    return Array.from(loaders).some((element) => {
      if (!visible(element)) return false;
      const rect = element.getBoundingClientRect();
      return rect.width >= 8 && rect.height >= 8;
    });
  }

  function viewerDrawingLooksReady() {
    const viewer = document.querySelector('#ev-viewer-cadview, #ev-viewer-canvas, .cadview-container, #ev-page-view');
    if (!viewer) return false;
    const rect = viewer.getBoundingClientRect();
    if (rect.width < 220 || rect.height < 180) return false;
    if (viewerHasVisibleLoader()) return false;
    const drawing = document.querySelector('#svgRoot, #ev-viewer-cadview svg, #ev-viewer-canvas svg, #ev-viewer-cadview canvas, #ev-viewer-canvas canvas, .cadview-container svg, .cadview-container canvas');
    if (!drawing) return false;
    const drawingRect = drawing.getBoundingClientRect();
    return drawingRect.width > 120 && drawingRect.height > 100;
  }

  function viewerStateSnapshot() {
    return {
      pageKey: pageKey(),
      svgRoot: document.querySelector('#svgRoot'),
      viewer: document.querySelector('#ev-viewer-cadview, #ev-viewer-canvas, .cadview-container')
    };
  }

  async function waitForPageAfterClick(previousPageKey, options = {}) {
    const profile = options.profile || autoTimingProfile;
    const rowId = options.rowId || "";
    const fallbackElement = options.element || null;
    const beforeState = options.beforeState || viewerStateSnapshot();
    const startedAt = performance.now();
    let readySamples = 0;
    let changedAt = null;
    let lastKey = previousPageKey;

    while (performance.now() - startedAt < profile.pageLoadTimeout) {
      await delay(profile.poll);
      const elapsed = performance.now() - startedAt;
      const currentKey = pageKey();
      const pageChanged = currentKey !== previousPageKey;
      if (pageChanged && changedAt === null) changedAt = performance.now();
      lastKey = currentKey;

      const selected = redliningRowLooksSelected(rowId, fallbackElement);
      const drawingReady = viewerDrawingLooksReady();
      const currentSvgRoot = document.querySelector('#svgRoot');
      const rootChanged = Boolean(beforeState && beforeState.svgRoot && currentSvgRoot && currentSvgRoot !== beforeState.svgRoot);

      // Gleiche Zeichnungsseite: Sobald das angeklickte Redlining aktiv ist und
      // der Viewer bereit ist, nicht mehr stumpf 1,2 s warten.
      const samePageReady = !pageChanged
        && elapsed >= profile.samePageGrace
        && drawingReady
        && (selected || elapsed >= profile.samePageGrace * 1.6);

      // Neue Zeichnungsseite: eVIEW ändert die Route häufig vor dem eigentlichen
      // SVG. Daher erst nach einem kurzen Mindestfenster bzw. nach neuem #svgRoot
      // als geladen akzeptieren.
      const changedPageReady = pageChanged
        && drawingReady
        && (rootChanged || (changedAt !== null && performance.now() - changedAt >= profile.changedMinDelay));

      if (samePageReady || changedPageReady) readySamples += 1;
      else readySamples = 0;

      if (readySamples >= 2) {
        return { ready: true, pageChanged, pageKey: currentKey, elapsed };
      }
    }

    return {
      ready: false,
      pageChanged: lastKey !== previousPageKey,
      pageKey: lastKey,
      elapsed: performance.now() - startedAt
    };
  }

  async function clickRedliningAndWait(target, rowId, previousPageKey) {
    let currentTarget = target;
    for (let attempt = 0; attempt <= autoTimingProfile.retryCount; attempt += 1) {
      if (!currentTarget || !currentTarget.isConnected) {
        currentTarget = rowId ? document.getElementById(rowId) : null;
      }
      if (!currentTarget || !currentTarget.isConnected) {
        return { ready: false, pageChanged: false, pageKey: pageKey(), missingTarget: true };
      }
      const beforeState = viewerStateSnapshot();
      currentTarget.click();
      const result = await waitForPageAfterClick(previousPageKey, {
        rowId,
        element: currentTarget,
        beforeState,
        profile: autoTimingProfile
      });
      if (result.ready) return result;
      if (attempt < autoTimingProfile.retryCount) {
        showExtensionStatus(
          `Seite lädt langsam – Redlining wird erneut geöffnet (${attempt + 2}/${autoTimingProfile.retryCount + 1}) …`,
          "running"
        );
        await delay(autoTimingProfile.retryDelay);
        currentTarget = rowId ? document.getElementById(rowId) : currentTarget;
      }
    }
    return { ready: false, pageChanged: pageKey() !== previousPageKey, pageKey: pageKey() };
  }

  function findSidebarToggleControl() {
    const candidates = Array.from(document.querySelectorAll("button, a, [role='button'], [data-name], [title], [aria-label]"))
      .filter(visible)
      .filter((element) => !element.disabled && element.getAttribute("aria-disabled") !== "true")
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const signature = [
          directText(element),
          element.getAttribute("aria-label"),
          element.getAttribute("title"),
          element.getAttribute("data-name"),
          element.getAttribute("data-testid"),
          elementClass(element),
          element.outerHTML.slice(0, 2500)
        ].filter(Boolean).join(" ");
        return { element, rect, signature };
      })
      .filter(({ rect }) => rect.width >= 14 && rect.height >= 14 && rect.left < innerWidth * 0.25 && rect.top < innerHeight * 0.28);

    const semantic = candidates.find(({ signature }) => /(sidebar|side.?bar|panel|drawer|navigation|navigator|menu|liste|list|outline|explorer|toggle)/i.test(signature));
    if (semantic) return semantic.element;

    const iconButtons = candidates
      .filter(({ signature }) => /(arrow|chevron|caret|hamburger|menu|double.?arrow|expand|collapse|left|right)/i.test(signature)
        || /ev-icon-btn/i.test(signature))
      .sort((a, b) => (a.rect.left + a.rect.top) - (b.rect.left + b.rect.top));
    return iconButtons.length ? iconButtons[0].element : null;
  }

  function findRedliningControl() {
    const controls = Array.from(document.querySelectorAll("button, a, [role='button'], [data-name], [title], [aria-label]"));
    return controls.find((element) => {
      const signature = [directText(element), element.getAttribute("aria-label"), element.getAttribute("title"), element.getAttribute("data-name")]
        .filter(Boolean).join(" ");
      return /redlinings?/i.test(signature);
    }) || null;
  }

  async function openRedliningPanel() {
    let panel = findRedliningPanel();
    if (panel) return panel;

    let control = findRedliningControl();
    if (!control) {
      const sidebarToggle = findSidebarToggleControl();
      if (sidebarToggle) {
        sidebarToggle.click();
        await delay(320);
        control = findRedliningControl();
      }
    }
    if (control) control.click();
    else fireShortcutFive();
    await delay(950);
    panel = findRedliningPanel();
    if (!panel) throw new Error("Der Redlining-Bereich konnte nicht automatisch geöffnet werden. Öffne ihn links einmal manuell und starte erneut.");
    return panel;
  }

  async function prepareViewerForAutoCapture() {
    // Nach dem bestätigten Benutzer-Klick NICHT mehr die linke Liste öffnen.
    // Genau dieses erneute openRedliningPanel() ließ sie in 0.4.3/0.4.4
    // während des Scans immer wieder aufpoppen.
    let panel = autoScanPanelReference && autoScanPanelReference.isConnected
      ? autoScanPanelReference
      : findRedliningPanel();
    showExtensionStatus("eVIEW-Vollbild wird stabilisiert …", "running");
    const initialFitControl = findFitViewControl(panel);
    const fullscreen = await enterFullscreenForCapture(panel, initialFitControl, { holdForAutoScan: true });
    if (!fullscreen.active) throw new Error("eVIEW konnte nicht in den Vollbildmodus geschaltet werden.");

    // Let eVIEW enter its native viewer fullscreen first. Afterwards remove the
    // fixed 80px nav reservation and collapse the left drawer in eVIEW's own
    // state. This layout guard stays installed for the whole scan, including
    // Angular page rebuilds caused by clicking the next Redlining.
    await waitForNativeFullscreenSettled(null);
    await forceAutoFullscreenLayout();
    const firstRect = viewerRect();
    autoViewerBaselineWidth = firstRect && firstRect.width || 0;
    await stabilizeAutoViewerAfterNavigation();
    const settledRect = viewerRect();
    if (settledRect && settledRect.width > autoViewerBaselineWidth) autoViewerBaselineWidth = settledRect.width;

    return {
      panel,
      async restore() {
        autoScanPanelReference = null;
        pendingTrustedSnapshot = null;
        await restoreAutoScanChrome();
        await leaveAutoViewerFullscreen();
      }
    };
  }

  function statusLabels(panel) {
    const result = [];
    for (const element of panel.querySelectorAll("*")) {
      if (!visible(element)) continue;
      const text = normalizedText(directText(element));
      const status = core.normalizeStatus(text);
      if (status && !result.some((item) => item.status === status)) result.push({ text, status, element });
    }
    return result;
  }

  function statusContainer(label, panel) {
    const exact = label.element.closest(".ev-ann-status, [class*='ann-status' i]");
    if (exact && panel.contains(exact)) return exact;
    let current = label.element.parentElement;
    while (current && current !== panel) {
      if (current.querySelector(".ev-annotation-list-item, [class*='annotation-list-item' i]")) return current;
      current = current.parentElement;
    }
    return label.element.parentElement || label.element;
  }

  function statusForEntry(element, panel) {
    const container = element.closest(".ev-ann-status, [class*='ann-status' i]");
    if (container && panel.contains(container)) {
      for (const candidate of container.querySelectorAll("*")) {
        const status = core.normalizeStatus(normalizedText(directText(candidate)));
        if (status) return status;
      }
    }
    let selected = null;
    for (const label of statusLabels(panel)) {
      if (label.element.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) selected = label.status;
    }
    return selected;
  }

  function scrollContainer(panel) {
    const candidates = [panel].concat(Array.from(panel.querySelectorAll("*")))
      .filter((element) => visible(element) && element.scrollHeight > element.clientHeight + 40)
      .sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight));
    return candidates[0] || panel;
  }

  // Diese Funktion bleibt bewusst deckungsgleich mit der funktionierenden
  // Zeilenerkennung aus Version 0.2.1. Insbesondere wird das klickbare
  // Kind-/Elternelement ermittelt und nicht pauschal die äußere Listenzeile benutzt.
  function entryElements(panel, scroller, activeStatus) {
    const panelRect = panel.getBoundingClientRect();
    const activeLabel = activeStatus
      ? statusLabels(panel).find((item) => item.status === activeStatus)
      : null;
    const activeGroup = activeLabel ? statusContainer(activeLabel, panel) : null;
    if (activeStatus && !activeGroup) return [];
    const rows = [];
    for (const element of panel.querySelectorAll("*")) {
      // Nur Elemente aus dem ausdrücklich ausgewählten Statusblock zulassen.
      // Das tatsächliche clickTarget wird danach weiterhin wie in Version 0.2.1 ermittelt.
      if (activeGroup && !activeGroup.contains(element)) continue;
      if (!visible(element)) continue;
      const text = directText(element);
      const normalized = normalizedText(text);
      if (!text || text.length < 2 || text.length > 240 || NON_ENTRY_TEXT.has(normalized)) continue;
      const rect = element.getBoundingClientRect();
      if (rect.height < 12 || rect.height > 90 || rect.width < 40 || rect.left > panelRect.right || rect.right < panelRect.left) continue;
      if (/^(\d+|\W+)$/.test(text)) continue;

      let identity = "";
      let clickTarget = null;
      let current = element;
      for (let depth = 0; current && current !== panel && depth < 5; depth += 1, current = current.parentElement) {
        const values = Object.entries(current.dataset || {}).map(([key, value]) => `${key}=${value}`).join(";");
        if (current.id || values) {
          identity = `${current.id || ""}|${values}`;
        }
        const role = current.getAttribute("role") || "";
        const className = String(current.className && current.className.baseVal || current.className || "");
        const interactive = /^(button|a)$/i.test(current.tagName)
          || /^(button|option|listitem|treeitem)$/i.test(role)
          || current.hasAttribute("tabindex")
          || current.hasAttribute("data-name")
          || current.hasAttribute("data-testid")
          || getComputedStyle(current).cursor === "pointer"
          || /(redlining|list.?item|entry|row|tree.?node)/i.test(className);
        if (!clickTarget && interactive) clickTarget = current;
      }
      if (!clickTarget) continue;
      const position = Math.round((scroller.scrollTop || 0) + rect.top - panelRect.top);
      rows.push({ element: clickTarget, text, key: `${identity}|${normalized}|${position}` });
    }
    return rows;
  }

  async function reportProgress(message, processed, uniquePages) {
    showExtensionStatus(`${message} · ${uniquePages} Seite(n)`, "running");
    await chrome.runtime.sendMessage({
      type: "AUTO_PROGRESS",
      progress: { message, processed, uniquePages, updatedAt: new Date().toISOString() }
    }).catch(() => {});
  }

  async function captureVisibleEntries(panel, processedEntries, capturedPageKeys, candidatePageKeys, assignmentFilter, excludedEntries, failedEntries, activeStatus) {
    const scroller = scrollContainer(panel);
    const originalScroll = scroller.scrollTop;
    scroller.scrollTop = 0;
    await delay(180);
    let previousTop = -1;
    let safety = 0;

    while (safety < 100 && scroller.scrollTop !== previousTop) {
      previousTop = scroller.scrollTop;
      const entries = entryElements(panel, scroller, activeStatus);
      for (const entry of entries) {
        if (processedEntries.has(entry.key)) continue;
        processedEntries.add(entry.key);
        const previousPageKey = pageKey();
        const navigation = await clickRedliningAndWait(entry.element, "", previousPageKey);
        if (!navigation.ready) {
          failedEntries.push({ title: entry.text, status: activeStatus, pageKey: navigation.pageKey || previousPageKey });
          await reportProgress(`Redlining ${processedEntries.size} nicht geladen`, processedEntries.size, capturedPageKeys.size);
          continue;
        }
        if (autoViewerFullscreenActive) await stabilizeAutoViewerAfterNavigation();
        const context = pageContext();
        const assignment = core.matchAssignment(entry.text, assignmentFilter);
        const entryInfo = { title: entry.text, status: activeStatus, reason: assignment.reason };
        if (/\/projects\/[^/]+\/pages\/[^/?#]+/i.test(context.pageKey)) {
          if (assignment.matched) {
            const response = capturedPageKeys.has(context.pageKey) || candidatePageKeys.has(context.pageKey)
              ? await chrome.runtime.sendMessage({ type: "CAPTURE_FROM_CONTENT", context, entry: entryInfo })
              : await sendCleanCapture("CAPTURE_FROM_CONTENT", panel, entryInfo);
            if (response && response.ok) capturedPageKeys.add(context.pageKey);
          } else {
            const response = capturedPageKeys.has(context.pageKey) || candidatePageKeys.has(context.pageKey)
              ? await chrome.runtime.sendMessage({ type: "CAPTURE_CANDIDATE", context, entry: entryInfo })
              : await sendCleanCapture("CAPTURE_CANDIDATE", panel, entryInfo);
            if (response && response.ok && !response.alreadyIncluded) {
              candidatePageKeys.add(context.pageKey);
              excludedEntries.push({ ...entryInfo, pageKey: context.pageKey, candidateId: response.candidate && response.candidate.id });
            }
          }
        }
        await reportProgress(`Redlining ${processedEntries.size} geprüft`, processedEntries.size, capturedPageKeys.size);
      }
      if (scroller.scrollHeight <= scroller.clientHeight + 40) break;
      scroller.scrollTop = Math.min(scroller.scrollHeight - scroller.clientHeight, scroller.scrollTop + Math.max(160, scroller.clientHeight * 0.72));
      await delay(220);
      safety += 1;
    }
    scroller.scrollTop = originalScroll;
  }

  async function captureSnapshotEntries(entries, processedEntries, capturedPageKeys, candidatePageKeys, assignmentFilter, excludedEntries, failedEntries) {
    for (const snapshot of entries || []) {
      if (processedEntries.has(snapshot.key)) continue;
      processedEntries.add(snapshot.key);
      const target = snapshot.rowId ? document.getElementById(snapshot.rowId) : snapshot.element;
      if (!target || !target.isConnected) continue;
      const previousPageKey = pageKey();
      const navigation = await clickRedliningAndWait(target, snapshot.rowId || "", previousPageKey);
      if (!navigation.ready) {
        failedEntries.push({ title: snapshot.text, status: snapshot.status, pageKey: navigation.pageKey || previousPageKey });
        await reportProgress(`Redlining ${processedEntries.size} nicht geladen`, processedEntries.size, capturedPageKeys.size);
        continue;
      }
      // Selecting a Redlining can rebuild the viewer subtree. Re-assert the true
      // fullscreen layout only after the viewer reports that its drawing is ready.
      await stabilizeAutoViewerAfterNavigation();
      const context = pageContext(null);
      const assignment = core.matchAssignment(snapshot.text, assignmentFilter);
      const entryInfo = { title: snapshot.text, status: snapshot.status, reason: assignment.reason };
      if (/\/projects\/[^/]+\/pages\/[^/?#]+/i.test(context.pageKey)) {
        if (assignment.matched) {
          const response = capturedPageKeys.has(context.pageKey) || candidatePageKeys.has(context.pageKey)
            ? await chrome.runtime.sendMessage({ type: "CAPTURE_FROM_CONTENT", context, entry: entryInfo })
            : await sendCleanCapture("CAPTURE_FROM_CONTENT", null, entryInfo);
          if (response && response.ok) capturedPageKeys.add(context.pageKey);
        } else {
          const response = capturedPageKeys.has(context.pageKey) || candidatePageKeys.has(context.pageKey)
            ? await chrome.runtime.sendMessage({ type: "CAPTURE_CANDIDATE", context, entry: entryInfo })
            : await sendCleanCapture("CAPTURE_CANDIDATE", null, entryInfo);
          if (response && response.ok && !response.alreadyIncluded) {
            candidatePageKeys.add(context.pageKey);
            excludedEntries.push({ ...entryInfo, pageKey: context.pageKey, candidateId: response.candidate && response.candidate.id });
          }
        }
      }
      await reportProgress(`Redlining ${processedEntries.size} geprüft`, processedEntries.size, capturedPageKeys.size);
    }
  }

  async function locateStatusGroup(panel, groupName) {
    const scroller = scrollContainer(panel);
    scroller.scrollTop = 0;
    await delay(120);
    let previousTop = -1;
    let safety = 0;
    while (safety < 100 && scroller.scrollTop !== previousTop) {
      previousTop = scroller.scrollTop;
      const group = statusLabels(panel).find((item) => item.status === groupName);
      if (group) return group;
      if (scroller.scrollHeight <= scroller.clientHeight + 40) break;
      scroller.scrollTop = Math.min(scroller.scrollHeight - scroller.clientHeight, scroller.scrollTop + Math.max(160, scroller.clientHeight * 0.72));
      await delay(160);
      safety += 1;
    }
    return null;
  }

  function expandStatusGroup(group, panel) {
    const container = statusContainer(group, panel);
    const clickable = group.element.closest("button, [role='button'], [aria-expanded]")
      || container.querySelector(".ev-collapsible-head, [class*='collapsible-head' i]")
      || group.element.parentElement
      || group.element;
    const expandedAttribute = clickable.getAttribute("aria-expanded");
    const hasVisibleEntries = Array.from(container.querySelectorAll(".ev-annotation-list-item, [class*='annotation-list-item' i]"))
      .some(visible);
    if (expandedAttribute === "false" || (expandedAttribute !== "true" && !hasVisibleEntries)) clickable.click();
  }

  async function autoCaptureAll(rawFilters) {
    const filters = {
      statuses: Array.isArray(rawFilters && rawFilters.statuses) && rawFilters.statuses.length
        ? rawFilters.statuses : DEFAULT_FILTERS.statuses,
      assignment: Object.assign({}, DEFAULT_FILTERS.assignment, rawFilters && rawFilters.assignment || {}),
      timingMode: ["fast", "normal", "slow"].includes(rawFilters && rawFilters.timingMode)
        ? rawFilters.timingMode : "normal"
    };
    autoTimingProfile = TIMING_PROFILES[filters.timingMode] || TIMING_PROFILES.normal;
    autoPreparedPageKey = null;
    autoPreparedAt = 0;
    const viewerSession = await prepareViewerForAutoCapture();
    let panel = viewerSession.panel;
    const processedEntries = new Set();
    const capturedPageKeys = new Set();
    const candidatePageKeys = new Set();
    const excludedEntries = [];
    const failedEntries = [];
    try {
      await reportProgress("Redlining-Liste wird untersucht …", 0, 0);

      const trustedEntries = Array.isArray(pendingTrustedSnapshot) ? pendingTrustedSnapshot.slice() : [];
      if (trustedEntries.length) {
        // Im echten Vollbild wird ausschließlich die vorab gelesene DOM-Liste
        // benutzt. Die linke Redlining-Seitenleiste wird NICHT erneut geöffnet.
        await captureSnapshotEntries(
          trustedEntries, processedEntries, capturedPageKeys, candidatePageKeys,
          filters.assignment, excludedEntries, failedEntries
        );
      } else {
        // Fallback für ältere/abweichende eVIEW-Builds. Nur verwenden, wenn kein
        // Snapshot aus dem bestätigten Start vorhanden ist.
        for (const groupName of filters.statuses) {
          panel = findRedliningPanel() || panel;
          if (!panel) break;
          const group = await locateStatusGroup(panel, groupName);
          if (!group) continue;
          expandStatusGroup(group, panel);
          await delay(350);
          await captureVisibleEntries(panel, processedEntries, capturedPageKeys, candidatePageKeys, filters.assignment, excludedEntries, failedEntries, groupName);
        }
      }

      const pages = Array.from(capturedPageKeys).map((key) => ({ pageRef: key, redlinings: [] }));
      if (!pages.length && !excludedEntries.length && !failedEntries.length) {
        throw new Error("In den ausgewählten Statusgruppen wurde kein Redlining gefunden. Speichere bitte die neue Diagnose-Datei.");
      }
      await reportProgress("Automatische Erfassung abgeschlossen", processedEntries.size, capturedPageKeys.size);
      const failureSuffix = failedEntries.length ? ` · ${failedEntries.length} Eintrag/Einträge konnten nicht geladen werden` : "";
      showExtensionStatus(`Fertig: ${capturedPageKeys.size} eindeutige Seite(n) erfasst${failureSuffix}.`, failedEntries.length ? "info" : "success");
      return {
        redliningCount: processedEntries.size,
        matchedCount: processedEntries.size - excludedEntries.length - failedEntries.length,
        excludedCount: excludedEntries.length,
        failedCount: failedEntries.length,
        failedEntries,
        pages,
        filters
      };
    } finally {
      autoPreparedPageKey = null;
      autoPreparedAt = 0;
      await viewerSession.restore().catch(() => {});
    }
  }

  function domProfile() {
    const controls = Array.from(document.querySelectorAll("button, [role='button'], [role='listitem'], [role='option'], [aria-label], [data-testid], [data-name]"))
      .filter(visible)
      .slice(0, 400)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute("role"),
        ariaLabel: (element.getAttribute("aria-label") || "").slice(0, 120),
        title: (element.getAttribute("title") || "").slice(0, 120),
        data: Object.fromEntries(Object.entries(element.dataset || {}).slice(0, 20).map(([key, value]) => [key, String(value).slice(0, 120)])),
        className: String(element.className && element.className.baseVal || element.className || "").slice(0, 180)
      }));
    return { controlCount: controls.length, controls };
  }

  function scanDocument() {
    const text = document.body ? document.body.innerText : "";
    const redliningMentions = (text.match(/redlinings?/gi) || []).length;
    const panel = findRedliningPanel();
    const scroller = panel ? scrollContainer(panel) : null;
    const panelEntries = panel ? entryElements(panel, scroller).slice(0, 250).map((item) => ({
      text: item.text.slice(0, 160),
      tag: item.element.tagName.toLowerCase(),
      className: String(item.element.className && item.element.className.baseVal || item.element.className || "").slice(0, 180),
      data: Object.fromEntries(Object.entries(item.element.dataset || {}).slice(0, 20).map(([key, value]) => [key, String(value).slice(0, 120)]))
    })) : [];
    return {
      url: `${location.origin}${location.pathname}${location.hash}`,
      title: document.title,
      redliningMentions,
      records: core.deduplicateRecords(records),
      pages: core.uniquePages(records),
      unresolvedCount: unresolved.length,
      observations: observations.slice(),
      drawing: drawingBounds(),
      dom: domProfile(),
      redliningPanel: {
        found: Boolean(panel),
        entryCount: panelEntries.length,
        entries: panelEntries
      }
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "SCAN") {
      sendResponse({ ok: true, scan: scanDocument() });
      return;
    }
    if (message.type === "GET_PAGE_CONTEXT") {
      sendResponse({
        ok: true,
        context: pageContext()
      });
      return;
    }
    if (message.type === "PREPARE_CLEAN_CAPTURE") {
      const panel = findRedliningPanel();
      prepareCleanCapture(panel).then(async (prepared) => {
        if (self.__eviewRestoreCapture) await self.__eviewRestoreCapture();
        self.__eviewRestoreCapture = prepared.restore;
        sendResponse({ ok: true, context: prepared.context });
      }).catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }
    if (message.type === "RESTORE_CLEAN_CAPTURE") {
      Promise.resolve(self.__eviewRestoreCapture && self.__eviewRestoreCapture()).then(() => {
        self.__eviewRestoreCapture = null;
        sendResponse({ ok: true });
      }).catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }
    if (message.type === "REQUEST_TRUSTED_START") {
      const filters = message.filters || DEFAULT_FILTERS;
      openRedliningPanel().then((panel) => {
        autoScanPanelReference = panel;
        pendingTrustedSnapshot = snapshotEntriesForFilters(filters);
        showTrustedStartOverlay(filters);
        sendResponse({ ok: true, entries: pendingTrustedSnapshot.length });
      }).catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }
    if (message.type === "AUTO_CAPTURE_ALL") {
      autoCaptureAll(message.filters).then((result) => sendResponse({ ok: true, result }))
        .catch((error) => {
          showExtensionStatus(error.message, "error");
          sendResponse({ ok: false, error: error.message });
        });
      return true;
    }
    if (message.type === "SHOW_EXTENSION_STATUS") {
      showExtensionStatus(message.message, message.kind || "info");
      sendResponse({ ok: true });
      return;
    }
  });
})();
