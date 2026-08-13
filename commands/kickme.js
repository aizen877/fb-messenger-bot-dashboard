module.exports = {
  name: "kickme",
  aliases: ["leaveme"],
  description: "User kicks themselves from the group",
  category: "general",
  async execute({ bot, ctx, getUserName, sendHumanReply }) {
    try {
      const targetID = String(ctx.senderID);
      const targetName = await getUserName(targetID);
      bot.api.removeUserFromGroup(targetID, ctx.threadID, async (kickErr) => {
        if (kickErr) {
          console.error("Kickme error:", kickErr);
          return await sendHumanReply(ctx, "⚠️ আমার পারমিশন নাই! (বোটকে এডমিন বানিয়ে দিন)");
        }
        await sendHumanReply(ctx, `🚪 ${targetName} নিজেকে গ্রুপ থেকে কিক করে নিয়েছে!`);
      });
    } catch (err) {
      console.error("Kickme error:", err.message);
    }
  }
};
