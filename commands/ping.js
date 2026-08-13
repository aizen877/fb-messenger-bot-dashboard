module.exports = {
  name: "ping",
  aliases: [],
  description: "Check bot response status",
  category: "general",
  async execute({ ctx, sendHumanReply }) {
    await sendHumanReply(ctx, "🏓 Pong! Bot is active and running smoothly.");
  }
};
