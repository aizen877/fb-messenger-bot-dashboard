const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../data");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");

const MAX_HISTORY = 20; // Keep up to 20 recent messages per thread for full context awareness
const historyStore = new Map();

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {}
}

// Load existing history from history.json on startup
function loadHistoryFromFile() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const fileData = fs.readFileSync(HISTORY_FILE, "utf8");
      if (fileData.trim()) {
        const json = JSON.parse(fileData);
        for (const [threadID, history] of Object.entries(json)) {
          if (Array.isArray(history)) {
            historyStore.set(threadID, history);
          }
        }
        console.log(`💾 [AI History]: Successfully loaded history for ${historyStore.size} thread(s) from history.json`);
      }
    }
  } catch (err) {
    console.error("⚠️ Failed to load history.json:", err.message);
  }
}

// Save history map to history.json (debounced to avoid heavy disk I/O)
let saveTimeout = null;
function saveHistoryToFile() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const obj = {};
      for (const [threadID, history] of historyStore.entries()) {
        obj[threadID] = history;
      }
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(obj, null, 2), "utf8");
    } catch (err) {
      console.error("⚠️ Failed to save history.json:", err.message);
    }
  }, 300);
}

// Load history when module is initialized
loadHistoryFromFile();

/**
 * Gets conversation history array for a thread
 * @param {string} threadID 
 * @returns {Array<{role: string, content: string}>}
 */
function getHistory(threadID) {
  if (!historyStore.has(threadID)) {
    historyStore.set(threadID, []);
  }
  return historyStore.get(threadID);
}

/**
 * Record background group messages (even without mentioning AI) for thread context awareness
 * @param {string} threadID 
 * @param {string} senderName 
 * @param {string} text 
 */
function addBackgroundMessage(threadID, senderName, text) {
  if (!threadID || !text) return;
  const history = getHistory(threadID);
  
  const newContent = `[${senderName}]: ${text}`;
  const last = history[history.length - 1];

  // Avoid duplicate entries
  if (last && last.content === newContent) return;

  history.push({
    role: "user",
    content: newContent
  });

  // Trim old history if exceeds limit
  if (history.length > MAX_HISTORY) {
    historyStore.set(threadID, history.slice(history.length - MAX_HISTORY));
  }

  saveHistoryToFile();
}

/**
 * Adds a user query and assistant response to history
 * @param {string} threadID 
 * @param {string} senderName 
 * @param {string} userText 
 * @param {string} assistantReply 
 */
function addHistory(threadID, senderName, userText, assistantReply) {
  const history = getHistory(threadID);
  const userContent = `[${senderName}]: ${userText}`;
  const last = history[history.length - 1];

  // Only push user content if it wasn't already recorded by background message tracker
  if (!last || last.content !== userContent) {
    history.push({
      role: "user",
      content: userContent
    });
  }

  history.push({
    role: "assistant",
    content: assistantReply
  });

  // Trim old history if exceeds limit
  if (history.length > MAX_HISTORY) {
    historyStore.set(threadID, history.slice(history.length - MAX_HISTORY));
  }

  saveHistoryToFile();
}

/**
 * Clears conversation history for a thread
 * @param {string} threadID 
 */
function clearHistory(threadID) {
  historyStore.delete(threadID);
  saveHistoryToFile();
}

module.exports = {
  getHistory,
  addBackgroundMessage,
  addHistory,
  clearHistory
};
