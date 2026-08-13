const fs = require("fs");
const path = require("path");
const { sendHumanReply } = require("../utils/antiDetect");

/**
 * Dynamically loads and registers all keyword/hears handlers from the hears directory
 * @param {object} bot - MessengerBot instance
 */
function loadHears(bot) {
  const hearsDir = path.join(__dirname, "../hears");
  if (!fs.existsSync(hearsDir)) {
    console.warn("⚠️ Hears directory does not exist:", hearsDir);
    return;
  }

  const files = fs.readdirSync(hearsDir).filter((f) => f.endsWith(".js"));
  let loadedCount = 0;

  for (const file of files) {
    try {
      const hearsPath = path.join(hearsDir, file);
      delete require.cache[require.resolve(hearsPath)];
      const item = require(hearsPath);

      if (!item || !item.pattern || typeof item.execute !== "function") {
        console.warn(`⚠️ Invalid hears structure in ${file}. Skipping.`);
        continue;
      }

      bot.hears(item.pattern, async (ctx) => {
        try {
          await item.execute({
            bot,
            ctx,
            sendHumanReply: (c, payload) => sendHumanReply(bot, c || ctx, payload)
          });
        } catch (err) {
          console.error(`❌ Error executing hears handler ${file}:`, err.message);
        }
      });

      loadedCount++;
    } catch (err) {
      console.error(`❌ Failed to load hears file ${file}:`, err.message);
    }
  }

  console.log(`💬 Successfully loaded ${loadedCount} keyword handler(s).`);
}

module.exports = { loadHears };
