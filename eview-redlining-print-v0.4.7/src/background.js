"use strict";

const CAPTURE_KEY = "eviewPageCaptures";
const CAPTURE_META_KEY = "eviewPageCaptureMeta";
const CANDIDATE_KEY = "eviewPendingCaptures";
const CANDIDATE_META_KEY = "eviewPendingCaptureMeta";
const SCAN_KEY = "eviewLastScan";
const AUTO_KEY = "eviewAutoState";
const FILTER_KEY = "eviewRedliningFilters";
const FILTER_SCHEMA_VERSION = 3;
const DEFAULT_FILTERS = {
  schemaVersion: FILTER_SCHEMA_VERSION,
  statuses: ["review"],
  assignment: { enabled: true, source: "ST", target: "MOE", customPatterns: [] },
  timingMode: "normal"
};

let activeAutoCapture = null;

function normalizeFilters(rawFilters) {
  return {
    schemaVersion: FILTER_SCHEMA_VERSION,
    statuses: Array.isArray(rawFilters && rawFilters.statuses) && rawFilters.statuses.length
      ? rawFilters.statuses : DEFAULT_FILTERS.statuses,
    assignment: { ...DEFAULT_FILTERS.assignment, ...rawFilters && rawFilters.assignment || {} },
    timingMode: ["fast", "normal", "slow"].includes(rawFilters && rawFilters.timingMode)
      ? rawFilters.timingMode : DEFAULT_FILTERS.timingMode
  };
}

function isEviewTab(tab) {
  return Boolean(tab && tab.id && /^https:\/\/(?:www\.)?eview\.eplan\.com\//i.test(tab.url || ""));
}

async function activeEviewTab() {
  const tab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!isEviewTab(tab)) throw new Error("Öffne zuerst den gewünschten eVIEW-Tab.");
  return tab;
}

async function getStoredFilters() {
  const stored = await chrome.storage.local.get(FILTER_KEY);
  const filters = stored[FILTER_KEY];
  if (!filters || filters.schemaVersion !== FILTER_SCHEMA_VERSION) {
    const defaults = normalizeFilters(DEFAULT_FILTERS);
    await chrome.storage.local.set({ [FILTER_KEY]: defaults });
    return defaults;
  }
  return normalizeFilters(filters);
}

async function showTabStatus(tabId, message, kind = "info") {
  if (!tabId) return;
  await chrome.tabs.sendMessage(tabId, { type: "SHOW_EXTENSION_STATUS", message, kind }).catch(() => {});
}

async function getCaptures() {
  const stored = await chrome.storage.local.get(CAPTURE_KEY);
  return Array.isArray(stored[CAPTURE_KEY]) ? stored[CAPTURE_KEY] : [];
}

async function saveCaptures(captures) {
  const metadata = captures.map(({ id, capturedAt, pageKey, pageRef, bounds, viewport }) => ({
    id, capturedAt, pageKey, pageRef, bounds, viewport
  }));
  await chrome.storage.local.set({ [CAPTURE_KEY]: captures, [CAPTURE_META_KEY]: metadata });
}

async function getCandidates() {
  const stored = await chrome.storage.local.get(CANDIDATE_KEY);
  return Array.isArray(stored[CANDIDATE_KEY]) ? stored[CANDIDATE_KEY] : [];
}

function candidateMetadata(candidates) {
  return candidates.map(({ id, capturedAt, pageKey, pageRef, bounds, viewport, entries }) => ({
    id, capturedAt, pageKey, pageRef, bounds, viewport, entries: entries || []
  }));
}

async function saveCandidates(candidates) {
  await chrome.storage.local.set({
    [CANDIDATE_KEY]: candidates,
    [CANDIDATE_META_KEY]: candidateMetadata(candidates)
  });
}

function mergeCandidateEntry(candidate, entry) {
  if (!entry || !entry.title) return;
  candidate.entries = Array.isArray(candidate.entries) ? candidate.entries : [];
  const key = `${entry.status || ""}|${entry.title}`;
  if (!candidate.entries.some((item) => `${item.status || ""}|${item.title}` === key)) candidate.entries.push(entry);
}

