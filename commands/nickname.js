module.exports = {
  name: "nickname",
  aliases: ["setname"],
  description: "Change member's nickname in group",
  category: "admin",
  async execute({ bot, ctx, args, getUserName, sendHumanReply }) {
    try {
      let targetID = ctx.senderID;
      let newName = "";

      const replyObj = ctx.event?.messageReply || ctx.event?.message_reply;
      if (replyObj) {
        targetID = String(replyObj.senderID || replyObj.author || replyObj.sender_id || targetID);
        newName = ctx.text?.replace(/^\/\w+\s*/, "").trim() || "";
      } else {
        newName = args.join(" ");
      }

      const targetName = await getUserName(targetID);
      bot.api.changeNickname(newName, ctx.threadID, targetID, async (err) => {
        if (err) {
          return await sendHumanReply(ctx, "❌ নিকনেম পরিবর্তন করতে ব্যর্থ হয়েছে।");
        }
        await sendHumanReply(ctx, `✏️ ${targetName} এর নিকনেম পরিবর্তন করে "${newName || "ডিফল্ট নাম"}" রাখা হয়েছে।`);
      });
    } catch (err) {
      console.error("Nickname error:", err.message);
    }
  }
};
