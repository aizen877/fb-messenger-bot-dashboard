const express = require("express");
const fs = require("fs");
const path = require("path");
const os = require("os");

const logsBuffer = [];
const MAX_LOGS = 300;

// Log capturer
function addLogEntry(type, message) {
  const timestamp = new Date().toISOString();
  logsBuffer.push({ timestamp, type, message });
  if (logsBuffer.length > MAX_LOGS) {
    logsBuffer.shift();
  }
}

// Hook stdout and stderr for dashboard log viewer
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = function (...args) {
  originalLog.apply(console, args);
  addLogEntry("info", args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" "));
};

console.warn = function (...args) {
  originalWarn.apply(console, args);
  addLogEntry("warn", args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" "));
};

console.error = function (...args) {
  originalError.apply(console, args);
  addLogEntry("error", args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" "));
};

function createDashboardServer({ getBotInstance, onAppStateUpdate, onRestartBot }) {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Static files directory
  const publicPath = path.resolve(__dirname, "../public");
  app.use(express.static(publicPath));

  // Middleware for Authentication
  const authMiddleware = (req, res, next) => {
    const adminPassword = process.env.WEB_ADMIN_PASSWORD || "admin123";
    const reqPassword = req.headers["x-admin-password"] || req.query.password || req.body?.password;

    if (!adminPassword || reqPassword === adminPassword) {
      return next();
    }
    return res.status(401).json({ success: false, error: "Unauthorized: Invalid Web Admin Password" });
  };

  // 1. Koyeb & Cloud Health Check Probe Endpoint (Public)
  app.get("/health", (req, res) => {
    const bot = getBotInstance ? getBotInstance() : null;
    const isOnline = Boolean(bot && bot.api);
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      botState: isOnline ? "online" : "initializing",
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024)
    });
  });

  // 2. Authentication Login Check Endpoint
  app.post("/api/login", (req, res) => {
    const adminPassword = process.env.WEB_ADMIN_PASSWORD || "admin123";
    const { password } = req.body;
    if (password === adminPassword) {
      return res.json({ success: true, message: "Authenticated successfully" });
    }
    return res.status(401).json({ success: false, error: "Incorrect password" });
  });

  // 3. Bot Status & System Stats Endpoint
  app.get("/api/status", authMiddleware, (req, res) => {
    const bot = getBotInstance ? getBotInstance() : null;
    const appStatePath = path.resolve(process.env.APP_STATE_PATH || "./appstate.json");
    let appStateStats = { exists: false, count: 0, lastModified: null, sizeBytes: 0, cUser: null };

    if (fs.existsSync(appStatePath)) {
      try {
        const stat = fs.statSync(appStatePath);
        const raw = fs.readFileSync(appStatePath, "utf8");
        const parsed = JSON.parse(raw);
        appStateStats.exists = true;
        appStateStats.sizeBytes = stat.size;
        appStateStats.lastModified = stat.mtime;
        if (Array.isArray(parsed)) {
          appStateStats.count = parsed.length;
          const cUserCookie = parsed.find(c => c.key === "c_user");
          if (cUserCookie) appStateStats.cUser = cUserCookie.value;
        }
      } catch (e) {
        appStateStats.error = e.message;
      }
    }

    const currentUserID = bot?.api?.getCurrentUserID ? bot.api.getCurrentUserID() : appStateStats.cUser || "Unknown";

    res.json({
      success: true,
      bot: {
        isOnline: Boolean(bot && bot.api),
        userID: currentUserID,
        botName: process.env.BOT_NAME || "Messenger Bot",
        prefix: process.env.COMMAND_PREFIX || "/",
        activeThreadID: bot?.activeThreadID || "None",
        uptimeSeconds: Math.floor(process.uptime())
      },
      appState: appStateStats,
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        cpuUsage: os.loadavg(),
        freememMB: Math.round(os.freemem() / 1024 / 1024),
        totalmemMB: Math.round(os.totalmem() / 1024 / 1024),
        rssMemMB: Math.round(process.memoryUsage().rss / 1024 / 1024)
      }
    });
  });

  // 4. Get Current Environment Config (.env)
  app.get("/api/config", authMiddleware, (req, res) => {
    const envPath = path.resolve("./.env");
    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf8");
    }

    // Key-value pairs parser
    const envVars = {};
    envContent.split("\n").forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.substring(0, eqIdx).trim();
          const value = trimmed.substring(eqIdx + 1).trim();
          envVars[key] = value;
        }
      }
    });

    res.json({
      success: true,
      rawEnv: envContent,
      envVars
    });
  });

  // 5. Save Updated Environment Config (.env)
  app.post("/api/config", authMiddleware, (req, res) => {
    const { envVars, rawEnv } = req.body;
    const envPath = path.resolve("./.env");

    try {
      if (typeof rawEnv === "string" && rawEnv.trim()) {
        fs.writeFileSync(envPath, rawEnv, "utf8");
      } else if (envVars && typeof envVars === "object") {
        let newContent = "";
        for (const [key, val] of Object.entries(envVars)) {
          newContent += `${key}=${val}\n`;
          process.env[key] = String(val);
        }
        fs.writeFileSync(envPath, newContent, "utf8");
      } else {
        return res.status(400).json({ success: false, error: "No valid configuration payload provided" });
      }

      console.log("⚙️ [Web UI]: Updated .env configuration successfully.");
      res.json({ success: true, message: "Configuration updated successfully!" });
    } catch (e) {
      res.status(500).json({ success: false, error: "Failed to save .env file: " + e.message });
    }
  });

  // 6. Get AppState.json content
  app.get("/api/appstate", authMiddleware, (req, res) => {
    const appStatePath = path.resolve(process.env.APP_STATE_PATH || "./appstate.json");
    if (!fs.existsSync(appStatePath)) {
      return res.status(404).json({ success: false, error: "appstate.json file does not exist" });
    }
    try {
      const content = fs.readFileSync(appStatePath, "utf8");
      res.json({ success: true, content, parsed: JSON.parse(content) });
    } catch (e) {
      res.status(500).json({ success: false, error: "Failed to read appstate.json: " + e.message });
    }
  });

  // 7. Update AppState.json & Live Restart Session
  app.post("/api/appstate", authMiddleware, async (req, res) => {
    const { appState } = req.body;
    if (!appState) {
      return res.status(400).json({ success: false, error: "AppState content is required" });
    }

    let parsedData;
    try {
      parsedData = typeof appState === "string" ? JSON.parse(appState) : appState;
      if (!Array.isArray(parsedData) || parsedData.length === 0) {
        throw new Error("AppState must be a valid non-empty array of cookie objects.");
      }
    } catch (e) {
      return res.status(400).json({ success: false, error: "Invalid AppState format: " + e.message });
    }

    const appStatePath = path.resolve(process.env.APP_STATE_PATH || "./appstate.json");
    try {
      fs.writeFileSync(appStatePath, JSON.stringify(parsedData, null, 2), "utf8");
      console.log("💾 [Web UI]: Saved new appstate.json successfully.");

      // Backup copy
      const dataDir = path.resolve("./data");
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(path.join(dataDir, "appstate_backup.json"), JSON.stringify(parsedData, null, 2), "utf8");

      // Trigger live re-login if handler provided
      if (onAppStateUpdate) {
        onAppStateUpdate(parsedData);
      }

      res.json({ success: true, message: "AppState updated & Bot session refreshed successfully!" });
    } catch (e) {
      res.status(500).json({ success: false, error: "Failed to save appstate.json: " + e.message });
    }
  });

  // 8. Stream Real-time Console Logs
  app.get("/api/logs", authMiddleware, (req, res) => {
    res.json({ success: true, logs: logsBuffer });
  });

  // 9. Manual Bot Restart Trigger
  app.post("/api/restart", authMiddleware, async (req, res) => {
    try {
      console.log("🔄 [Web UI]: Manual bot restart requested from dashboard...");
      if (onRestartBot) {
        onRestartBot();
      }
      res.json({ success: true, message: "Bot restart process initiated!" });
    } catch (e) {
      res.status(500).json({ success: false, error: "Failed to trigger restart: " + e.message });
    }
  });

  // Serve SPA index.html for all non-API GET requests
  app.use((req, res) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      res.sendFile(path.join(publicPath, "index.html"));
    } else {
      res.status(404).json({ error: "Endpoint not found" });
    }
  });

  const port = process.env.PORT || 3000;
  const host = "0.0.0.0";
  const server = app.listen(port, host, () => {
    console.log(`🌐 [Web Dashboard Server]: Listening live on http://${host}:${port}`);
    console.log(`🏥 [Koyeb Health Probe]: Live on http://${host}:${port}/health`);
  });

  return server;
}

module.exports = { createDashboardServer };
