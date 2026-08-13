const fs = require("fs");
const http = require("http");
const https = require("https");

// Master Super Admin ID
const SUPER_ADMIN_ID = process.env.SUPER_ADMIN_ID || "61551005825239";

/**
 * Helper to fetch thread admin IDs with multiple fallback layers
 * @param {object} bot - MessengerBot instance
 * @param {string} threadID - Facebook Thread ID
 * @returns {Promise<Array<string>>}
 */
function getThreadAdminIDs(bot, threadID) {
  return new Promise((resolve) => {
    if (!bot || !threadID) return resolve([]);

    // 1. Try bot.api.getThreadInfo with callback
    if (bot.api && typeof bot.api.getThreadInfo === "function") {
      bot.api.getThreadInfo(threadID, (err, info) => {
        if (!err && info) {
          const rawAdmins = info.adminIDs || info.admin_ids || info.threadAdmins || info.thread_admins || [];
          const ids = rawAdmins
            .map((item) => {
              if (typeof item === "object" && item !== null) {
                return String(item.id || item.userID || item.user_id || "");
              }
              return String(item);
            })
            .filter(Boolean);

          if (ids.length > 0) return resolve(ids);
        }

        // Fallback 2: Try bot.client.threads.getInfo
        if (bot.client?.threads?.getInfo) {
          bot.client.threads.getInfo(threadID)
            .then((clientInfo) => {
              const rawAdmins = clientInfo?.adminIDs || clientInfo?.admin_ids || clientInfo?.threadAdmins || [];
              const ids = rawAdmins
                .map((item) => (typeof item === "object" && item !== null ? String(item.id || item.userID || "") : String(item)))
                .filter(Boolean);
              resolve(ids);
            })
            .catch(() => resolve([]));
        } else {
          resolve([]);
        }
      });
      return;
    }

    // Fallback 3: Try bot.client.threads.getInfo directly
    if (bot.client?.threads?.getInfo) {
      bot.client.threads.getInfo(threadID)
        .then((clientInfo) => {
          const rawAdmins = clientInfo?.adminIDs || clientInfo?.admin_ids || clientInfo?.threadAdmins || [];
          const ids = rawAdmins
            .map((item) => (typeof item === "object" && item !== null ? String(item.id || item.userID || "") : String(item)))
            .filter(Boolean);
          resolve(ids);
        })
        .catch(() => resolve([]));
    } else {
      resolve([]);
    }
  });
}

const threadDetailsCache = new Map();

/**
 * Helper to fetch complete thread details (Name, Members, Admins) with 5-minute caching
 * @param {object} bot - MessengerBot instance
 * @param {string} threadID - Facebook Thread ID
 * @returns {Promise<{name: string, participantIDs: Array<string>, adminIDs: Array<string>, userInfo: Array<object>}>}
 */
function getThreadDetails(bot, threadID) {
  return new Promise((resolve) => {
    const fallback = {
      name: "Chat Thread",
      participantIDs: [],
      adminIDs: [],
      userInfo: []
    };

    if (!bot || !threadID) return resolve(fallback);
    const tID = String(threadID);

    // Return cached thread details if valid and fetched within last 30 minutes
    if (threadDetailsCache.has(tID)) {
      const cached = threadDetailsCache.get(tID);
      if (Date.now() - cached.timestamp < 30 * 60 * 1000) {
        return resolve(cached.data);
      }
    }

    if (bot.api && typeof bot.api.getThreadInfo === "function") {
      bot.api.getThreadInfo(tID, (err, info) => {
        if (err || !info) {
          // Cache fallback to prevent spamming getThreadInfo when GraphQL fails (e.g. DMs)
          threadDetailsCache.set(tID, { timestamp: Date.now(), data: fallback });
          return resolve(fallback);
        }

        const rawAdmins = info.adminIDs || info.admin_ids || info.threadAdmins || info.thread_admins || [];
        const adminIDs = rawAdmins
          .map((item) => (typeof item === "object" && item !== null ? String(item.id || item.userID || "") : String(item)))
          .filter(Boolean);

        const rawParticipants = info.participantIDs || info.participant_ids || info.members || [];
        const participantIDs = rawParticipants
          .map((item) => (typeof item === "object" && item !== null ? String(item.id || item.userID || "") : String(item)))
          .filter(Boolean);

        const userInfo = Array.isArray(info.userInfo) ? info.userInfo : [];

        // Cache resolved user names automatically
        for (const u of userInfo) {
          if (u.id && (u.name || u.firstName)) {
            userNameCache.set(String(u.id), u.name || u.firstName);
          }
        }

        const result = {
          name: info.threadName || info.name || "Chat Thread",
          participantIDs: participantIDs.length > 0 ? participantIDs : userInfo.map((u) => String(u.id)),
          adminIDs,
          userInfo
        };

        threadDetailsCache.set(tID, { timestamp: Date.now(), data: result });
        resolve(result);
      });
    } else {
      resolve(fallback);
    }
  });
}

const userNameCache = new Map();

/**
 * Cache a user's full name manually into memory store
 * @param {string} userID 
 * @param {string} name 
 */
function cacheUserName(userID, name) {
  if (userID && name && !String(name).startsWith("User ")) {
    userNameCache.set(String(userID), name);
  }
}

/**
 * Check if the bot itself has Admin permissions in the specified group thread
 * @param {object} bot 
 * @param {string} threadID 
 * @returns {Promise<boolean>}
 */
async function isBotAdmin(bot, threadID) {
  if (!bot || !threadID) return false;
  try {
    const currentBotID = bot.api?.getCurrentUserID ? String(bot.api.getCurrentUserID()) : "100093356786348";
    const adminIDs = await getThreadAdminIDs(bot, threadID);
    return adminIDs.includes(currentBotID);
  } catch (e) {
    return false;
  }
}

/**
 * Helper to fetch user's full name safely with in-memory caching and zero session blocks
 * @param {object} bot - MessengerBot instance
 * @param {string} userID - Facebook User ID
 * @param {string} threadID - Optional thread ID context
 * @returns {Promise<string>}
 */
function getUserName(bot, userID, threadID = "") {
  return new Promise((resolve) => {
    if (!userID) return resolve("User Unknown");
    const uidStr = String(userID);

    if (userNameCache.has(uidStr)) {
      return resolve(userNameCache.get(uidStr));
    }

    const fallbackName = `User ${uidStr}`;
    resolve(fallbackName);
  });
}

/**
 * Downloads an image from a URL to a local temporary file stream
 * @param {string} url 
 * @param {string} tempPath 
 * @returns {Promise<string>}
 */
function downloadTempImage(url, tempPath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const fileStream = fs.createWriteStream(tempPath);
    client
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fileStream.close();
          return downloadTempImage(res.headers.location, tempPath).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          fileStream.close();
          fs.unlink(tempPath, () => {});
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        res.pipe(fileStream);
        fileStream.on("finish", () => {
          fileStream.close();
          resolve(tempPath);
        });
      })
      .on("error", (err) => {
        fs.unlink(tempPath, () => {});
        reject(err);
      });
  });
}

module.exports = {
  SUPER_ADMIN_ID,
  getThreadAdminIDs,
  getThreadDetails,
  getUserName,
  cacheUserName,
  isBotAdmin,
  downloadTempImage
};
