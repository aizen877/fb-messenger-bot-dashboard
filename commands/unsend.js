module.exports = {
  name: "unsend",
  aliases: [],
  description: "Unsend replied message",
  category: "general",
  async execute({ bot, ctx, sendHumanReply }) {
    try {
      const replyObj = ctx.event?.messageReply || ctx.event?.message_reply;
      if (!replyObj?.messageID) {
        return await sendHumanReply(ctx, "⚠️ Please reply to the message you want to unsend!");
      }

      const targetMsgID = replyObj.messageID;
      bot.api.unsendMessage(targetMsgID, async (err) => {
        if (err) {
          return await sendHumanReply(ctx, "❌ Failed to unsend message (can only unsend bot's own messages).");
        }
      });
    } catch (err) {
      console.error("Unsend error:", err.message);
    }
  }
};
