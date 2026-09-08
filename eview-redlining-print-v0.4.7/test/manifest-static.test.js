"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "../manifest.json"), "utf8"));
const content = fs.readFileSync(path.join(__dirname, "../src/content.js"), "utf8");

assert.equal(manifest.version, "0.4.7");
assert.equal(manifest.commands, undefined, "The browser command shortcut must not steal the trusted page key event");
assert.ok(content.includes("event.ctrlKey && event.shiftKey"));
assert.ok(content.includes("event.code === 'Digit8'"));
assert.ok(content.includes("REQUEST_TRUSTED_START"));

console.log("OK: Trusted page gesture fullscreen start configuration");