async function captureWithContext(tab, context) {
  const captures = await getCaptures();
  const uniqueKey = context.pageKey || context.pageRef;
  const alreadyCaptured = captures.find((item) => (item.pageKey || item.pageRef) === uniqueKey);
  if (alreadyCaptured) return { capture: alreadyCaptured, alreadyCaptured: true, count: captures.length };
  const candidates = await getCandidates();
  const pendingIndex = candidates.findIndex((item) => (item.pageKey || item.pageRef) === uniqueKey);
  const pending = pendingIndex >= 0 ? candidates[pendingIndex] : null;
  const dataUrl = pending ? pending.dataUrl : await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  const capture = {
    id: crypto.randomUUID(),
    capturedAt: new Date().toISOString(),
    pageKey: uniqueKey,
    pageRef: context.pageRef,
    bounds: context.bounds,
    viewport: context.viewport,
    dataUrl
  };
  captures.push(capture);
  await saveCaptures(captures);
  if (pendingIndex >= 0) {
    candidates.splice(pendingIndex, 1);
    await saveCandidates(candidates);
  }
  return { capture, alreadyCaptured: false, count: captures.length };
}

async function captureCandidateWithContext(tab, context, entry) {
  const captures = await getCaptures();
  const uniqueKey = context.pageKey || context.pageRef;
  if (captures.some((item) => (item.pageKey || item.pageRef) === uniqueKey)) {
    return { alreadyIncluded: true, candidate: null };
  }
  const candidates = await getCandidates();
  let candidate = candidates.find((item) => (item.pageKey || item.pageRef) === uniqueKey);
  if (candidate) {
    mergeCandidateEntry(candidate, entry);
    await saveCandidates(candidates);
    return { alreadyIncluded: false, candidate: candidateMetadata([candidate])[0] };
  }
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  candidate = {
    id: crypto.randomUUID(),
    capturedAt: new Date().toISOString(),
    pageKey: uniqueKey,
    pageRef: context.pageRef,
    bounds: context.bounds,
    viewport: context.viewport,
    entries: [],
    dataUrl
  };
  mergeCandidateEntry(candidate, entry);
  candidates.push(candidate);
  await saveCandidates(candidates);
  return { alreadyIncluded: false, candidate: candidateMetadata([candidate])[0] };
}

async function promoteCandidates(candidateIds) {
  const selected = new Set(candidateIds || []);
  const captures = await getCaptures();
  const candidates = await getCandidates();
  const remaining = [];
  let added = 0;
  for (const candidate of candidates) {
    if (!selected.has(candidate.id)) {
      remaining.push(candidate);
      continue;
    }
    const uniqueKey = candidate.pageKey || candidate.pageRef;
    if (!captures.some((item) => (item.pageKey || item.pageRef) === uniqueKey)) {
      const { entries, ...capture } = candidate;
      captures.push(capture);
      added += 1;
    }
  }
  await saveCaptures(captures);
  await saveCandidates(remaining);
  return { added, count: captures.length, pending: candidateMetadata(remaining) };
}

async function captureCurrentPage(tab) {
  const page = await chrome.tabs.sendMessage(tab.id, { type: "PREPARE_CLEAN_CAPTURE" });
  if (!page || !page.ok) throw new Error("Die eVIEW-Seite konnte nicht gelesen werden.");
  try {
    return await captureWithContext(tab, page.context);
  } finally {
    await chrome.tabs.sendMessage(tab.id, { type: "RESTORE_CLEAN_CAPTURE" }).catch(() => {});
  }
}

