const fs = require("fs");
const path = require("path");
const { sendHumanReply } = require("../utils/antiDetect");
const { SUPER_ADMIN_ID, getThreadAdminIDs, getThreadDetails, getUserName, getDetailedUserInfo, isBotAdmin, downloadTempImage, formatTree } = require("../utils/helpers");

/**
 * Dynamically loads and registers all command files from the commands directory
 * @param {object} bot - MessengerBot instance
 * @param {string} commandPrefix - Command prefix (e.g. "/")
 */
function loadCommands(bot, commandPrefix = "/") {
  const commandsDir = path.join(__dirname, "../commands");
  if (!fs.existsSync(commandsDir)) {
    console.warn("⚠️ Commands directory does not exist:", commandsDir);
    return;
  }

  const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith(".js"));
  let loadedCount = 0;
  const registeredTriggers = new Set();

  for (const file of files) {
    try {
      const commandPath = path.join(commandsDir, file);
      // Clear require cache for dynamic reloading support
      delete require.cache[require.resolve(commandPath)];
      const cmd = require(commandPath);

      if (!cmd || !cmd.name || typeof cmd.execute !== "function") {
        console.warn(`⚠️ Invalid command structure in ${file}. Skipping.`);
        continue;
      }

      const names = [cmd.name, ...(cmd.aliases || [])];
      
      names.forEach((cmdName) => {
        const lowerName = cmdName.toLowerCase();
        if (registeredTriggers.has(lowerName)) {
          console.warn(`⚠️ Duplicate command trigger / alias '${lowerName}' in ${file} skipped.`);
          return;
        }
        registeredTriggers.add(lowerName);

        bot.command(lowerName, async (ctx) => {
          try {
            const rawText = ctx.text || "";
            const parts = rawText.split(/\s+/);
            const args = parts.slice(1);

            await cmd.execute({
              bot,
              ctx,
              args,
              commandPrefix,
              sendHumanReply: (c, payload) => sendHumanReply(bot, c || ctx, payload),
              getThreadAdminIDs: (a1, a2) => getThreadAdminIDs(bot, typeof a1 === "string" ? a1 : a2),
              getThreadDetails: (a1, a2) => getThreadDetails(bot, typeof a1 === "string" ? a1 : a2),
              getUserName: (a1, a2, a3) => getUserName(bot, typeof a1 === "string" ? a1 : a2, typeof a2 === "string" ? a2 : a3 || ctx.threadID),
              getDetailedUserInfo: (a1, a2) => getDetailedUserInfo(bot, typeof a1 === "string" ? a1 : a2),
              isBotAdmin: (a1, a2) => isBotAdmin(bot, typeof a1 === "string" ? a1 : a2 || ctx.threadID),
              formatTree,
              SUPER_ADMIN_ID,
              downloadTempImage
            });
          } catch (err) {
            console.error(`❌ Error executing command /${lowerName}:`, err.message);
          }
        });
      });

      loadedCount++;
    } catch (err) {
      console.error(`❌ Failed to load command file ${file}:`, err.message);
    }
  }

  console.log(`📦 Successfully loaded ${loadedCount} command module(s) [${files.length} file(s)].`);
}

module.exports = { loadCommands };
