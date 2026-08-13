module.exports = {
  name: "kick",
  aliases: ["remove"],
  description: "Remove member from group with Admin & Super Admin protections",
  category: "admin",
  async execute({ bot, ctx, args, getThreadAdminIDs, SUPER_ADMIN_ID, getUserName, isBotAdmin, sendHumanReply }) {
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
        return await sendHumanReply(ctx, "⚠️ কার মেসেজে রিপ্লাই দিয়ে অথবা কাকে ট্যাগ করে /kick করবেন তা উল্লেখ করুন!");
      }

      // Check if bot itself is admin first
      if (isBotAdmin) {
        const hasAdminPermission = await isBotAdmin(ctx.threadID);
        if (!hasAdminPermission) {
          return await sendHumanReply(ctx, "⚠️ আমি এই গ্রুপে এডমিন (Admin) নই! কিক বা রিমুভ করার জন্য আমাকে আগে গ্রুপ এডমিন বানিয়ে দিন।");
        }
      }

      // Handle "/kick me"
      if (String(targetID).toLowerCase() === "me") {
        targetID = String(ctx.senderID);
      }

      const botID = String(bot.api?.getCurrentUserID());
      const senderIDStr = String(ctx.senderID);
      const targetIDStr = String(targetID);

      // 1. Cannot kick the bot itself
      if (targetIDStr === botID) {
        return await sendHumanReply(ctx, "🤖 আমাকে কিক দেওয়া সম্ভব নয়!");
      }

      // 2. Self-kick bypass: If kicking oneself (/kick me), allow even for normal members
      if (targetIDStr === senderIDStr) {
        const targetName = await getUserName(bot, targetID);
        return bot.api.removeUserFromGroup(targetID, ctx.threadID, async (kickErr) => {
          if (kickErr) {
            return await sendHumanReply(ctx, "⚠️ আমাকে এই গ্রুপে এডমিন (Admin) বানিয়ে দিন! এডমিন পারমিশন ছাড়া কাউকে রিমুভ করতে পারছি না।");
          }
          await sendHumanReply(ctx, `🚪 ${targetName} নিজেকে গ্রুপ থেকে কিক করে নিয়েছে!`);
        });
      }

      // 3. Permission checks: Fetch thread admin IDs
      const adminIDs = await getThreadAdminIDs(ctx.threadID);
      const isSenderSuperAdmin = senderIDStr === SUPER_ADMIN_ID;
      const isSenderThreadAdmin = adminIDs.includes(senderIDStr);
      const isSenderAdmin = isSenderSuperAdmin || isSenderThreadAdmin;

      // Sender must be Group Admin or Super Admin
      if (!isSenderAdmin) {
        return await sendHumanReply(ctx, "⚠️ আপনার এই কমান্ড ব্যবহার করার পারমিশন নেই! (শুধুমাত্র গ্রুপ এডমিন কিক করতে পারবেন)");
      }

      // 4. Target protections:
      const isTargetSuperAdmin = targetIDStr === SUPER_ADMIN_ID;
      const isTargetThreadAdmin = adminIDs.includes(targetIDStr);

      if (isTargetSuperAdmin && !isSenderSuperAdmin) {
        return await sendHumanReply(ctx, "🛡️ সুপার এডমিনকে কিক দেওয়া সম্ভব নয়!");
      }

      if (isTargetThreadAdmin && !isSenderSuperAdmin) {
        return await sendHumanReply(ctx, "🛡️ গ্রুপ এডমিনকে কিক দেওয়া সম্ভব নয়! (শুধুমাত্র সুপার এডমিন পারবেন)");
      }

      // Perform Kick directly via Facebook API
      const targetName = await getUserName(bot, targetID);
      bot.api.removeUserFromGroup(targetID, ctx.threadID, async (kickErr) => {
        if (kickErr) {
          console.error("Kick error:", kickErr);
          return await sendHumanReply(ctx, "⚠️ আমাকে এই গ্রুপে এডমিন (Admin) বানিয়ে দিন! এডমিন পারমিশন ছাড়া কিক করা সম্ভব নয়।");
        }
        await sendHumanReply(ctx, `👢 ${targetName}-কে গ্রুপ থেকে রিমুভ করা হয়েছে!`);
      });
    } catch (err) {
      console.error("Kick error:", err.message);
    }
  }
};
