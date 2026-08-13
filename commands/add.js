module.exports = {
  name: "add",
  aliases: [],
  description: "Add user to group by User ID",
  category: "admin",
  async execute({ bot, ctx, args, getUserName, sendHumanReply }) {
    try {
      const targetID = args[0]?.trim();

      if (!targetID) {
        return await sendHumanReply(ctx, "⚠️ Please provide User ID to add. Example: /add 100093356786348");
      }

      const targetName = await getUserName(targetID);
      bot.api.addUserToGroup(targetID, ctx.threadID, async (err) => {
        if (err) {
          return await sendHumanReply(ctx, `❌ এড করতে ব্যর্থ হয়েছে।`);
        }
        await sendHumanReply(ctx, `✅ ${targetName} কে গ্রুপে যুক্ত করা হয়েছে!`);
      });
    } catch (err) {
      console.error("Add error:", err.message);
    }
  }
};
