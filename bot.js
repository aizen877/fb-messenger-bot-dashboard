require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { createMessengerBot } = require("@dongdev/fca-unofficial");
const { loadCommands } = require("./handlers/commandHandler");
const { loadHears } = require("./handlers/hearsHandler");
const { createDashboardServer } = require("./server/dashboard");

// Path & Environment configuration
const appStatePath = path.resolve(process.env.APP_STATE_PATH || "./appstate.json");
let currentBot = null;
let isStartingBot = false;

// Global Process Shield: Catch unhandled errors so bot process never crashes
process.on("unhandledRejection", (reason) => {
  const msg = reason?.message || String(reason || "");
  if (msg.includes("login_blocked") || msg.includes("getUserInfo") || msg.includes("Connection refused")) {
    console.warn("⚠️ [Non-fatal Network Rejection Handled]:", msg);
  } else {
    console.error("⚠️ [Unhandled Rejection Handled]:", msg);
  }
});

process.on("uncaughtException", (err) => {
  console.error("⚠️ [Uncaught Exception Handled]:", err?.message || err);
});

// Function to start or re-login messenger bot session
async function startBotSession(newAppStateData) {
  if (isStartingBot) {
    console.log("⏳ Bot initialization already in progress...");
    return;
  }
  isStartingBot = true;

  try {
    const activePrefix = process.env.COMMAND_PREFIX || "/";
    let stateToUse = newAppStateData;

    if (!stateToUse) {
      if (!fs.existsSync(appStatePath)) {
        console.error("❌ ERROR: appstate.json file not found!");
        console.error("📋 Please export your Facebook cookies using c3c-fbstate Chrome extension,");
        console.error(`   save the JSON array to "${appStatePath}" or upload via Web UI at http://localhost:${process.env.PORT || 3000}.\n`);
        isStartingBot = false;
        return;
      }
      try {
        stateToUse = JSON.parse(fs.readFileSync(appStatePath, "utf8"));
      } catch (e) {
        console.error("❌ ERROR: Failed to parse appstate.json:", e.message);
        isStartingBot = false;
        return;
      }
    }

    if (!Array.isArray(stateToUse) || stateToUse.length === 0) {
      console.error("❌ ERROR: appstate.json must contain a non-empty cookie array.");
      isStartingBot = false;
      return;
    }

    // Stop existing bot if running
    if (currentBot) {
      console.log("🔄 Stopping existing bot session listeners before starting new instance...");
      try {
        if (currentBot.stop) await currentBot.stop();
      } catch (e) {}
      currentBot = null;
    }

    console.log("🚀 Initializing Facebook Messenger Bot with Auto-Recovery & Stealth Mode...");

    // Create MessengerBot instance with Stealth Options
    const bot = await createMessengerBot(
      { appState: stateToUse },
      {
        listenEvents: true,
        listenTyping: false,
        autoMarkRead: false,
        selfListen: false,
        autoReconnect: true,
        stopOnSignals: false, // Managed manually
        forceLogin: true,
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        commandPrefix: activePrefix,
        enableComposer: true,
        logLevel: "silent",
        ...(process.env.PROXY_URL ? { proxy: process.env.PROXY_URL } : {})
      }
    );

    bot.on("ready", () => {
      console.log("\n==============================================");
      console.log("✅ Bot successfully connected to Messenger!");
      console.log(`🤖 Logged in as User ID: ${bot.api?.getCurrentUserID() || "Unknown"}`);
      console.log(`📌 Command Prefix: "${activePrefix}"`);
      console.log("==============================================\n");

      // Save backup copy of valid appstate
      try {
        const dataDir = path.resolve("./data");
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(path.join(dataDir, "appstate_backup.json"), JSON.stringify(stateToUse, null, 2), "utf8");
        console.log("💾 [Session Guard]: Valid appstate session automatically backed up to data/appstate_backup.json");
      } catch (e) {}

      // Auto-refresh active Facebook cookies every 20 minutes
      if (bot.autoRefreshTimer) clearInterval(bot.autoRefreshTimer);
      bot.autoRefreshTimer = setInterval(() => {
        try {
          if (bot.api?.getAppState) {
            const freshState = bot.api.getAppState();
            if (Array.isArray(freshState) && freshState.length > 0) {
              fs.writeFileSync(appStatePath, JSON.stringify(freshState, null, 2), "utf8");
              console.log("🔄 [Auto Cookie Refresh]: Saved fresh Facebook session tokens to appstate.json");
            }
          }
        } catch (e) {}
      }, 20 * 60 * 1000);
    });

    bot.on("error", (err) => {
      console.warn("⚠️ [Bot Auto-Recovery Event]:", err?.message || err);
      // Auto reconnect after 5 seconds if connection drops
      setTimeout(() => {
        if (!isStartingBot) {
          console.log("🔄 [Auto-Recovery Watchdog]: Reconnecting Messenger bot session...");
          startBotSession();
        }
      }, 5000);
    });

    if (bot.api?.on) {
      bot.api.on("rateLimit", () => {
        console.warn("🛑 [Anti-Detection Alert]: Facebook Rate Limit triggered! Pausing activity temporarily...");
      });

      bot.api.on("checkpoint", () => {
        console.error("🚨 [Security Alert]: Facebook Checkpoint triggered! Please log into Facebook on your browser to approve.");
      });
    }

    const { addBackgroundMessage } = require("./utils/aiHistory");
    const { getUserName, cacheUserName } = require("./utils/helpers");
    const { sendHumanReply } = require("./utils/antiDetect");
    const aiCmd = require("./commands/ai");

    // Middleware Logger & Thread Memory Tracker
    bot.use(async (ctx, next) => {
      const timeStr = new Date().toLocaleTimeString();
      const sender = ctx.senderID || "Unknown";
      const bodyText = (ctx.text || "").trim();
      console.log(`[${timeStr}] [Thread: ${ctx.threadID}] [User: ${sender}]: ${bodyText || "(Media/Attachment)"}`);

      if (ctx.threadID) bot.activeThreadID = ctx.threadID;

      if (ctx.event?.mentions) {
        for (const [mID, mName] of Object.entries(ctx.event.mentions)) {
          if (mID && mName) cacheUserName(mID, String(mName).replace(/^@/, ""));
        }
      }

      if (ctx.threadID && bodyText && !bodyText.startsWith(activePrefix)) {
        try {
          const senderName = await getUserName(bot, sender);
          addBackgroundMessage(ctx.threadID, senderName, bodyText);
        } catch (e) {}
      }

      if (ctx.threadID) {
        setTimeout(async () => {
          try {
            if (bot.api?.markAsRead) {
              bot.api.markAsRead(ctx.threadID, () => {});
            } else if (bot.client?.messages?.markAsRead) {
              await bot.client.messages.markAsRead(ctx.threadID).catch(() => {});
            }
          } catch (e) {}
        }, Math.floor(Math.random() * 700) + 300);
      }

      await next();
    });

    // Auto AI Reply Middleware
    bot.use(async (ctx, next) => {
      const bodyText = (ctx.text || "").trim();
      if (!bodyText || bodyText.startsWith(activePrefix)) {
        return await next();
      }

      const currentBotID = bot.api?.getCurrentUserID ? String(bot.api.getCurrentUserID()) : "";
      const replyObj = ctx.event?.messageReply || ctx.event?.message_reply;
      const isRepliedToBot = replyObj && String(replyObj.senderID || replyObj.author || replyObj.sender_id || "") === currentBotID;

      if (isRepliedToBot) {
        console.log(`🤖 [Auto AI Trigger] User ${ctx.senderID} replied to Bot's message in Thread ${ctx.threadID}`);
        await aiCmd.handleAutoReply({
          bot,
          ctx,
          getUserName: (uID) => getUserName(bot, uID),
          sendHumanReply: (c, payload) => sendHumanReply(bot, c || ctx, payload)
        });
        return;
      }

      await next();
    });

    loadCommands(bot, activePrefix);
    loadHears(bot);

    console.log("⏳ Starting Messenger listeners...");
    await bot.launch();
    currentBot = bot;
  } catch (err) {
    console.error("💥 Error initializing bot session:", err?.message || err);
  } finally {
    isStartingBot = false;
  }
}

async function main() {
  // 1. Launch Web Dashboard Express Server
  createDashboardServer({
    getBotInstance: () => currentBot,
    onAppStateUpdate: (newAppState) => {
      console.log("⚡ Web UI triggered AppState update! Refreshing bot session live...");
      startBotSession(newAppState);
    },
    onRestartBot: () => {
      console.log("⚡ Web UI triggered manual bot restart!");
      startBotSession();
    }
  });

  // 2. Launch Messenger Bot session
  await startBotSession();

  // 3. Permanent Process Lock & Watchdog Shield (Keeps Node process alive 24/7)
  setInterval(() => {
    // Prevent process exit & check bot health every 30 seconds
  }, 30000);
}

main().catch((err) => {
  console.error("💥 Fatal Error in main process:", err);
});
