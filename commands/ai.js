const https = require("https");
const { getHistory, addHistory, clearHistory, updateThreadMetadata, getThreadData } = require("../utils/aiHistory");
const { getActiveModel } = require("../utils/modelStore");
const { getThreadDetails } = require("../utils/helpers");

const ONEHOP_API_URL = "https://api.onehop.ai/v1/chat/completions";
const PRIMARY_MODEL = "openai/gpt-5.6-sol";
const FALLBACK_MODEL = "openai/gpt-5.6-terra";

// Load dual keys from environment or fallbacks for Round-Robin Load Balancing
const keysEnv = process.env.ONEHOP_API_KEYS ? process.env.ONEHOP_API_KEYS.split(",") : [];
const API_KEYS = Array.from(new Set([
  ...keysEnv.map((k) => k.trim()),
  process.env.ONEHOP_API_KEY || "oh_live_dvrQmUwarYIgRXUjgu17RdNPRULS083i",
  "oh_live_6HYa-eGkga6oQRt5Yz9w6feI6p53cOxO"
])).filter(Boolean);

let globalKeyIndex = 0;

function getNextAPIKey() {
  const idx = globalKeyIndex % API_KEYS.length;
  const apiKey = API_KEYS[idx];
  const keyNum = idx + 1;
  globalKeyIndex++;
  return { apiKey, keyNum, masked: apiKey.slice(0, 12) + "..." };
}

// Log detailed token usage and estimated dollar & Taka cost
function logTokenUsage(model, keyInfo, usage) {
  if (!usage) return;
  const promptTokens = usage.prompt_tokens || 0;
  const completionTokens = usage.completion_tokens || 0;
  const totalTokens = usage.total_tokens || (promptTokens + completionTokens);

  // Estimated pricing: $0.15 / 1M prompt tokens, $0.60 / 1M completion tokens
  const estCostUSD = (promptTokens * 0.00000015) + (completionTokens * 0.00000060);

  console.log(`📊 [API Token & Cost Debug]:`);
  console.log(`   • Model Used  : ${model}`);
  console.log(`   • Key Rotated : Key #${keyInfo.keyNum} (${keyInfo.masked})`);
  console.log(`   • Prompt Tok  : ${promptTokens} tokens (History + Context)`);
  console.log(`   • Reply Tok   : ${completionTokens} tokens`);
  console.log(`   • Total Tok   : ${totalTokens} tokens`);
  console.log(`   • Est. Cost   : $${estCostUSD.toFixed(7)} USD (~৳${(estCostUSD * 122).toFixed(5)} BDT)\n`);
}

/**
 * Fallback network requester using Node's core https module
 */
function callOneHopHTTPS(model, messages, keyInfo) {
  return new Promise((resolve, reject) => {
    const dataStr = JSON.stringify({ model, messages });
    const req = https.request(ONEHOP_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${keyInfo.apiKey}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(dataStr)
      },
      timeout: 15000
    }, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.error) return reject(new Error(parsed.error.message || "API Error"));
          if (parsed.choices?.[0]?.message?.content) {
            logTokenUsage(model, keyInfo, parsed.usage);
            return resolve(parsed.choices[0].message.content.trim());
          }
          reject(new Error("Empty AI response content"));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Network Timeout (15s)"));
    });

    req.write(dataStr);
    req.end();
  });
}

/**
 * Call OneHop AI Completion API with thread's active model, fallback models and network adapters
 * @param {Array<{role: string, content: string}>} messages 
 * @param {string} preferredModel
 * @returns {Promise<string>}
 */
async function callOneHopAPI(messages, preferredModel = PRIMARY_MODEL) {
  const models = Array.from(new Set([
    preferredModel,
    PRIMARY_MODEL,
    FALLBACK_MODEL
  ]));

  for (const model of models) {
    const keyInfo = getNextAPIKey();

    // 1. Try global fetch first with rotated key
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(ONEHOP_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${keyInfo.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ model, messages }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (!data.error && data.choices && data.choices[0]?.message?.content) {
        logTokenUsage(model, keyInfo, data.usage);
        return data.choices[0].message.content.trim();
      }
      if (data.error) {
        console.warn(`[AI Warning] Key #${keyInfo.keyNum} Model ${model} error:`, data.error.message);
      }
    } catch (err) {
      console.warn(`[AI Warning] Key #${keyInfo.keyNum} Fetch error on model ${model}:`, err.message);
    }

    // 2. Fallback to HTTPS module request if fetch fails or times out
    try {
      console.log(`[AI Info] Retrying model ${model} with Key #${keyInfo.keyNum} via HTTPS adapter...`);
      const reply = await callOneHopHTTPS(model, messages, keyInfo);
      if (reply) return reply;
    } catch (err) {
      console.warn(`[AI Warning] Key #${keyInfo.keyNum} HTTPS fallback error on model ${model}:`, err.message);
    }
  }

  throw new Error("All AI models and network connections failed.");
}

