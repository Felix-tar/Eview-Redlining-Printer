(function installEviewNetworkObserver() {
  "use strict";

  const EVENT_NAME = "eview-redlining-print:network";
  const MATCH_WORDS = ["redlining", "redline"];
  const MAX_RESPONSE_CHARS = 2_000_000;

  function looksRelevant(text, rawUrl) {
    const sample = String(text || "").toLowerCase();
    const url = String(rawUrl || "").toLowerCase();
    return MATCH_WORDS.some((word) => sample.includes(word) || url.includes(word));
  }

  function safePath(rawUrl) {
    try {
      const url = new URL(rawUrl, location.href);
      return `${url.origin}${url.pathname}`;
    } catch (_) {
      return "unknown";
    }
  }

  function publish(rawUrl, status, text) {
    if (!text || text.length > MAX_RESPONSE_CHARS || !looksRelevant(text, rawUrl)) return;
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (_) {
      return;
    }
    document.dispatchEvent(new CustomEvent(EVENT_NAME, {
      detail: { endpoint: safePath(rawUrl), status, payload }
    }));
  }

  const nativeFetch = window.fetch;
  if (typeof nativeFetch === "function") {
    window.fetch = async function observedFetch(...args) {
      const response = await nativeFetch.apply(this, args);
      try {
        const requestUrl = typeof args[0] === "string" ? args[0] : args[0] && args[0].url;
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("json")) {
          response.clone().text().then((text) => publish(requestUrl, response.status, text)).catch(() => {});
        }
      } catch (_) {}
      return response;
    };
  }

  const nativeOpen = XMLHttpRequest.prototype.open;
  const nativeSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function observedOpen(method, url, ...rest) {
    this.__eviewObservedUrl = url;
    return nativeOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function observedSend(...args) {
    this.addEventListener("load", () => {
      try {
        const contentType = this.getResponseHeader("content-type") || "";
        if (contentType.includes("json") && typeof this.responseText === "string") {
          publish(this.__eviewObservedUrl, this.status, this.responseText);
        }
      } catch (_) {}
    }, { once: true });
    return nativeSend.apply(this, args);
  };
})();
