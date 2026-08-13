module.exports = {
  name: "settitle",
  aliases: ["groupname"],
  description: "Change group name/title",
  category: "admin",
  async execute({ bot, ctx, args, sendHumanReply }) {
    try {
      const newTitle = args.join(" ").trim();
      if (!newTitle) {
        return await sendHumanReply(ctx, "⚠️ Please provide a new title. Example: /settitle Friends Club");
      }

      bot.api.setTitle(newTitle, ctx.threadID, async (err) => {
        if (err) {
          return await sendHumanReply(ctx, "❌ Failed to change group title.");
        }
        await sendHumanReply(ctx, `📝 Group title changed to: "${newTitle}"`);
      });
    } catch (err) {
      console.error("SetTitle error:", err.message);
    }
  }
};
