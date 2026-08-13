module.exports = {
  name: "adminlist",
  aliases: ["admins", "admin"],
  description: "Fetch and list all admins of the current group",
  category: "group",
  async execute({ bot, ctx, getThreadDetails, getUserName, sendHumanReply }) {
    try {
      const threadID = ctx.threadID;
      if (!threadID) {
        return await sendHumanReply(ctx, "❌ এই কমান্ডটি শুধুমাত্র ফেসবুক গ্রুপ চ্যাটে কাজ করবে!");
      }

      const details = await getThreadDetails(threadID);
      const adminIDs = details.adminIDs || [];

      if (!adminIDs || adminIDs.length === 0) {
        return await sendHumanReply(ctx, "⚠️ কোনো এডমিন তালিকা পাওয়া যায়নি অথবা এটি একটি পার্সোনাল চ্যাট।");
      }

      const adminNames = [];
      for (let i = 0; i < adminIDs.length; i++) {
        const uid = adminIDs[i];
        const name = await getUserName(uid);
        adminNames.push(`${i + 1}. ${name} [${uid}]`);
      }

      const replyMsg = 
        `🛡️ *Group Admin List (${adminIDs.length})*\n` +
        `📌 *Group:* ${details.name}\n\n` +
        adminNames.join("\n");

      await sendHumanReply(ctx, replyMsg);
    } catch (err) {
      console.error("Adminlist error:", err.message);
      await sendHumanReply(ctx, `❌ এডমিন লিস্ট আনতে সমস্যা হয়েছে: ${err.message}`);
    }
  }
};
