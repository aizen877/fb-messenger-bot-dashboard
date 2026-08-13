module.exports = {
  name: "ship",
  aliases: ["couple", "pair"],
  description: "Pair up two tagged/replied members or random group members into a funny couple",
  category: "fun",
  async execute({ bot, ctx, getThreadDetails, getUserName, sendHumanReply }) {
    try {
      const threadID = ctx.threadID;
      if (!threadID) {
        return await sendHumanReply(ctx, "❌ এই কমান্ডটি ফেসবুক গ্রুপে ব্যবহার করুন!");
      }

      let user1ID = null;
      let user2ID = null;

      const mentions = ctx.event?.mentions ? Object.keys(ctx.event.mentions) : [];
      const replyObj = ctx.event?.messageReply || ctx.event?.message_reply;

      if (mentions.length >= 2) {
        user1ID = mentions[0];
        user2ID = mentions[1];
      } else if (mentions.length === 1) {
        user1ID = ctx.senderID;
        user2ID = mentions[0];
      } else if (replyObj) {
        user1ID = ctx.senderID;
        user2ID = String(replyObj.senderID || replyObj.author || replyObj.sender_id);
      } else {
        // Pick random members from thread details
        const details = await getThreadDetails(bot, threadID);
        const members = details.participantIDs || [];

        if (members.length < 2) {
          return await sendHumanReply(ctx, "⚠️ জুড়ি বানানোর জন্য ২ জনকে ট্যাগ করুন (যেমন: /ship @User1 @User2) অথবা মেসেজে রিপ্লাই দিন!");
        }

        const idx1 = Math.floor(Math.random() * members.length);
        let idx2 = Math.floor(Math.random() * members.length);
        while (idx2 === idx1 && members.length > 1) {
          idx2 = Math.floor(Math.random() * members.length);
        }

        user1ID = members[idx1];
        user2ID = members[idx2];
      }

      const user1Name = await getUserName(user1ID);
      const user2Name = await getUserName(user2ID);

      const matchScore = Math.floor(Math.random() * 41) + 60; // 60% - 100%

      const msg = 
        `👩‍❤️‍👨 *Group Couple of the Day* 👩‍❤️‍👨\n\n` +
        `আজকের সেরাজুটি:\n` +
        `💖 ${user1Name} + ${user2Name}\n\n` +
        `📊 *Match Compatibility:* ${matchScore}%\n` +
        `🎉 সবাই মিলে এই জুটিকে শুভেচ্ছা জানান! 😂🔥`;

      await sendHumanReply(ctx, msg);
    } catch (err) {
      console.error("Ship command error:", err.message);
    }
  }
};
