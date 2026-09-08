"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const script = fs.readFileSync(path.join(__dirname, "../print/print.js"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "../print/print.css"), "utf8");

assert.ok(!script.includes('document.createElement("footer")'), "The extension must not add a page footer");
assert.ok(styles.includes("@page { size: A4 landscape; margin: 0; }"), "Printing must default to A4 landscape");
assert.ok(styles.includes("object-fit: contain"), "Every drawing must remain fully visible");
assert.ok(styles.includes("padding: 2mm"), "The print sheet must use the compact print safety margin");
assert.ok(script.includes("function trimQuietMargins(sourceCanvas)"), "Viewer whitespace must be trimmed before printing");
assert.ok(script.includes('resolve(trimQuietMargins(canvas).toDataURL("image/png"))'), "The trimmed source pixels must feed the print image");

console.log("OK: Margin-trimmed A4 landscape print layout");
