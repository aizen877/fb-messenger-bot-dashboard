/**
 * Anti-Detection Utilities for FCA Messenger Bot
 * Designed to mimic human behavior and prevent automated spam detection.
 */

// Configuration default values tuned for maximum stealth & anti-block protection
const MIN_TYPING_DELAY = parseInt(process.env.MIN_TYPING_DELAY_MS || "2000", 10);
const MAX_TYPING_DELAY = parseInt(process.env.MAX_TYPING_DELAY_MS || "5000", 10);
const CHARS_PER_SECOND = parseInt(process.env.CHARS_PER_SECOND || "12", 10); // ~40 WPM human speed

// Anti-Spam Rate Limiter Store (per User ID)
const userMessageTracker = new Map();
const MAX_MESSAGES_PER_WINDOW = 3;
const WINDOW_DURATION_MS = 10000; // 10 seconds

/**
 * Checks if a user is spamming commands to protect account from FB rate limits
 * @param {string} userID 
 * @returns {boolean} true if user is rate-limited (spamming)
 */
function isUserSpamming(userID) {
  if (!userID) return false;
  const now = Date.now();
  const timestamps = (userMessageTracker.get(userID) || []).filter((t) => now - t < WINDOW_DURATION_MS);
  
  if (timestamps.length >= MAX_MESSAGES_PER_WINDOW) {
    return true; // Rate limit triggered!
  }

  timestamps.push(now);
  userMessageTracker.set(userID, timestamps);
  return false;
}

/**
 * Calculates a realistic human typing delay in milliseconds
 * based on text length with randomized variance (jitter).
 * 
 * @param {string} text 
 * @returns {number} delay in milliseconds
 */
function calculateTypingDelay(text = "") {
  if (!text) return MIN_TYPING_DELAY;
  
  // Estimate typing time: ~12 chars per second (approx 40 WPM human speed)
  const baseDelay = (text.length / CHARS_PER_SECOND) * 1000;
  
  // Add random human jitter (+/- 25%)
  const jitter = (Math.random() * 0.5 - 0.25) * baseDelay;
  const calculated = Math.round(baseDelay + jitter);
  
  // Clamp between minimum and maximum delay limits
  return Math.max(MIN_TYPING_DELAY, Math.min(MAX_TYPING_DELAY, calculated));
}

/**
 * Utility to pause execution for a given duration
 * @param {number} ms 
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends a message with human typing simulation:
 * 1. Random human reading pause (200ms - 800ms)
 * 2. Anti-Spam check
 * 3. Enables typing indicator in thread
 * 4. Waits for calculated human typing delay
 * 5. Sends reply safely
 */
async function sendHumanReply(bot, ctx, messagePayload) {
  const threadID = ctx.threadID;
  const senderID = ctx.senderID;
  const messageID = ctx.messageID;
  const textContent = typeof messagePayload === "string" ? messagePayload : (messagePayload.body || "");

  // Anti-Spam Shield check
  if (isUserSpamming(senderID)) {
    console.warn(`🛡️ [Anti-Spam Shield] Rate limit triggered for User ${senderID}. Cooldown active.`);
    return; // Ignore spam request to protect FB account
  }

  try {
    // Step 1: Simulate human reading time (200ms - 800ms random delay before typing)
    const readingDelay = Math.floor(Math.random() * 600) + 200;
    await sleep(readingDelay);

    // Step 2: Turn on typing indicator
    if (bot?.client?.messages?.sendTypingIndicator) {
      await bot.client.messages.sendTypingIndicator(true, threadID).catch(() => {});
    } else if (bot?.api?.sendTypingIndicator) {
      bot.api.sendTypingIndicator(true, threadID, () => {});
    }

    // Step 2: Calculate human delay and sleep
    const delay = calculateTypingDelay(textContent);
    await sleep(delay);

    // Step 3: Send message as direct reply (quoting user's message)
    if (bot?.api?.sendMessage) {
      return new Promise((resolve) => {
        bot.api.sendMessage(
          messagePayload,
          threadID,
          (err, info) => {
            if (err) {
              // Fallback: try sending without quoting messageID
              bot.api.sendMessage(messagePayload, threadID, (err2, info2) => {
                if (err2) {
                  if (typeof ctx.replyAsync === "function") {
                    ctx.replyAsync(messagePayload).then(resolve).catch(() => resolve());
                  } else {
                    resolve();
                  }
                } else {
                  resolve(info2);
                }
              });
            } else {
              resolve(info);
            }
          },
          messageID // 4th parameter enables direct reply quoting
        );
      });
    } else if (typeof ctx.replyAsync === "function") {
      return await ctx.replyAsync(messagePayload).catch(() => {});
    } else if (ctx.reply) {
      return await ctx.reply(messagePayload).catch(() => {});
    }
  } catch (err) {
    console.error(`[AntiDetect] Error sending reply to thread ${threadID}:`, err?.message || err);
  } finally {
    // Step 4: Turn off typing indicator
    if (bot?.client?.messages?.sendTypingIndicator) {
      await bot.client.messages.sendTypingIndicator(false, threadID).catch(() => {});
    } else if (bot?.api?.sendTypingIndicator) {
      bot.api.sendTypingIndicator(false, threadID, () => {});
    }
  }
}

module.exports = {
  calculateTypingDelay,
  sleep,
  sendHumanReply
};
