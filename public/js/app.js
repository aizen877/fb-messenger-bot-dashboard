document.addEventListener("DOMContentLoaded", () => {
  let adminPassword = localStorage.getItem("adminPassword") || "";

  // UI Element Selectors
  const authModal = document.getElementById("authModal");
  const loginForm = document.getElementById("loginForm");
  const adminPasswordInput = document.getElementById("adminPassword");
  const authError = document.getElementById("authError");
  const appLayout = document.getElementById("appLayout");
  const logoutBtn = document.getElementById("logoutBtn");

  const navItems = document.querySelectorAll(".nav-item");
  const tabContents = document.querySelectorAll(".tab-content");
  const pageTitle = document.getElementById("pageTitle");

  const refreshStatsBtn = document.getElementById("refreshStatsBtn");
  const restartBotBtn = document.getElementById("restartBotBtn");

  // Overview elements
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const sideBotName = document.getElementById("sideBotName");
  const botStatusVal = document.getElementById("botStatusVal");
  const botUserVal = document.getElementById("botUserVal");
  const appStateCountVal = document.getElementById("appStateCountVal");
  const appStateDateVal = document.getElementById("appStateDateVal");
  const uptimeVal = document.getElementById("uptimeVal");
  const ramVal = document.getElementById("ramVal");
  const ramTotalVal = document.getElementById("ramTotalVal");

  const infoBotName = document.getElementById("infoBotName");
  const infoPrefix = document.getElementById("infoPrefix");
  const infoUserID = document.getElementById("infoUserID");
  const infoThreadID = document.getElementById("infoThreadID");
  const infoNodeVer = document.getElementById("infoNodeVer");

  // AppState elements
  const appstateTextarea = document.getElementById("appstateTextarea");
  const saveAppStateBtn = document.getElementById("saveAppStateBtn");
  const formatJsonBtn = document.getElementById("formatJsonBtn");
  const uploadAppStateBtn = document.getElementById("uploadAppStateBtn");
  const appstateFileInput = document.getElementById("appstateFileInput");
  const editorCookieCount = document.getElementById("editorCookieCount");
  const editorCUser = document.getElementById("editorCUser");
  const editorStatus = document.getElementById("editorStatus");

  // Config elements
  const configForm = document.getElementById("configForm");
  const subtabForm = document.getElementById("subtabForm");
  const subtabRaw = document.getElementById("subtabRaw");
  const rawEnvView = document.getElementById("rawEnvView");
  const rawEnvTextarea = document.getElementById("rawEnvTextarea");
  const saveRawEnvBtn = document.getElementById("saveRawEnvBtn");

  // Logs elements
  const logTerminal = document.getElementById("logTerminal");
  const clearLogsBtn = document.getElementById("clearLogsBtn");
  const autoScrollLogs = document.getElementById("autoScrollLogs");

  // Helper Toast Notifications
  function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    const icon = type === "success" ? "fa-circle-check" : "fa-circle-exclamation";
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  // API Request Wrapper with Auth Header
  async function apiFetch(url, options = {}) {
    options.headers = options.headers || {};
    options.headers["x-admin-password"] = adminPassword;
    options.headers["Content-Type"] = options.headers["Content-Type"] || "application/json";

    try {
      const response = await fetch(url, options);
      if (response.status === 401) {
        showAuthModal("Session expired or invalid password.");
        throw new Error("Unauthorized");
      }
      return await response.json();
    } catch (err) {
      if (err.message !== "Unauthorized") {
        console.error("API Fetch Error:", err);
      }
      throw err;
    }
  }

  // Auth Handling
  function showAuthModal(errMsg = "") {
    appLayout.classList.add("hidden");
    authModal.classList.remove("hidden");
    if (errMsg) {
      authError.textContent = errMsg;
      authError.classList.remove("hidden");
    } else {
      authError.classList.add("hidden");
    }
  }

  function hideAuthModal() {
    authModal.classList.add("hidden");
    appLayout.classList.remove("hidden");
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pass = adminPasswordInput.value.trim();
    if (!pass) return;

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pass })
      });
      const data = await res.json();
      if (data.success) {
        adminPassword = pass;
        localStorage.setItem("adminPassword", pass);
        hideAuthModal();
        initDashboard();
        showToast("Logged in successfully!");
      } else {
        authError.textContent = data.error || "Incorrect password";
        authError.classList.remove("hidden");
      }
    } catch (err) {
      authError.textContent = "Server error or connection failed.";
      authError.classList.remove("hidden");
    }
  });

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("adminPassword");
    adminPassword = "";
    showAuthModal();
  });

  // Tab Navigation
  navItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabName = btn.getAttribute("data-tab");
      navItems.forEach((n) => n.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      btn.classList.add("active");
      document.getElementById(`tab-${tabName}`).classList.add("active");

      pageTitle.textContent = {
        overview: "Dashboard Overview",
        appstate: "AppState (Facebook Cookies)",
        config: "Bot Configuration (.env)",
        logs: "Live Console Logs"
      }[tabName] || "Dashboard";

      if (tabName === "appstate") fetchAppStateData();
      if (tabName === "config") fetchConfigData();
      if (tabName === "logs") fetchLogsData();
    });
  });

  // Format Seconds to Uptime String
  function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d > 0 ? d + "d " : ""}${h > 0 ? h + "h " : ""}${m}m ${s}s`;
  }

  // 1. Fetch & Render Overview Stats
  async function fetchStatusStats() {
    try {
      const data = await apiFetch("/api/status");
      if (!data.success) return;

      const { bot, appState, system } = data;

      // Status dot & text
      if (bot.isOnline) {
        statusDot.className = "status-dot online";
        statusText.textContent = "Bot Online";
        botStatusVal.textContent = "Online";
        botStatusVal.style.color = "var(--accent-green)";
      } else {
        statusDot.className = "status-dot offline";
        statusText.textContent = "Initializing...";
        botStatusVal.textContent = "Connecting";
        botStatusVal.style.color = "var(--accent-orange)";
      }

      sideBotName.textContent = bot.botName;
      infoBotName.textContent = bot.botName;
      botUserVal.textContent = `User ID: ${bot.userID}`;
      infoUserID.textContent = bot.userID;
      infoPrefix.textContent = bot.prefix;
      infoThreadID.textContent = bot.activeThreadID;
      infoNodeVer.textContent = system.nodeVersion;

      // AppState info
      if (appState.exists) {
        appStateCountVal.textContent = `${appState.count} Cookies`;
        const lastMod = appState.lastModified ? new Date(appState.lastModified).toLocaleTimeString() : "Just now";
        appStateDateVal.textContent = `Last saved: ${lastMod}`;
      } else {
        appStateCountVal.textContent = "Missing";
        appStateDateVal.textContent = "appstate.json not found";
      }

      // Uptime & RAM
      uptimeVal.textContent = formatUptime(bot.uptimeSeconds);
      ramVal.textContent = `${system.rssMemMB} MB`;
      ramTotalVal.textContent = `System: ${system.freememMB} MB free / ${system.totalmemMB} MB`;

    } catch (e) {
      statusDot.className = "status-dot offline";
      statusText.textContent = "Disconnected";
    }
  }

  // 2. AppState Tab Logic
  async function fetchAppStateData() {
    try {
      const data = await apiFetch("/api/appstate");
      if (data.success && data.content) {
        appstateTextarea.value = JSON.stringify(data.parsed, null, 2);
        updateAppStateMetrics(data.parsed);
      }
    } catch (e) {
      showToast("Could not load appstate.json", "error");
    }
  }

  function updateAppStateMetrics(parsedArray) {
    if (Array.isArray(parsedArray)) {
      editorCookieCount.textContent = parsedArray.length;
      const cUser = parsedArray.find(c => c.key === "c_user");
      editorCUser.textContent = cUser ? cUser.value : "Not found";
      editorStatus.textContent = "Valid Cookie Array";
      editorStatus.className = "value text-success";
    } else {
      editorCookieCount.textContent = "0";
      editorCUser.textContent = "Invalid";
      editorStatus.textContent = "Invalid Format";
      editorStatus.className = "value text-danger";
    }
  }

  appstateTextarea.addEventListener("input", () => {
    try {
      const val = JSON.parse(appstateTextarea.value);
      updateAppStateMetrics(val);
    } catch (e) {
      editorCookieCount.textContent = "--";
      editorCUser.textContent = "--";
      editorStatus.textContent = "JSON Syntax Error";
      editorStatus.className = "value text-danger";
    }
  });

  formatJsonBtn.addEventListener("click", () => {
    try {
      const parsed = JSON.parse(appstateTextarea.value);
      appstateTextarea.value = JSON.stringify(parsed, null, 2);
      showToast("JSON formatted cleanly!");
    } catch (e) {
      showToast("Invalid JSON string: " + e.message, "error");
    }
  });

  uploadAppStateBtn.addEventListener("click", () => appstateFileInput.click());
  appstateFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        appstateTextarea.value = evt.target.result;
        try {
          const parsed = JSON.parse(evt.target.result);
          updateAppStateMetrics(parsed);
          showToast(`File "${file.name}" loaded!`);
        } catch (err) {
          showToast("Uploaded file is not valid JSON", "error");
        }
      };
      reader.readAsText(file);
    }
  });

  saveAppStateBtn.addEventListener("click", async () => {
    const content = appstateTextarea.value.trim();
    if (!content) return showToast("AppState content cannot be empty", "error");

    try {
      saveAppStateBtn.disabled = true;
      saveAppStateBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;

      const data = await apiFetch("/api/appstate", {
        method: "POST",
        body: JSON.stringify({ appState: content })
      });

      if (data.success) {
        showToast(data.message || "AppState saved & session restarted!");
        fetchStatusStats();
      } else {
        showToast(data.error || "Failed to save AppState", "error");
      }
    } catch (e) {
      showToast("Error saving AppState: " + e.message, "error");
    } finally {
      saveAppStateBtn.disabled = false;
      saveAppStateBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save & Live Reload Session`;
    }
  });

  // 3. Config Tab Logic
  async function fetchConfigData() {
    try {
      const data = await apiFetch("/api/config");
      if (data.success) {
        rawEnvTextarea.value = data.rawEnv;
        const vars = data.envVars || {};
        for (const [key, val] of Object.entries(vars)) {
          const field = document.getElementById(`cfg_${key}`);
          if (field) field.value = val;
        }
      }
    } catch (e) {
      showToast("Failed to load .env configuration", "error");
    }
  }

  subtabForm.addEventListener("click", () => {
    subtabForm.classList.add("active");
    subtabRaw.classList.remove("active");
    configForm.classList.remove("hidden");
    rawEnvView.classList.add("hidden");
  });

  subtabRaw.addEventListener("click", () => {
    subtabRaw.classList.add("active");
    subtabForm.classList.remove("active");
    rawEnvView.classList.remove("hidden");
    configForm.classList.add("hidden");
  });

  configForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const envVars = {
      BOT_NAME: document.getElementById("cfg_BOT_NAME").value,
      BOT_OWNER: document.getElementById("cfg_BOT_OWNER").value,
      COMMAND_PREFIX: document.getElementById("cfg_COMMAND_PREFIX").value,
      SUPER_ADMIN_ID: document.getElementById("cfg_SUPER_ADMIN_ID").value,
      WEB_ADMIN_PASSWORD: document.getElementById("cfg_WEB_ADMIN_PASSWORD").value,
      PORT: document.getElementById("cfg_PORT").value,
      BOT_PERSONALITY: document.getElementById("cfg_BOT_PERSONALITY").value,
      ONEHOP_API_KEYS: document.getElementById("cfg_ONEHOP_API_KEYS").value,
      MIN_TYPING_DELAY_MS: document.getElementById("cfg_MIN_TYPING_DELAY_MS").value,
      MAX_TYPING_DELAY_MS: document.getElementById("cfg_MAX_TYPING_DELAY_MS").value,
      CHARS_PER_SECOND: document.getElementById("cfg_CHARS_PER_SECOND").value
    };

    try {
      const data = await apiFetch("/api/config", {
        method: "POST",
        body: JSON.stringify({ envVars })
      });
      if (data.success) {
        showToast("Configuration saved successfully!");
        // Update local adminPassword if it was changed
        if (envVars.WEB_ADMIN_PASSWORD) {
          adminPassword = envVars.WEB_ADMIN_PASSWORD;
          localStorage.setItem("adminPassword", envVars.WEB_ADMIN_PASSWORD);
        }
        fetchStatusStats();
      }
    } catch (err) {
      showToast("Failed to save config: " + err.message, "error");
    }
  });

  saveRawEnvBtn.addEventListener("click", async () => {
    const rawEnv = rawEnvTextarea.value;
    try {
      const data = await apiFetch("/api/config", {
        method: "POST",
        body: JSON.stringify({ rawEnv })
      });
      if (data.success) {
        showToast("Raw .env saved successfully!");
        fetchConfigData();
        fetchStatusStats();
      }
    } catch (err) {
      showToast("Failed to save raw .env: " + err.message, "error");
    }
  });

  // 4. Live Logs Logic
  async function fetchLogsData() {
    try {
      const data = await apiFetch("/api/logs");
      if (data.success && Array.isArray(data.logs)) {
        logTerminal.innerHTML = "";
        data.logs.forEach(log => {
          const div = document.createElement("div");
          div.className = `log-line ${log.type || "info"}`;
          const time = new Date(log.timestamp).toLocaleTimeString();
          div.textContent = `[${time}] ${log.message}`;
          logTerminal.appendChild(div);
        });

        if (autoScrollLogs.checked) {
          logTerminal.scrollTop = logTerminal.scrollHeight;
        }
      }
    } catch (e) {}
  }

  clearLogsBtn.addEventListener("click", () => {
    logTerminal.innerHTML = `<div class="log-line info">[System]: Screen cleared.</div>`;
  });

  // Restart Bot Action
  restartBotBtn.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to restart the bot session?")) return;
    try {
      const data = await apiFetch("/api/restart", { method: "POST" });
      if (data.success) {
        showToast("Bot restart initiated!");
        setTimeout(fetchStatusStats, 2000);
      }
    } catch (e) {
      showToast("Restart failed: " + e.message, "error");
    }
  });

  refreshStatsBtn.addEventListener("click", () => {
    fetchStatusStats();
    showToast("Stats refreshed!");
  });

  // Init Dashboard
  function initDashboard() {
    fetchStatusStats();
    // Auto polling
    setInterval(fetchStatusStats, 5000);
    setInterval(() => {
      const activeTab = document.querySelector(".nav-item.active")?.getAttribute("data-tab");
      if (activeTab === "logs") fetchLogsData();
    }, 3000);
  }

  // Initial Auth check
  if (adminPassword) {
    hideAuthModal();
    initDashboard();
  } else {
    showAuthModal();
  }
});
