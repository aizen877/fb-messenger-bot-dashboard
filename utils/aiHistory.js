const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../data");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");

const MAX_MESSAGES = 8; // Keep 8 recent messages per thread for sharp, clean context
const historyStore = new Map();

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {}
}

function sanitizeNameArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(name => typeof name === "string" && name.trim() && !name.includes("[object Object]"));
}

/**
 * Load existing history from history.json on startup & ensure full Group JSON structure
 */
function loadHistoryFromFile() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const fileData = fs.readFileSync(HISTORY_FILE, "utf8");
      if (fileData.trim()) {
        const json = JSON.parse(fileData);
        for (const [threadID, data] of Object.entries(json)) {
          if (Array.isArray(data)) {
            // Legacy array format migration
            historyStore.set(threadID, {
              threadID,
              threadType: "group",
              groupName: "Messenger Group",
              totalMembers: 0,
              adminNames: [],
              memberNames: [],
              lastUpdated: new Date().toISOString(),
              messages: data
            });
          } else if (typeof data === "object" && data !== null) {
            historyStore.set(threadID, {
              threadID: data.threadID || threadID,
              threadType: data.threadType || "group",
              groupName: data.groupName || "Messenger Group",
              totalMembers: data.totalMembers || 0,
              adminNames: sanitizeNameArray(data.adminNames),
              memberNames: sanitizeNameArray(data.memberNames),
              lastUpdated: data.lastUpdated || new Date().toISOString(),
              messages: Array.isArray(data.messages) ? data.messages : []
            });
          }
        }
        console.log(`💾 [AI History]: Loaded rich JSON thread data for ${historyStore.size} thread(s) from history.json`);
      }
    }
  } catch (err) {
    console.error("⚠️ Failed to load history.json:", err.message);
  }
}

// Debounced save to history.json
let saveTimeout = null;
function saveHistoryToFile() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const obj = {};
      for (const [threadID, threadData] of historyStore.entries()) {
        obj[threadID] = threadData;
      }
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(obj, null, 2), "utf8");
    } catch (err) {
      console.error("⚠️ Failed to save history.json:", err.message);
    }
  }, 300);
}

// Initialize on module load
loadHistoryFromFile();

/**
 * Gets or creates full thread JSON data structure
 * @param {string} threadID 
 * @returns {object} { threadID, threadType, groupName, totalMembers, adminNames, memberNames, lastUpdated, messages }
 */
function getThreadData(threadID) {
  if (!historyStore.has(threadID)) {
    historyStore.set(threadID, {
      threadID,
      threadType: "group",
      groupName: "Messenger Group",
      totalMembers: 0,
      adminNames: [],
      memberNames: [],
      lastUpdated: new Date().toISOString(),
      messages: []
    });
  }
  return historyStore.get(threadID);
}

/**
 * Updates metadata for a thread (Group Name, Member Count, Admin Names, Member Names)
 * @param {string} threadID 
 * @param {object} groupDetails 
 */
function updateThreadMetadata(threadID, groupDetails = {}) {
  if (!threadID) return;
  const threadObj = getThreadData(threadID);
  
  if (groupDetails.groupName) threadObj.groupName = groupDetails.groupName;
  if (groupDetails.threadType) threadObj.threadType = groupDetails.threadType;
  if (typeof groupDetails.totalMembers === "number") threadObj.totalMembers = groupDetails.totalMembers;
  if (Array.isArray(groupDetails.adminNames)) threadObj.adminNames = sanitizeNameArray(groupDetails.adminNames);
  if (Array.isArray(groupDetails.memberNames)) threadObj.memberNames = sanitizeNameArray(groupDetails.memberNames);
  
  threadObj.lastUpdated = new Date().toISOString();
  saveHistoryToFile();
}

/**
 * Gets messages array for a thread
 * @param {string} threadID 
 * @returns {Array}
 */
function getHistory(threadID) {
  return getThreadData(threadID).messages;
}

/**
 * Record background group message to thread history
 */
function addBackgroundMessage(threadID, senderName, senderID, text) {
  if (!threadID || !text) return;
  const threadObj = getThreadData(threadID);
  const messages = threadObj.messages;
  
  const cleanSenderName = senderName || "User";
  const cleanSenderID = senderID ? String(senderID) : "Unknown";
  
  const last = messages[messages.length - 1];
  if (last && last.role === "user" && last.content === text && last.senderName === cleanSenderName) {
    return;
  }

  messages.push({
    role: "user",
    senderName: cleanSenderName,
    senderID: cleanSenderID,
    content: text,
    timestamp: new Date().toISOString()
  });

  if (messages.length > MAX_MESSAGES) {
    threadObj.messages = messages.slice(messages.length - MAX_MESSAGES);
  }

  threadObj.lastUpdated = new Date().toISOString();
  saveHistoryToFile();
}

/**
 * Record user query and assistant response to thread history
 */
function addHistory(threadID, senderName, senderID, userText, assistantReply) {
  if (!threadID) return;
  const threadObj = getThreadData(threadID);
  const messages = threadObj.messages;
  
  const cleanSenderName = senderName || "User";
  const cleanSenderID = senderID ? String(senderID) : "Unknown";
  const last = messages[messages.length - 1];

  if (!last || last.content !== userText || last.senderName !== cleanSenderName) {
    messages.push({
      role: "user",
      senderName: cleanSenderName,
      senderID: cleanSenderID,
      content: userText,
      timestamp: new Date().toISOString()
    });
  }

  messages.push({
    role: "assistant",
    senderName: process.env.BOT_NAME || "বল্টু",
    senderID: "bot",
    content: assistantReply,
    timestamp: new Date().toISOString()
  });

  if (messages.length > MAX_MESSAGES) {
    threadObj.messages = messages.slice(messages.length - MAX_MESSAGES);
  }

  threadObj.lastUpdated = new Date().toISOString();
  saveHistoryToFile();
}

/**
 * Clears conversation history & metadata for a single thread
 */
function clearHistory(threadID) {
  historyStore.delete(threadID);
  saveHistoryToFile();
}

/**
 * Clears history.json completely for a fresh clean start
 */
function clearAllHistory() {
  historyStore.clear();
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify({}, null, 2), "utf8");
    console.log("🧹 [AI History]: All history & group JSON records cleared!");
  } catch (e) {}
}

module.exports = {
  getThreadData,
  updateThreadMetadata,
  getHistory,
  addBackgroundMessage,
  addHistory,
  clearHistory,
  clearAllHistory
};