async function runAutoCapture(tab, rawFilters) {
  if (activeAutoCapture) throw new Error("Ein Redlining-Suchlauf läuft bereits.");
  const filters = normalizeFilters(rawFilters);
  const job = (async () => {
    await chrome.storage.local.remove([CAPTURE_KEY, CAPTURE_META_KEY, CANDIDATE_KEY, CANDIDATE_META_KEY]);
    await chrome.storage.local.set({ [FILTER_KEY]: filters });
    await chrome.storage.local.set({ [AUTO_KEY]: { running: true, message: "Automatische Erfassung startet …", processed: 0, uniquePages: 0 } });
    await showTabStatus(tab.id, "Redlining-Suchlauf startet …", "running");
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: "AUTO_CAPTURE_ALL", filters });
      if (!response || !response.ok) throw new Error(response && response.error || "Automatische Erfassung fehlgeschlagen.");
      const scan = {
        url: tab.url,
        title: tab.title,
        records: [],
        pages: response.result.pages,
        automation: response.result
      };
      await chrome.storage.local.set({
        [SCAN_KEY]: scan,
        [AUTO_KEY]: {
          running: false,
          message: "Automatische Erfassung abgeschlossen",
          processed: response.result.redliningCount,
          uniquePages: response.result.pages.length,
          excluded: response.result.excludedCount || 0,
          failed: response.result.failedCount || 0,
          timingMode: filters.timingMode,
          updatedAt: new Date().toISOString()
        }
      });
      const failed = response.result.failedCount || 0;
      await showTabStatus(
        tab.id,
        failed
          ? `Fertig: ${response.result.pages.length} Seite(n) erfasst, ${failed} Eintrag/Einträge konnten nicht geladen werden.`
          : `Fertig: ${response.result.pages.length} eindeutige Seite(n) erfasst.`,
        failed ? "info" : "success"
      );
      return { ok: true, result: response.result };
    } catch (error) {
      await chrome.storage.local.set({
        [AUTO_KEY]: { running: false, message: error.message, error: true, updatedAt: new Date().toISOString() }
      });
      await showTabStatus(tab.id, error.message, "error");
      throw error;
    }
  })();
  activeAutoCapture = job;
  try {
    return await job;
  } finally {
    if (activeAutoCapture === job) activeAutoCapture = null;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === "SAVE_SCAN") {
      await chrome.storage.local.set({ [SCAN_KEY]: message.scan });
      return { ok: true };
    }
    if (message.type === "CAPTURE_CURRENT") {
      const tab = sender.tab || await activeEviewTab();
      if (!tab || !tab.id) throw new Error("Kein aktiver eVIEW-Tab gefunden.");
      const result = await captureCurrentPage(tab);
      return { ok: true, ...result };
    }
    if (message.type === "CAPTURE_FROM_CONTENT") {
      if (!sender.tab) throw new Error("Der eVIEW-Tab fehlt.");
      const result = await captureWithContext(sender.tab, message.context);
      return { ok: true, ...result };
    }
    if (message.type === "CAPTURE_CANDIDATE") {
      if (!sender.tab) throw new Error("Der eVIEW-Tab fehlt.");
      const result = await captureCandidateWithContext(sender.tab, message.context, message.entry);
      return { ok: true, ...result };
    }
    if (message.type === "AUTO_PROGRESS") {
      await chrome.storage.local.set({ [AUTO_KEY]: { running: true, ...message.progress } });
      return { ok: true };
    }
    if (message.type === "AUTO_CAPTURE_ALL") {
      const tab = await activeEviewTab();
      return await runAutoCapture(tab, message.filters);
    }
    if (message.type === "GET_STATE") {
      const stored = await chrome.storage.local.get([CAPTURE_META_KEY, CANDIDATE_META_KEY, SCAN_KEY, AUTO_KEY, FILTER_KEY]);
      let captureMetadata = stored[CAPTURE_META_KEY];
      if (!Array.isArray(captureMetadata)) {
        const legacyCaptures = await getCaptures();
        captureMetadata = legacyCaptures.map(({ id, capturedAt, pageKey, pageRef, bounds, viewport }) => ({
          id, capturedAt, pageKey, pageRef, bounds, viewport
        }));
        await chrome.storage.local.set({ [CAPTURE_META_KEY]: captureMetadata });
      }
      let pendingMetadata = stored[CANDIDATE_META_KEY];
      if (!Array.isArray(pendingMetadata)) {
        pendingMetadata = candidateMetadata(await getCandidates());
        await chrome.storage.local.set({ [CANDIDATE_META_KEY]: pendingMetadata });
      }
      let filters = stored[FILTER_KEY];
      if (!filters || filters.schemaVersion !== FILTER_SCHEMA_VERSION) {
        filters = normalizeFilters(DEFAULT_FILTERS);
        await chrome.storage.local.set({ [FILTER_KEY]: filters });
      }
      return {
        ok: true,
        captures: captureMetadata,
        candidates: pendingMetadata,
        scan: stored[SCAN_KEY] || null,
        automation: stored[AUTO_KEY] || null,
        filters
      };
    }
    if (message.type === "SAVE_FILTERS") {
      await chrome.storage.local.set({ [FILTER_KEY]: normalizeFilters(message.filters) });
      return { ok: true };
    }
    if (message.type === "PROMOTE_CANDIDATES") {
      return { ok: true, ...(await promoteCandidates(message.candidateIds)) };
    }
    if (message.type === "CLEAR_CAPTURES") {
      await chrome.storage.local.remove([CAPTURE_KEY, CAPTURE_META_KEY, CANDIDATE_KEY, CANDIDATE_META_KEY, SCAN_KEY, AUTO_KEY]);
      return { ok: true };
    }
    if (message.type === "OPEN_PRINT_VIEW") {
      const captures = await getCaptures();
      if (!captures.length) throw new Error("Noch keine Seite erfasst.");
      await chrome.tabs.create({ url: chrome.runtime.getURL("print/print.html") });
      return { ok: true };
    }
    return { ok: false, error: "Unbekannte Aktion." };
  })().then(sendResponse).catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
