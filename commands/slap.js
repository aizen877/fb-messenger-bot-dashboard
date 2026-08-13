module.exports = {
  name: "slap",
  aliases: ["thappor", "mar"],
  description: "Virtually slap a group member with a funny reason",
  category: "fun",
  async execute({ bot, ctx, getUserName, sendHumanReply }) {
    try {
      let targetID = null;
      const replyObj = ctx.event?.messageReply || ctx.event?.message_reply;

      if (replyObj) {
        targetID = String(replyObj.senderID || replyObj.author || replyObj.sender_id);
      } else if (ctx.event?.mentions && Object.keys(ctx.event.mentions).length > 0) {
        targetID = Object.keys(ctx.event.mentions)[0];
      }

      if (!targetID) {
        return await sendHumanReply(ctx, "🖐️ কাকে থাপ্পড় মারবেন? কার মেসেজে রিপ্লাই দিন অথবা মেনশন করুন!");
      }

      const senderName = await getUserName(ctx.senderID);
      const targetName = await getUserName(targetID);

      const reasons = [
        "গ্রুপে বেশি ভাব নেওয়ার জন্য! 😂",
        "সবাইকে পঁচানোর জন্য! 🤣",
        "সিন করে রিপ্লাই না দেওয়ার অপরাধে! 😜",
        "ফালতু কথা বলার জন্য! 🖐️💥",
        "গ্রুপে এসে অফলাইন হয়ে যাওয়ার জন্য! 😴"
      ];

      const randomReason = reasons[Math.floor(Math.random() * reasons.length)];
      const msg = `🖐️💥 ${senderName} সজোরে একটি ভার্চুয়াল থাপ্পড় মারলো ${targetName}-কে!\n📌 কারণ: ${randomReason}`;

      await sendHumanReply(ctx, msg);
    } catch (err) {
      console.error("Slap command error:", err.message);
    }
  }
};
