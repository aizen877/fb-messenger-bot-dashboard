const fs = require("fs");
const path = require("path");

module.exports = {
  name: "help",
  aliases: ["menu", "commands"],
  description: "Display all available bot commands categorized nicely",
  category: "general",
  async execute({ ctx, commandPrefix, sendHumanReply }) {
    try {
      const commandsDir = path.join(__dirname, "../commands");
      const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith(".js"));

      const categories = {
        general: [],
        ai: [],
        fun: [],
        group: [],
        admin: []
      };

      for (const file of files) {
        try {
          const cmd = require(path.join(commandsDir, file));
          if (cmd && cmd.name && cmd.description) {
            const cat = (cmd.category || "general").toLowerCase();
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(cmd);
          }
        } catch (e) {}
      }

      let helpMsg = `🤖 *Messenger Bot Commands Menu*\n📌 Prefix: "${commandPrefix}"\n\n`;

      const aiAndFun = [...(categories.ai || []), ...(categories.fun || [])];
      if (aiAndFun.length > 0) {
        helpMsg += `🧠 *AI & Fun Commands:*\n`;
        aiAndFun.forEach((c) => {
          helpMsg += `• ${commandPrefix}${c.name} - ${c.description}\n`;
        });
        helpMsg += `\n`;
      }

      if (categories.group && categories.group.length > 0) {
        helpMsg += `👥 *Group Commands:*\n`;
        categories.group.forEach((c) => {
          helpMsg += `• ${commandPrefix}${c.name} - ${c.description}\n`;
        });
        helpMsg += `\n`;
      }

      if (categories.admin && categories.admin.length > 0) {
        helpMsg += `👑 *Admin Commands:*\n`;
        categories.admin.forEach((c) => {
          helpMsg += `• ${commandPrefix}${c.name} - ${c.description}\n`;
        });
        helpMsg += `\n`;
      }

      if (categories.general && categories.general.length > 0) {
        helpMsg += `📌 *General Utilities:*\n`;
        categories.general.forEach((c) => {
          helpMsg += `• ${commandPrefix}${c.name} - ${c.description}\n`;
        });
      }

      helpMsg += `\n💡 বোটের যেকোনো মেসেজে সরাসরি Reply দিয়ে কথা বলতে পারেন!`;

      await sendHumanReply(ctx, helpMsg);
    } catch (err) {
      console.error("Help command error:", err.message);
    }
  }
};
