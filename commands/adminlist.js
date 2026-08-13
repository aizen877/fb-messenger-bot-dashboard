const { formatTree } = require("../utils/helpers");

module.exports = {
  name: "adminlist",
  aliases: ["admins", "admin"],
  description: "Fetch and list all admins of the current group",
  category: "group",
  async execute({ ctx, getThreadDetails, getUserName, sendHumanReply, formatTree: ctxFormatTree }) {
    const fmtTree = ctxFormatTree || formatTree;
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

      const adminItems = [];
      for (let i = 0; i < adminIDs.length; i++) {
        const uid = adminIDs[i];
        const name = await getUserName(uid);
        adminItems.push(`${i + 1}. ${name} (${uid})`);
      }

      const sections = [
        {
          title: "Group Overview",
          items: [
            `Group Name: ${details.name || "Chat Thread"}`,
            `Thread ID: ${threadID}`,
            `Total Admins: ${adminIDs.length}`
          ]
        },
        {
          title: "Group Admins",
          items: adminItems
        }
      ];

      const replyMsg = fmtTree("🛡️ GROUP ADMIN LIST", sections);

      await sendHumanReply(ctx, replyMsg);
    } catch (err) {
      console.error("Adminlist error:", err.message);
      await sendHumanReply(ctx, `❌ এডমিন লিস্ট আনতে সমস্যা হয়েছে: ${err.message}`);
    }
  }
};

