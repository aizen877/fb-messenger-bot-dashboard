module.exports = {
  name: "info",
  aliases: [],
  description: "Display bot system info",
  category: "general",
  async execute({ bot, ctx, sendHumanReply }) {
    const botID = bot.api?.getCurrentUserID() || "Unknown";
    const infoMsg = `ℹ️ *Bot System Info*\n• Logged In ID: ${botID}\n• Status: Online & Active\n• Anti-Detection Caching: Enabled`;
    await sendHumanReply(ctx, infoMsg);
  }
};