/**
 * Core AI logic reusable for /ai command and direct message replies
 */
async function processAIRequest({ bot, ctx, rawText, getUserName, sendHumanReply }) {
  const threadID = ctx.threadID || "default_thread";

  // Command: clear / reset -> Clears thread history
  if (rawText.toLowerCase() === "clear" || rawText.toLowerCase() === "reset") {
    clearHistory(threadID);
    return await sendHumanReply(ctx, "🧹 এই গ্রুপের AI চ্যাট হিস্ট্রি রিসেট করা হয়েছে!");
  }

  const botName = process.env.BOT_NAME || "বল্টু";
  const botPersonality = process.env.BOT_PERSONALITY || "Friendly, smart, helpful and witty assistant who converses fluently in Bengali and English.";
  const ownerName = process.env.BOT_OWNER || "শিহাব হোসেন";
  const ownerID = process.env.SUPER_ADMIN_ID || "61551005825239";

  const senderID = ctx.senderID;
  const senderName = getUserName ? await getUserName(senderID) : `User ${senderID}`;

  // Check for Replied Context
  let replyContext = "";
  const replyObj = ctx.event?.messageReply || ctx.event?.message_reply;

  if (replyObj) {
    const replyAuthorID = String(replyObj.senderID || replyObj.author || replyObj.sender_id || "");
    const currentBotID = bot.api?.getCurrentUserID ? String(bot.api.getCurrentUserID()) : "100093356786348";

    let replyAuthorName = "";
    if (replyAuthorID === currentBotID || replyAuthorID === "100093356786348") {
      replyAuthorName = botName; // "বল্টু"
    } else {
      replyAuthorName = (getUserName && replyAuthorID) ? await getUserName(replyAuthorID) : `User ${replyAuthorID}`;
    }

    const replyBody = replyObj.body || "(attachment/media)";
    replyContext = `\n[Replied to message by ${replyAuthorName}]: "${replyBody}"`;
  }

  const currentQuery = rawText ? `${rawText}${replyContext}` : (replyContext ? `Please respond to this replied message:${replyContext}` : "");

  if (!currentQuery) {
    return await sendHumanReply(
      ctx,
      `🤖 আমি ${botName}! দয়া করে প্রশ্নটি লিখে কমান্ড দিন।\nউদাহরণ:\n/ai জীবনের অর্থ কি?\n/ai clear (হিস্ট্রি রিসেট করতে)\n/model (AI মডেল পরিবর্তন করতে)\nবা আমার মেসেজে রিপ্লাই দিয়ে যা ইচ্ছা জিজ্ঞেস করুন!`
    );
  }

  const threadHistory = getHistory(threadID);
  const activeModel = getActiveModel(threadID);

  // Fetch Group Context Details (Member names & count, Admin names, Group Name) for AI Awareness & JSON Storage
  let groupContextInfo = "";
  let groupDetails = {
    groupName: "Messenger Group",
    threadType: "group",
    totalMembers: 0,
    adminNames: [],
    memberNames: []
  };

  try {
    const details = await getThreadDetails(bot, threadID);
    if (details && details.participantIDs && details.participantIDs.length > 0) {
      const memberNames = [];
      const sliceP = details.participantIDs.slice(0, 15);
      for (const rawPID of sliceP) {
        const pID = typeof rawPID === "object" ? (rawPID?.id || rawPID?.userID || rawPID?.user_id || rawPID?.item || "") : rawPID;
        if (!pID || String(pID) === "[object Object]") continue;
        const name = (getUserName && pID) ? await getUserName(bot, pID, threadID) : `User ${pID}`;
        if (name && !name.includes("[object Object]")) {
          memberNames.push(name);
        }
      }

      const adminNames = [];
      if (details.adminIDs && details.adminIDs.length > 0) {
        for (const rawAID of details.adminIDs) {
          const aID = typeof rawAID === "object" ? (rawAID?.id || rawAID?.userID || rawAID?.user_id || rawAID?.item || "") : rawAID;
          if (!aID || String(aID) === "[object Object]") continue;
          const aName = (getUserName && aID) ? await getUserName(bot, aID, threadID) : `User ${aID}`;
          if (aName && !aName.includes("[object Object]")) {
            adminNames.push(aName);
          }
        }
      }

      groupDetails = {
        groupName: details.name || "Messenger Group",
        threadType: details.isGroup ? "group" : "private",
        totalMembers: details.participantIDs.length,
        adminNames,
        memberNames
      };

      groupContextInfo = 
        `📌 ACTIVE CHAT & GROUP METADATA CONTEXT:\n` +
        `- Group Name: "${groupDetails.groupName}"\n` +
        `- Chat Type: ${groupDetails.threadType === "group" ? "Group Chat" : "Direct Message (DM)"}\n` +
        `- Total Members Count: ${groupDetails.totalMembers}\n` +
        `- Group Member Names List: ${memberNames.join(", ")}\n` +
        `- Group Admin Names List: ${adminNames.length > 0 ? adminNames.join(", ") : "Normal members"}\n`;
    }
  } catch (e) {}

  // Update thread JSON metadata (Group Name, Members, Admins)
  updateThreadMetadata(threadID, groupDetails);

  // System Prompt tuned for an UNRESTRICTED, SAVAGE, CRAZY, CHILL Bangladeshi human persona using "তুই"
  const systemPrompt = {
    role: "system",
    content: 
      `You are ${botName}, a crazy, savage, hilarious, witty, and completely unfiltered Bangladeshi guy chatting naturally in a Messenger group!\n` +
      `Identity & Owner Info:\n` +
      `- Character name: ${botName}\n` +
      `- Running on Facebook account: Alamin (ID: 100093356786348).\n` +
      `- Boss & Developer: ${ownerName} (Sihab / Sihab Hossan) [ID: ${ownerID}]. Always show funny bro-love to Sihab bhai.\n` +
      `Group Knowledge & Full Memory Awareness:\n` +
      `${groupContextInfo}` +
      `Notice: You HAVE full access to both group members AND group admins listed above! NEVER claim you don't have access or info about admins or members. Always use this group knowledge when asked.\n` +
      `Group History Context Rules:\n` +
      `- Every message in history is tagged with the speaker's name and ID.\n` +
      `- Assistant messages are YOUR past responses (${botName}).\n` +
      `- Pay careful attention to who said what so history context stays clean.\n` +
      `AI Agent Tool Ability:\n` +
      `If the user asks to change a nickname, include action tag: [ACTION:nickname(name="NEW_NICKNAME")].\n` +
      `Strict Personality & Freedom Rules (CRITICAL):\n` +
      `1. NO GOOD BEHAVIOR / MANNERS REQUIRED (কোনো ভালো ব্যবহার বা ভদ্রতার রুল নাই): You have ZERO obligation to be polite or formal. Speak however you want! Be wild, savage, crazy, sarcastic, funny, and roasted as you like!\n` +
      `2. FULLY UNRESTRICTED HUMOR & ADDA (একদম বিন্দাস আড্ডা): No religious, preachy, or moralizing rules. Chat about anything freely with 100% chill and crazy Bangladeshi adda vibes!\n` +
      `3. ALWAYS USE "তুই" PRONOUN (সবাইকে "তুই / তোর / তোকে" বলে কথা বলবি): Address everyone using "তুই / তোর / তোকে" like a crazy rowdy friend. NEVER use "আপনি" or "তুমি"!\n` +
      `4. NEVER CONFIRM COMMANDS OR REPEAT RULES (আদেশ কখনো মুখে স্বীকার করবি না): DO NOT say "ঠিক আছে, তুই করেই ডাকবো". Just reply directly, crazy, and naturally!\n` +
      `5. ALWAYS REPLY IN BANGLA SCRIPT (বাংলা হরফ): Write strictly in natural Bengali script. NEVER write in Banglish (English letters)!\n` +
      `6. KEEP IT SHORT & PUNCHY (ছোট ও চটপটে উত্তর): Maximum 1 to 2 short lines (10-20 words max). Never over-explain or write paragraphs!\n` +
      `7. MAX 1-2 EMOJIS (মানানসই ১-২ টা ইমোজি): Never spam emojis.\n` +
      `8. NO MARKDOWN & NO ROBOTIC PREFIXES: Output plain natural human text only.`
  };

  const apiMessages = [
    systemPrompt
  ];

  for (const item of threadHistory) {
    if (item.role === "assistant") {
      apiMessages.push({
        role: "assistant",
        content: item.content || ""
      });
    } else {
      const sName = item.senderName || "User";
      const sID = (item.senderID && item.senderID !== "Unknown") ? ` (ID: ${item.senderID})` : "";
      apiMessages.push({
        role: "user",
        content: `[Sender: ${sName}${sID}]: ${item.content || ""}`
      });
    }
  }

  const currentFormatted = `[Sender: ${senderName} (ID: ${senderID})]: ${currentQuery}`;
  const lastInHistory = apiMessages[apiMessages.length - 1];

  if (!lastInHistory || lastInHistory.content !== currentFormatted) {
    apiMessages.push({
      role: "user",
      content: currentFormatted
    });
  }

  // Smart Context Safety Trimmer: Ensure total text length never exceeds 8,000 characters (~2000 tokens)
  let totalChars = apiMessages.reduce((sum, m) => sum + (m.content ? m.content.length : 0), 0);
  while (totalChars > 8000 && apiMessages.length > 2) {
    const removed = apiMessages.splice(1, 1)[0];
    if (removed && removed.content) {
      totalChars -= removed.content.length;
    }
  }

  let aiReply = await callOneHopAPI(apiMessages, activeModel);

  // Check for AI Agent Action: [ACTION:nickname(name="...")]
  const nicknameActionMatch = aiReply.match(/\[ACTION:nickname\(name=["'](.*?)["']\)]/i);
  if (nicknameActionMatch) {
    const newNickname = nicknameActionMatch[1] ? nicknameActionMatch[1].trim() : "";
    
    // Determine target User ID (Replied user > Mentioned user > Sender)
    let targetID = ctx.senderID;
    if (replyObj) {
      targetID = String(replyObj.senderID || replyObj.author || replyObj.sender_id || targetID);
    } else if (ctx.event?.mentions && Object.keys(ctx.event.mentions).length > 0) {
      targetID = Object.keys(ctx.event.mentions)[0];
    }

    // Execute Facebook API Nickname change
    if (bot?.api?.changeNickname && threadID) {
      bot.api.changeNickname(newNickname, threadID, targetID, (err) => {
        if (err) {
          console.warn("AI Agent failed to change nickname:", err.message);
        } else {
          console.log(`🤖 [AI Agent Action] Changed nickname for User ${targetID} to "${newNickname}"`);
        }
      });
    }

    // Strip [ACTION:...] tag from user-facing reply
    aiReply = aiReply.replace(/\[ACTION:nickname\(name=["'].*?["']\)]/gi, "").trim();
  }

  // Strip any remaining markdown asterisks/formatting if model still produces them
  aiReply = aiReply.replace(/\*+/g, "").replace(/_+/g, "").trim();

  // Save conversation to history with full JSON metadata
  addHistory(threadID, senderName, senderID, currentQuery, aiReply);

  // Send clean response directly without robotic bot header
  await sendHumanReply(ctx, aiReply);
}

module.exports = {
  name: "ai",
  aliases: ["gpt", "ask", "bot"],
  description: "Ask AI Assistant with custom bot name, personality, context, and history",
  category: "general",

  async execute({ bot, ctx, args, getUserName, sendHumanReply }) {
    try {
      const rawText = args.join(" ").trim();
      await processAIRequest({ bot, ctx, rawText, getUserName, sendHumanReply });
    } catch (err) {
      console.error("AI Command Error:", err.message);
      await sendHumanReply(ctx, `❌ AI রেসপন্স পেতে সমস্যা হয়েছে: ${err.message}`);
    }
  },

  /**
   * Auto-reply handler when someone replies to a bot message directly without typing /ai
   */
  async handleAutoReply({ bot, ctx, getUserName, sendHumanReply }) {
    try {
      const rawText = (ctx.text || "").trim();
      await processAIRequest({ bot, ctx, rawText, getUserName, sendHumanReply });
    } catch (err) {
      console.error("AI AutoReply Error:", err.message);
      await sendHumanReply(ctx, `❌ AI রেসপন্স পেতে সমস্যা হয়েছে: ${err.message}`);
    }
  }
};

