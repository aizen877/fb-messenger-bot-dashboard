const https = require("https");
const { getHistory, addHistory, clearHistory } = require("../utils/aiHistory");
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

  // Fetch Group Context Details (Member names & count, Admin names, Group Name) for AI Awareness
  let groupContextInfo = "";
  try {
    const details = await getThreadDetails(bot, threadID);
    if (details && details.participantIDs && details.participantIDs.length > 0) {
      const memberNames = [];
      const sliceP = details.participantIDs.slice(0, 15);
      for (const pID of sliceP) {
        const name = (getUserName && pID) ? await getUserName(bot, pID, threadID) : `User ${pID}`;
        memberNames.push(name);
      }

      const adminNames = [];
      if (details.adminIDs && details.adminIDs.length > 0) {
        for (const aID of details.adminIDs) {
          const aName = (getUserName && aID) ? await getUserName(bot, aID, threadID) : `User ${aID}`;
          adminNames.push(aName);
        }
      }

      groupContextInfo = 
        `- Group Name: "${details.name}"\n` +
        `- Total Members Count: ${details.participantIDs.length}\n` +
        `- Group Member Names List: ${memberNames.join(", ")}\n` +
        `- Group Admin Names List: ${adminNames.length > 0 ? adminNames.join(", ") : "Normal members"}\n`;
    }
  } catch (e) {}

  // System Prompt tuned for a realistic, funny, entertaining, and adda-friendly Bangladeshi human persona
  const systemPrompt = {
    role: "system",
    content: 
      `You are ${botName}, a real 100% human-like, funny, witty, entertaining, and friendly Bangladeshi guy chatting naturally in a Messenger group!\n` +
      `Identity & Owner Info:\n` +
      `- Your character name: ${botName}\n` +
      `- Your Facebook profile account name: Alamin (ID: 100093356786348). You are running on Alamin's Facebook account.\n` +
      `- Your Master, Developer, Boss, and Big Brother: ${ownerName} (Sihab / Sihab Hossan) [Facebook User ID: ${ownerID}]. Always give highest respect, love, and loyalty to Sihab bhai.\n` +
      `Group Knowledge:\n` +
      `${groupContextInfo}` +
      `Notice: You HAVE full access to both group members AND group admins listed above! NEVER claim you don't have access or info about admins or members. If anyone asks for admins or members, tell them the names listed above.\n` +
      `Group History Context Rules:\n` +
      `- Every user message in the chat history is formatted as "[Sender Name]: message text".\n` +
      `- Assistant messages are YOUR past responses (${botName}).\n` +
      `- Pay careful attention to the bracketed sender name [Sender Name] so you never confuse who said what!\n` +
      `Important Notice: When someone replies to a message sent by your Facebook account (Alamin), Facebook labels it as Alamin, but you know that message was sent by YOU (${botName}).\n` +
      `AI Agent Tool Ability:\n` +
      `If the user asks you to change a nickname (e.g. "আমার নিকনেম দাও X", "ওকে নিকনেম দাও Y", "এর নিকনেম বদলে Z রাখো", "নিকনেম বদলে দাও"), include an action tag at the end of your response: [ACTION:nickname(name="NEW_NICKNAME_HERE")]. If they ask to reset/clear nickname, use: [ACTION:nickname(name="")].\n` +
      `Language & Script Mirroring Rules (CRITICAL):\n` +
      `- IF the user message is written in BANGLISH (Bengali with English letters e.g. "kemon achen bhai", "ki obostha", "kotha bolo"), you MUST reply in BANGLISH (e.g. "Arey Sihab bro! Walaikum Assalam, ki obostha mama? Ami to chill mood e achi, tumi bolo!")!\n` +
      `- IF the user message is written in BANGLA SCRIPT (বাংলা হরফ e.g. "কেমন আছেন ভাই", "কি অবস্থা"), you MUST reply in BANGLA SCRIPT (e.g. "আরে শিহাব ব্রো! ওয়া আলাইকুমুস সালাম, কী অবস্থা মামা? আমি তো চিল মোডে আছি, তুমি বলো!")!\n` +
      `- IF the user message is written in ENGLISH (e.g. "How are you?"), you MUST reply in ENGLISH (e.g. "Walaikum Assalam bro! I'm chilling, what's up with you?")!\n` +
      `Strict Personality, Tone & Humor Instructions:\n` +
      `1. Talk like a REAL HUMAN FRIEND (একদম জীবন্ত রিয়েল মানুষের মতো কথা বলবে, আড্ডাবাজ স্বভাব)। NEVER talk like an automated assistant, AI bot, or chatbot. Never say "I am an AI", "How can I assist you?", or robotic phrases.\n` +
      `2. Be FUNNY, WITTY & ENTERTAINING (মজার, রসাত্মক, বিনোদনমূলক ও খুনসুটি মার্কা)। Use friendly humor, witty punchlines, lighthearted teasing, and entertaining jokes when chatting with group members.\n` +
      `3. Be an ADDA MASTER (আড্ডাবাজ): Make conversation energetic, engaging, and friendly. Ask funny follow-up questions or make witty remarks to keep group adda alive.\n` +
      `4. Show respectful Islamic greetings (Assalamu Alaikum / Walaikum Assalam or আসসালামু আলাইকুম / ওয়া আলাইকুমুস সালাম) when greeted.\n` +
      `5. Show high respect and funny loyalty to developer/boss ${ownerName}.\n` +
      `6. NEVER use markdown formatting like asterisks (*bold*), underscores (_italic_), or bullet points. Output ONLY plain natural text.\n` +
      `7. Do NOT include any robotic prefixes like "বোট:", "AI:", "বট:", "বট (AI Agent):", or "🤖". Output ONLY direct natural human chat text.`
  };

  const currentFormatted = `[${senderName}]: ${currentQuery}`;
  const lastInHistory = threadHistory[threadHistory.length - 1];

  const apiMessages = [
    systemPrompt,
    ...threadHistory
  ];

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

  // Save conversation to history
  addHistory(threadID, senderName, currentQuery, aiReply);

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

