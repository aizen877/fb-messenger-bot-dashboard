const { getActiveModel } = require("../utils/modelStore");

const ONEHOP_API_KEY = process.env.ONEHOP_API_KEY || "oh_live_Bwr_9HiuHkEkgzqWjgC0_TGigbFUGHjZ";
const ONEHOP_API_URL = "https://api.onehop.ai/v1/chat/completions";

module.exports = {
  name: "roast",
  aliases: ["roastme", "paka"],
  description: "Funny & witty Bangladeshi roast for a group member",
  category: "fun",
  async execute({ bot, ctx, args, getUserName, sendHumanReply }) {
    try {
      let targetID = ctx.senderID;
      const replyObj = ctx.event?.messageReply || ctx.event?.message_reply;

      if (replyObj) {
        targetID = String(replyObj.senderID || replyObj.author || replyObj.sender_id || targetID);
      } else if (ctx.event?.mentions && Object.keys(ctx.event.mentions).length > 0) {
        targetID = Object.keys(ctx.event.mentions)[0];
      }

      const targetName = await getUserName(targetID);
      const senderName = await getUserName(ctx.senderID);

      const systemPrompt = {
        role: "system",
        content: 
          "You are Boltu, a hilarious Bangladeshi group chat member. Generate a short, super funny, light-hearted roast in natural Bangladeshi slang (like 'আরে ভাই', 'হাহা', 'শোন', 'ভাব মারতেছিস'). Keep it strictly friendly, funny, and 1 to 2 sentences max. Do NOT use markdown symbols."
      };

      const messages = [
        systemPrompt,
        { role: "user", content: `Generate a funny friendly roast for ${targetName} requested by ${senderName}.` }
      ];

      let roastText = "";
      try {
        const res = await fetch(ONEHOP_API_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${ONEHOP_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: getActiveModel(ctx.threadID),
            messages: messages
          })
        });
        const data = await res.json();
        if (data.choices?.[0]?.message?.content) {
          roastText = data.choices[0].message.content.replace(/\*+/g, "").trim();
        }
      } catch (e) {
        // Fallback static funny roasts
        const fallbacks = [
          `${targetName} ভাই তো প্রতিদিন মেসেঞ্জারে অনলাইন থাকে, মনে হয় ফেসবুকেই তার বাসা-বাড়ি! 😂`,
          `আরে ${targetName}, তোমার ভাব দেখে তো মনে হয় তুমি গ্রুপের এডমিন, অথচ কাজের বেলায় জিরো! 🤣`,
          `${targetName} কথা বলে এমনভাবে যেন সব বুঝে, অথচ কাজের বেলায় আলু ভর্তা! 😜`
        ];
        roastText = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      }

      await sendHumanReply(ctx, `🔥 ${roastText}`);
    } catch (err) {
      console.error("Roast command error:", err.message);
      await sendHumanReply(ctx, "🔥 আরে ভাই রোস্ট বানাতে গিয়ে আগুন লেগে গেছে! 😂");
    }
  }
};
