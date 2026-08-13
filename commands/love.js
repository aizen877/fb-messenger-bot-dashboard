module.exports = {
  name: "love",
  aliases: ["match", "lovecalculator", "juti"],
  description: "Calculate love/friendship compatibility between two group members",
  category: "fun",
  async execute({ bot, ctx, getUserName, sendHumanReply }) {
    try {
      let user1Name = await getUserName(ctx.senderID);
      let user2Name = "";

      const mentions = ctx.event?.mentions ? Object.keys(ctx.event.mentions) : [];
      const replyObj = ctx.event?.messageReply || ctx.event?.message_reply;

      if (replyObj) {
        const replyID = String(replyObj.senderID || replyObj.author || replyObj.sender_id);
        user2Name = await getUserName(replyID);
      } else if (mentions.length >= 2) {
        user1Name = await getUserName(mentions[0]);
        user2Name = await getUserName(mentions[1]);
      } else if (mentions.length === 1) {
        user2Name = await getUserName(mentions[0]);
      } else {
        return await sendHumanReply(ctx, "💕 কার সাথে লাভ পার্সেন্টেজ মাপবেন? কাউকে ট্যাগ করুন বা তার মেসেজে রিপ্লাই দিন!");
      }

      // Generate funny deterministic percentage based on names
      const nameCombo = `${user1Name}${user2Name}`.toLowerCase();
      let score = 0;
      for (let i = 0; i < nameCombo.length; i++) {
        score += nameCombo.charCodeAt(i);
      }
      const percentage = (score % 61) + 40; // Between 40% and 100%

      let statusMsg = "";
      if (percentage > 90) {
        statusMsg = "একদম মেড ফর ইচ আদার! যেন দুই শালিকের অমিলন মিল! 💕🔥";
      } else if (percentage > 75) {
        statusMsg = "দারুণ ম্যাচ! ঝগড়া করলেও এরা একে অপরকে ছাড়া থাকতে পারবে না! 😉";
      } else if (percentage > 60) {
        statusMsg = "মোটামুটি ম্যাচ, তবে একটু যত্ন নিলে সম্পর্কে আগুন জ্বলবে! 💘";
      } else {
        statusMsg = "বন্ধুত্ব হিসেবে ঠিক আছে, তবে প্রেমের আশা কম ভাই! 😂";
      }

      const msg = 
        `💞 *Love Compatibility Meter* 💞\n\n` +
        `👤 ${user1Name} ❤️ ${user2Name}\n` +
        `📊 *Score:* ${percentage}%\n` +
        `💬 *Commentary:* ${statusMsg}`;

      await sendHumanReply(ctx, msg);
    } catch (err) {
      console.error("Love command error:", err.message);
    }
  }
};
