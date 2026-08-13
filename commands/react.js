module.exports = {
  name: "react",
  aliases: [],
  description: "React to message",
  category: "general",
  async execute({ bot, ctx, sendHumanReply }) {
    try {
      if (bot.client?.messages?.setReaction) {
        await bot.client.messages.setReaction("😍", ctx.messageID);
      } else if (bot.api?.setMessageReaction) {
        bot.api.setMessageReaction("😍", ctx.messageID, () => {});
      }
      await sendHumanReply(ctx, "Reacted to your message! ❤️");
    } catch (err) {
      console.error("Failed to react:", err.message);
    }
  }
};
