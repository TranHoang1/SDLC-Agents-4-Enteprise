/**
 * Proxy Tab — Webview JS for proxy configuration pane.
 * Handles form binding, validation, URL preview, and postMessage communication.
 */

(function () {
  "use strict";

  const vscode = (window.__vscodeApi) || (window.__vscodeApi = acquireVsCodeApi());

  // DOM Elements — Mode
  const modeRadios = document.querySelectorAll('input[name="proxy-mode"]');
  const detectedInfo = document.getElementById("proxy-detected-info");

  // DOM Elements — Manual config
  const manualSection = document.getElementById("proxy-manual-section");
  const authSection = document.getElementById("proxy-auth-section");
  const hostInput = document.getElementById("proxy-host-input");
  const portInput = document.getElementById("proxy-port-input");
  const bypassInput = document.getElementById("proxy-bypass-input");
  const urlPreview = document.getElementById("proxy-url-preview");
  const saveProxyBtn = document.getElementById("save-proxy-btn");
  const saveResult = document.getElementById("proxy-save-result");

  // DOM Elements — Credentials
  const usernameInput = document.getElementById("proxy-username-input");
  const passwordInput = document.getElementById("proxy-password-input");
  const togglePwdBtn = document.getElementById("toggle-proxy-password");
  const saveCredsBtn = document.getElementById("save-proxy-creds-btn");
  const clearCredsBtn = document.getElementById("clear-proxy-creds-btn");
  const credsResult = document.getElementById("proxy-creds-result");

  // DOM Elements — Test
  const testBtn = document.getElementById("test-proxy-btn");
  const detectBtn = document.getElementById("detect-proxy-btn");
  const testResult = document.getElementById("proxy-test-result");
  const testUrlInput = document.getElementById("proxy-test-url-input");

  let currentMode = "system";

  // ── Mode Selection ────────────────────────────────────────────────

  modeRadios.forEach(function (radio) {
    radio.addEventListener("change", function () {
      currentMode = radio.value;
      updateVisibility();
      vscode.postMessage({ type: "setProxyMode", mode: radio.value });
    });
  });

  function updateVisibility() {
    var isManual = currentMode === "manual";
    manualSection.style.display = isManual ? "block" : "none";
    authSection.style.display = isManual ? "block" : "none";
    updateUrlPreview();
  }

  // ── URL Preview ──────────────────────────────────────────────────

  function updateUrlPreview() {
    if (currentMode !== "manual") {
      urlPreview.textContent = "";
      return;
    }
    var host = hostInput.value.trim();
    var port = portInput.value.trim();
    if (host && port) {
      urlPreview.textContent = "Proxy URL: http://" + host + ":" + port;
    } else {
      urlPreview.textContent = "";
    }
  }

  hostInput.addEventListener("input", updateUrlPreview);
  portInput.addEventListener("input", updateUrlPreview);

  // ── Save Proxy ───────────────────────────────────────────────────

  saveProxyBtn.addEventListener("click", function () {
    var host = hostInput.value.trim();
    var port = parseInt(portInput.value, 10);
    var bypass = bypassInput.value.trim();
    if (!host) {
      showStatus(saveResult, "\u274C Host is required", "error");
      return;
    }
    if (isNaN(port) || port < 1 || port > 65535) {
      showStatus(saveResult, "\u274C Port must be 1\u201365535", "error");
      return;
    }
    saveProxyBtn.classList.add("loading");
    saveProxyBtn.disabled = true;
    vscode.postMessage({ type: "saveProxy", host: host, port: port, bypass: bypass });
  });

  // ── Credentials ──────────────────────────────────────────────────

  togglePwdBtn.addEventListener("click", function () {
    var isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    togglePwdBtn.textContent = isHidden ? "\uD83D\uDE48" : "\uD83D\uDC41";
  });

  saveCredsBtn.addEventListener("click", function () {
    var username = usernameInput.value.trim();
    var password = passwordInput.value;
    if (!username || !password) {
      showStatus(credsResult, "\u274C Username and password required", "error");
      return;
    }
    saveCredsBtn.classList.add("loading");
    saveCredsBtn.disabled = true;
    vscode.postMessage({
      type: "saveProxyCredentials",
      username: username,
      password: password,
    });
  });

  clearCredsBtn.addEventListener("click", function () {
    vscode.postMessage({ type: "clearProxyCredentials" });
  });

  // ── Test Connection ──────────────────────────────────────────────

  testBtn.addEventListener("click", function () {
    testBtn.classList.add("loading");
    testBtn.disabled = true;
    testResult.textContent = "Testing...";
    testResult.className = "status-indicator";
    vscode.postMessage({
      type: "testProxyConnection",
      mode: currentMode,
      host: hostInput.value.trim(),
      port: parseInt(portInput.value, 10) || 8080,
      username: usernameInput.value.trim() || undefined,
      password: passwordInput.value || undefined,
      testUrl: (testUrlInput && testUrlInput.value.trim()) || "https://httpbin.org/get",
    });
  });

  detectBtn.addEventListener("click", function () {
    detectBtn.classList.add("loading");
    detectBtn.disabled = true;
    vscode.postMessage({ type: "detectSystemProxy" });
  });

  // ── Message Handler ──────────────────────────────────────────────

  window.addEventListener("message", function (event) {
    var msg = event.data;
    switch (msg.type) {
      case "proxyState": handleProxyState(msg); break;
      case "proxyModeChanged": handleModeChanged(msg); break;
      case "proxySaved": handleProxySaved(msg); break;
      case "proxyCredentialsSaved": handleCredsSaved(msg); break;
      case "proxyCredentialsCleared": handleCredsCleared(msg); break;
      case "proxyTestResult": handleTestResult(msg); break;
      case "systemProxyDetected": handleDetected(msg); break;
    }
  });

  function handleProxyState(msg) {
    currentMode = msg.mode || "system";
    setModeRadio(currentMode);
    hostInput.value = msg.host || "";
    portInput.value = String(msg.port || 8080);
    bypassInput.value = msg.bypass || "";
    usernameInput.value = msg.username || "";
    if (msg.hasCredentials) {
      passwordInput.placeholder = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022 (Saved)";
    }
    if (msg.detectedProxyUrl) {
      detectedInfo.style.display = "block";
      detectedInfo.textContent = "\u2139\uFE0F Detected: " + msg.detectedProxyUrl;
      detectedInfo.className = "status-indicator success";
    } else if (currentMode === "system") {
      detectedInfo.style.display = "block";
      detectedInfo.textContent = "\u26A0\uFE0F No system proxy detected";
      detectedInfo.className = "status-indicator warning";
    } else {
      detectedInfo.style.display = "none";
    }
    updateVisibility();
    updateUrlPreview();
  }

  function handleModeChanged(msg) {
    if (!msg.success) {
      showStatus(saveResult, "\u274C " + (msg.error || "Failed"), "error");
    }
  }

  function handleProxySaved(msg) {
    saveProxyBtn.classList.remove("loading");
    saveProxyBtn.disabled = false;
    if (msg.success) {
      showStatus(saveResult, "\u2705 Proxy saved", "success");
    } else {
      showStatus(saveResult, "\u274C " + (msg.error || "Save failed"), "error");
    }
  }

  function handleCredsSaved(msg) {
    saveCredsBtn.classList.remove("loading");
    saveCredsBtn.disabled = false;
    if (msg.success) {
      showStatus(credsResult, "\u2705 Credentials saved", "success");
      passwordInput.value = "";
      passwordInput.placeholder = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022 (Saved)";
    } else {
      showStatus(credsResult, "\u274C " + (msg.error || "Failed"), "error");
    }
  }

  function handleCredsCleared(msg) {
    if (msg.success) {
      showStatus(credsResult, "\u2705 Credentials cleared", "success");
      usernameInput.value = "";
      passwordInput.value = "";
      passwordInput.placeholder = "Enter password...";
    }
  }

  function handleTestResult(msg) {
    testBtn.classList.remove("loading");
    testBtn.disabled = false;
    var text = msg.success ? "\u2705 " : "\u274C ";
    text += msg.message;
    if (msg.latencyMs) { text += " (" + msg.latencyMs + "ms)"; }
    showStatus(testResult, text, msg.success ? "success" : "error");
  }

  function handleDetected(msg) {
    detectBtn.classList.remove("loading");
    detectBtn.disabled = false;
    if (msg.url) {
      showStatus(testResult, "\u2139\uFE0F System proxy: " + msg.url, "success");
    } else {
      showStatus(testResult, "\u26A0\uFE0F No system proxy detected", "warning");
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────

  function setModeRadio(mode) {
    modeRadios.forEach(function (r) { r.checked = r.value === mode; });
  }

  function showStatus(el, msg, type) {
    el.textContent = msg;
    el.className = "status-indicator " + (type || "");
  }

  // ── Init: Request proxy state when tab loads ─────────────────────

  var proxyTab = document.getElementById("tab-proxy");
  if (proxyTab) {
    proxyTab.addEventListener("click", function () {
      vscode.postMessage({ type: "getProxyState" });
    });
  }

  // Also request state immediately in case proxy tab is already active
  setTimeout(function () {
    vscode.postMessage({ type: "getProxyState" });
  }, 100);
})();
