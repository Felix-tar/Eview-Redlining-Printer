"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");

const storage = {};
let listener = null;
let screenshotNumber = 0;
let cleanCaptureRestored = false;
const chrome = {
  storage: {
    local: {
      async get(keys) {
        const names = Array.isArray(keys) ? keys : [keys];
        return Object.fromEntries(names.filter((key) => key in storage).map((key) => [key, storage[key]]));
      },
      async set(values) { Object.assign(storage, values); },
      async remove(keys) { for (const key of keys) delete storage[key]; }
    }
  },
  tabs: {
    async captureVisibleTab() { screenshotNumber += 1; return `data:image/png;base64,${screenshotNumber}`; },
    async query() { return [{ id: 1, windowId: 1, url: "https://eview.eplan.com/view/projects/test/pages/1" }]; },
    async sendMessage(_tabId, payload) {
      if (payload.type === "PREPARE_CLEAN_CAPTURE") {
        return {
          ok: true,
          context: { pageKey: "/projects/test/pages/2", pageRef: "2", bounds: {}, viewport: {} }
        };
      }
      if (payload.type === "RESTORE_CLEAN_CAPTURE") {
        cleanCaptureRestored = true;
        return { ok: true };
      }
      throw new Error("Unexpected tab message");
    },
    async create() {}
  },
  runtime: {
    onMessage: { addListener(callback) { listener = callback; } },
    getURL(value) { return value; }
  }
};

vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/background.js"), "utf8"), {
  chrome,
  crypto: webcrypto,
  console,
  URL,
  setTimeout,
  clearTimeout
});

function message(payload, sender = { tab: { id: 1, windowId: 1 } }) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Background response timeout")), 1000);
    listener(payload, sender, (response) => {
      clearTimeout(timeout);
      resolve(response);
    });
  });
}

(async () => {
  const page1 = { pageKey: "/projects/test/pages/1", pageRef: "1", bounds: {}, viewport: {} };
  const first = await message({ type: "CAPTURE_CANDIDATE", context: page1, entry: { title: "ST->M0E", status: "review" } });
  const second = await message({ type: "CAPTURE_CANDIDATE", context: page1, entry: { title: "ST->MXE", status: "review" } });
  assert.equal(first.candidate.id, second.candidate.id, "Candidates on one page must share one page capture");
  assert.equal(screenshotNumber, 1, "One page must be captured only once");

  let state = await message({ type: "GET_STATE" }, {});
  assert.equal(state.filters.assignment.enabled, true, "ST to MoE must be enabled by default");
  assert.equal(state.filters.assignment.source, "ST");
  assert.equal(state.filters.assignment.target, "MOE");
  assert.equal(state.filters.timingMode, "normal", "Adaptive timing must default to normal");
  assert.equal(state.candidates.length, 1);
  assert.equal(state.candidates[0].entries.length, 2);
  assert.equal(state.captures.length, 0);

  const promoted = await message({ type: "PROMOTE_CANDIDATES", candidateIds: [first.candidate.id] }, {});
  assert.equal(promoted.added, 1);
  state = await message({ type: "GET_STATE" }, {});
  assert.equal(state.candidates.length, 0);
  assert.equal(state.captures.length, 1);

  const duplicate = await message({ type: "CAPTURE_FROM_CONTENT", context: page1 });
  assert.equal(duplicate.alreadyCaptured, true);
  assert.equal(screenshotNumber, 1, "Promoted and automatic captures must remain deduplicated");

  await message({ type: "SAVE_FILTERS", filters: { statuses: ["review"], assignment: { enabled: true, source: "ST", target: "MOE" }, timingMode: "slow" } }, {});
  await message({ type: "CLEAR_CAPTURES" }, {});
  state = await message({ type: "GET_STATE" }, {});
  assert.equal(state.captures.length, 0);
  assert.equal(state.candidates.length, 0);
  assert.equal(state.scan, null);
  assert.equal(state.automation, null);
  assert.equal(state.filters.assignment.enabled, true, "Clearing a print job must keep the chosen filters");
  assert.equal(state.filters.timingMode, "slow", "Clearing a print job must keep the connection profile");

  const manual = await message({ type: "CAPTURE_CURRENT" }, {});
  assert.equal(manual.ok, true);
  assert.equal(cleanCaptureRestored, true, "The eVIEW panel must be restored after a manual capture");
  assert.equal(screenshotNumber, 2, "A manual clean capture must create one screenshot");
  console.log("OK: Candidate selection and page deduplication");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
