const { AVAILABLE_MODELS, DEFAULT_MODEL, getActiveModel, setActiveModel, resetModel } = require("../utils/modelStore");
const { formatTree } = require("../utils/helpers");

module.exports = {
  name: "model",
  aliases: ["models", "setmodel", "aimodel"],
  description: "View available AI models and change the active model for this thread",
  category: "ai",
  async execute({ bot, ctx, args, sendHumanReply }) {
    try {
      const threadID = ctx.threadID || "default_thread";
      const currentActive = getActiveModel(threadID);
      const subCommand = (args[0] || "").toLowerCase().trim();

      // Case 1: /model reset
      if (subCommand === "reset") {
        resetModel(threadID);
        return await sendHumanReply(
          ctx,
          `🔄 AI মডেল রিসেট করা হয়েছে!\nবর্তমান অ্যাক্টিভ মডেল: ${DEFAULT_MODEL}`
        );
      }

      // Case 2: /model set <1-6 or modelName> or /model <1-6 or modelName>
      let targetInput = subCommand === "set" ? (args[1] || "").trim() : subCommand;

      if (targetInput) {
        // Match by index (1, 2, 3...) or partial/exact model name
        const matchedModel = AVAILABLE_MODELS.find(
          (m) => m.id === targetInput || m.name.toLowerCase().includes(targetInput.toLowerCase())
        );

        if (matchedModel) {
          setActiveModel(threadID, matchedModel.name);
          return await sendHumanReply(
            ctx,
            `✅ সফলভাবে AI মডেল পরিবর্তন করা হয়েছে!\n\n📌 নতুন মডেল: ${matchedModel.label}\n🆔 System ID: ${matchedModel.name}`
          );
        } else if (subCommand !== "list") {
          // If custom raw model name was entered directly (e.g. /model openai/gpt-4o)
          if (targetInput.includes("/")) {
            setActiveModel(threadID, targetInput);
            return await sendHumanReply(
              ctx,
              `✅ কাস্টম AI মডেল সেট করা হয়েছে!\n\n📌 মডেল: ${targetInput}`
            );
          }
        }
      }

      // Case 3: Display Available Models List via formatTree
      const modelItems = AVAILABLE_MODELS.map((m) => {
        const isCurrent = m.name === currentActive ? " 👈 [Active]" : "";
        return `[${m.id}] ${m.label}${isCurrent}`;
      });

      const mainTitle = "🤖 AI MODEL CONFIGURATION";
      const sections = [
        {
          title: "Active Selection",
          items: [
            `Current Model: ${currentActive}`
          ]
        },
        {
          title: "Available AI Models",
          items: modelItems
        }
      ];
      const footer = "💡 Usage: /model <number> (e.g. /model 2) | Reset: /model reset";

      const listMsg = formatTree(mainTitle, sections, footer);

      await sendHumanReply(ctx, listMsg);
    } catch (err) {
      console.error("Model command error:", err.message);
      await sendHumanReply(ctx, `❌ মডেল সেন্ড/চেঞ্জ করতে সমস্যা হয়েছে: ${err.message}`);
    }
  }
};

