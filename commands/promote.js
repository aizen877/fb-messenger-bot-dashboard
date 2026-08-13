module.exports = {
  name: "promote",
  aliases: ["addadmin", "makeadmin"],
  description: "Promote member to Group Admin",
  category: "admin",
  async execute({ bot, ctx, args, getThreadAdminIDs, SUPER_ADMIN_ID, getUserName, sendHumanReply }) {
    try {
      let targetID = null;
      const replyObj = ctx.event?.messageReply || ctx.event?.message_reply;

      if (replyObj) {
        targetID = String(replyObj.senderID || replyObj.author || replyObj.sender_id);
      } else if (ctx.event?.mentions && Object.keys(ctx.event.mentions).length > 0) {
        targetID = Object.keys(ctx.event.mentions)[0];
      } else if (args[0]) {
        targetID = args[0].trim();
      }

      if (!targetID) {
        return await sendHumanReply(ctx, "⚠️ কার মেসেজে রিপ্লাই দিয়ে অথবা কাকে ট্যাগ করে /promote করবেন তা উল্লেখ করুন!");
      }

      const senderIDStr = String(ctx.senderID);
      const adminIDs = await getThreadAdminIDs(ctx.threadID);
      const isSenderSuperAdmin = senderIDStr === SUPER_ADMIN_ID;
      const isSenderThreadAdmin = adminIDs.includes(senderIDStr);

      if (!isSenderSuperAdmin && !isSenderThreadAdmin) {
        return await sendHumanReply(ctx, "⚠️ আপনার এই কমান্ড ব্যবহার করার পারমিশন নেই! (শুধুমাত্র গ্রুপ এডমিন এডমিন বানাতে পারবেন)");
      }

      const targetName = await getUserName(targetID);
      bot.api.changeAdminStatus(ctx.threadID, targetID, true, async (adminErr) => {
        if (adminErr) {
          console.error("Promote error:", adminErr);
          return await sendHumanReply(ctx, "⚠️ আপনার অথবা বোটের পারমিশন নাই!");
        }
        await sendHumanReply(ctx, `👑 ${targetName} কে গ্রুপের এডমিন (Admin) করা হয়েছে!`);
      });
    } catch (err) {
      console.error("Promote error:", err.message);
    }
  }
};
