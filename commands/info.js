const { formatTree } = require("../utils/helpers");

module.exports = {
  name: "info",
  aliases: [],
  description: "Display bot system info",
  category: "general",
  async execute({ bot, ctx, sendHumanReply }) {
    const botID = bot.api?.getCurrentUserID() || "Unknown";
    const mainTitle = "ℹ️ BOT SYSTEM INFO";
    const sections = [
      {
        title: "Session Status",
        items: [
          `Logged In ID: ${botID}`,
          `Status: Online & Active 🟢`
        ]
      },
      {
        title: "Security & Anti-Detection",
        items: [
          `Stealth Mode: Enabled 🛡️`,
          `Human Delay Caching: Active ⏱️`,
          `Rate-Limit Guard: Active ⚡`
        ]
      }
    ];
    const infoMsg = formatTree(mainTitle, sections);
    await sendHumanReply(ctx, infoMsg);
  }
};

