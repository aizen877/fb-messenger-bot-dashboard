const fs = require("fs");
const path = require("path");
const { formatTree } = require("../utils/helpers");

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

      const mainTitle = `🤖 MESSENGER BOT COMMANDS MENU\nPrefix: "${commandPrefix}"`;
      const sections = [];

      const aiAndFun = [...(categories.ai || []), ...(categories.fun || [])];
      if (aiAndFun.length > 0) {
        sections.push({
          title: "AI & Fun Commands",
          items: aiAndFun.map((c) => `${commandPrefix}${c.name} - ${c.description}`)
        });
      }

      if (categories.group && categories.group.length > 0) {
        sections.push({
          title: "Group Commands",
          items: categories.group.map((c) => `${commandPrefix}${c.name} - ${c.description}`)
        });
      }

      if (categories.admin && categories.admin.length > 0) {
        sections.push({
          title: "Admin Commands",
          items: categories.admin.map((c) => `${commandPrefix}${c.name} - ${c.description}`)
        });
      }

      if (categories.general && categories.general.length > 0) {
        sections.push({
          title: "General Utilities",
          items: categories.general.map((c) => `${commandPrefix}${c.name} - ${c.description}`)
        });
      }

      const footer = "💡 Tip: বোটের যেকোনো মেসেজে সরাসরি Reply দিয়ে যা ইচ্ছা জিজ্ঞেস করুন!";
      const helpMsg = formatTree(mainTitle, sections, footer);

      await sendHumanReply(ctx, helpMsg);
    } catch (err) {
      console.error("Help command error:", err.message);
    }
  }
};

