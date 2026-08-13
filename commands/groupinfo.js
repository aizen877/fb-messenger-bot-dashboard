module.exports = {
  name: "groupinfo",
  aliases: ["gcinfo", "members", "memberlist"],
  description: "Display group information, total members count, and admin overview",
  category: "group",
  async execute({ bot, ctx, getThreadDetails, getUserName, sendHumanReply }) {
    try {
      const threadID = ctx.threadID;
      if (!threadID) {
        return await sendHumanReply(ctx, "❌ এই কমান্ডটি শুধুমাত্র ফেসবুক গ্রুপ চ্যাটে কাজ করবে!");
      }

      const details = await getThreadDetails(bot, threadID);
      const totalMembers = details.participantIDs ? details.participantIDs.length : 0;
      const totalAdmins = details.adminIDs ? details.adminIDs.length : 0;

      let msg = 
        `👥 *Group Information*\n\n` +
        `📌 *Group Name:* ${details.name}\n` +
        `🆔 *Thread ID:* ${threadID}\n` +
        `👤 *Total Members:* ${totalMembers}\n` +
        `🛡️ *Total Admins:* ${totalAdmins}\n\n`;

      if (details.adminIDs && details.adminIDs.length > 0) {
        msg += `🛡️ *Group Admins:*\n`;
        for (let i = 0; i < details.adminIDs.length; i++) {
          const uID = details.adminIDs[i];
          const uName = await getUserName(uID);
          msg += `• ${uName} (${uID})\n`;
        }
      }

      await sendHumanReply(ctx, msg);
    } catch (err) {
      console.error("Groupinfo command error:", err.message);
      await sendHumanReply(ctx, `❌ গ্রুপ ইনফরমেশন পেতে সমস্যা হয়েছে: ${err.message}`);
    }
  }
};
