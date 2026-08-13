const fs = require("fs");
const http = require("http");
const https = require("https");

// Master Super Admin ID
const SUPER_ADMIN_ID = process.env.SUPER_ADMIN_ID || "61551005825239";

const userNameCache = new Map();
const threadDetailsCache = new Map();

/**
 * Cache a user's full name manually into memory store
 * @param {string} userID 
 * @param {string} name 
 */
function cacheUserName(userID, name) {
  if (userID && name && !String(name).startsWith("User ")) {
    userNameCache.set(String(userID), String(name));
  }
}

/**
 * Helper to fetch user's full name safely with in-memory caching and FCA getUserInfo fallback
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

    if (bot && bot.api && typeof bot.api.getUserInfo === "function") {
      try {
        bot.api.getUserInfo(uidStr, (err, ret) => {
          if (!err && ret && ret[uidStr]) {
            const uData = ret[uidStr];
            const fetchedName = uData.name || uData.firstName || uData.alternateName;
            if (fetchedName) {
              userNameCache.set(uidStr, fetchedName);
              return resolve(fetchedName);
            }
          }
          resolve(fallbackName);
        });
        return;
      } catch (e) {
        return resolve(fallbackName);
      }
    }

    resolve(fallbackName);
  });
}

/**
 * Helper to fetch thread admin IDs with multiple fallback layers
 * @param {object} bot - MessengerBot instance
 * @param {string} threadID - Facebook Thread ID
 * @returns {Promise<Array<string>>}
 */
function getThreadAdminIDs(bot, threadID) {
  return getThreadDetails(bot, threadID).then(details => details.adminIDs || []);
}

/**
 * Helper to fetch complete thread details (Name, Members, Admins) with fallback layers
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

    // Check cache (TTL 2 minutes, ONLY if valid data exists)
    if (threadDetailsCache.has(tID)) {
      const cached = threadDetailsCache.get(tID);
      if (Date.now() - cached.timestamp < 2 * 60 * 1000 && (cached.data.participantIDs.length > 0 || cached.data.adminIDs.length > 0)) {
        return resolve(cached.data);
      }
    }

    const parseInfo = (info) => {
      if (!info) return null;

      const rawAdmins = info.adminIDs || info.admin_ids || info.threadAdmins || info.thread_admins || [];
      let adminIDs = rawAdmins
        .map((item) => (typeof item === "object" && item !== null ? String(item.id || item.userID || item.user_id || "") : String(item)))
        .filter(Boolean);

      const userInfo = Array.isArray(info.userInfo) ? info.userInfo : [];

      // Extract user names and check admin status from userInfo array
      for (const u of userInfo) {
        if (u.id) {
          const uID = String(u.id);
          if (u.name || u.firstName) {
            cacheUserName(uID, u.name || u.firstName);
          }
          if ((u.type === "admin" || u.isAdmin || u.isGroupAdmin) && !adminIDs.includes(uID)) {
            adminIDs.push(uID);
          }
        }
      }

      const rawParticipants = info.participantIDs || info.participant_ids || info.members || info.recipients || [];
      let participantIDs = rawParticipants
        .map((item) => (typeof item === "object" && item !== null ? String(item.id || item.userID || item.user_id || "") : String(item)))
        .filter(Boolean);

      if (participantIDs.length === 0 && userInfo.length > 0) {
        participantIDs = userInfo.map((u) => String(u.id));
      }

      return {
        name: info.threadName || info.name || "Chat Thread",
        participantIDs,
        adminIDs,
        userInfo
      };
    };

    // Primary Attempt: bot.api.getThreadInfo
    if (bot.api && typeof bot.api.getThreadInfo === "function") {
      try {
        bot.api.getThreadInfo(tID, (err, info) => {
          const parsed = parseInfo(info);
          if (parsed && (parsed.participantIDs.length > 0 || parsed.adminIDs.length > 0)) {
            threadDetailsCache.set(tID, { timestamp: Date.now(), data: parsed });
            return resolve(parsed);
          }

          // Fallback Attempt 2: Try bot.client.threads.getInfo if available
          if (bot.client?.threads?.getInfo) {
            bot.client.threads.getInfo(tID)
              .then((clientInfo) => {
                const cParsed = parseInfo(clientInfo);
                if (cParsed && (cParsed.participantIDs.length > 0 || cParsed.adminIDs.length > 0)) {
                  threadDetailsCache.set(tID, { timestamp: Date.now(), data: cParsed });
                  return resolve(cParsed);
                }
                resolve(fallback);
              })
              .catch(() => resolve(fallback));
            return;
          }

          resolve(fallback);
        });
        return;
      } catch (e) {
        resolve(fallback);
        return;
      }
    }

    // Fallback Attempt 3: bot.client.threads.getInfo direct
    if (bot.client?.threads?.getInfo) {
      bot.client.threads.getInfo(tID)
        .then((clientInfo) => {
          const cParsed = parseInfo(clientInfo);
          if (cParsed && (cParsed.participantIDs.length > 0 || cParsed.adminIDs.length > 0)) {
            threadDetailsCache.set(tID, { timestamp: Date.now(), data: cParsed });
            return resolve(cParsed);
          }
          resolve(fallback);
        })
        .catch(() => resolve(fallback));
      return;
    }

    resolve(fallback);
  });
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
    const currentBotID = bot.api?.getCurrentUserID ? String(bot.api.getCurrentUserID()) : "";
    const adminIDs = await getThreadAdminIDs(bot, threadID);
    return adminIDs.includes(currentBotID);
  } catch (e) {
    return false;
  }
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
