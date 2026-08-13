const { formatTree } = require("../utils/helpers");

module.exports = {
  name: "groupinfo",
  aliases: ["gcinfo", "members", "memberlist"],
  description: "Display group information, total members count, and admin overview",
  category: "group",
  async execute({ ctx, getThreadDetails, getUserName, sendHumanReply, formatTree: ctxFormatTree }) {
    const fmtTree = ctxFormatTree || formatTree;
    try {
      const threadID = ctx.threadID;
      if (!threadID) {
        return await sendHumanReply(ctx, "❌ এই কমান্ডটি শুধুমাত্র ফেসবুক গ্রুপ চ্যাটে কাজ করবে!");
      }

      const details = await getThreadDetails(threadID);
      const totalMembers = details.participantIDs ? details.participantIDs.length : 0;
      const totalAdmins = details.adminIDs ? details.adminIDs.length : 0;

      const sections = [
        {
          title: "Basic Details",
          items: [
            `Group Name: ${details.name || "Chat Thread"}`,
            `Thread ID: ${threadID}`,
            `Total Members: ${totalMembers}`,
            `Total Admins: ${totalAdmins}`
          ]
        }
      ];

      if (details.adminIDs && details.adminIDs.length > 0) {
        const adminItems = [];
        for (let i = 0; i < details.adminIDs.length; i++) {
          const uID = details.adminIDs[i];
          const uName = await getUserName(uID);
          adminItems.push(`${i + 1}. ${uName} (${uID})`);
        }
        sections.push({
          title: "Group Admins",
          items: adminItems
        });
      }

      const replyMsg = fmtTree("👥 GROUP INFORMATION", sections);

      await sendHumanReply(ctx, replyMsg);
    } catch (err) {
      console.error("Groupinfo command error:", err.message);
      await sendHumanReply(ctx, `❌ গ্রুপ ইনফরমেশন পেতে সমস্যা হয়েছে: ${err.message}`);
    }
  }
};

