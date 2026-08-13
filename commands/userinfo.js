const fs = require("fs");
const path = require("path");
const { getDetailedUserInfo, formatTree } = require("../utils/helpers");

module.exports = {
  name: "userinfo",
  aliases: ["user", "uid"],
  description: "Display detailed profile info of a user",
  category: "general",
  async execute({ bot, ctx, downloadTempImage, getUserName, sendHumanReply }) {
    try {
      let targetID = ctx.senderID;
      const replyObj = ctx.event?.messageReply || ctx.event?.message_reply;
      
      // Check if message is a reply to another user's message
      if (replyObj) {
        targetID = String(replyObj.senderID || replyObj.author || replyObj.sender_id || targetID);
      } else if (ctx.event?.mentions && Object.keys(ctx.event.mentions).length > 0) {
        // If mentioned
        targetID = Object.keys(ctx.event.mentions)[0];
      }

      // Fetch rich metadata using helper
      const uInfo = await getDetailedUserInfo(bot, targetID);

      // If mentions had name override and uInfo didn't get full name
      const mentions = ctx.event?.mentions || {};
      if (mentions[targetID]) {
        const mentionName = mentions[targetID].replace(/^@/, "");
        if (mentionName && (!uInfo.name || uInfo.name.startsWith("User "))) {
          uInfo.name = mentionName;
        }
      }

      // Full resolution (HD 1000x1000) profile picture via Facebook Graph API
      const avatarUrl = `https://graph.facebook.com/${targetID}/picture?height=1000&width=1000&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
      const tempImgPath = path.join(__dirname, `../temp_avatar_${targetID}_${Date.now()}.jpg`);

      const mainTitle = "👤 USER PROFILE INFO";
      const sections = [
        {
          title: "Basic Details",
          items: [
            `Full Name: ${uInfo.name}`,
            `First Name: ${uInfo.firstName || "N/A"}`,
            `User ID: ${uInfo.userID}`,
            `Username / Vanity: ${uInfo.vanity ? `@${uInfo.vanity}` : "None"}`,
            `Gender: ${uInfo.gender}`
          ]
        },
        {
          title: "Status & Relationship",
          items: [
            `Account Type: ${uInfo.type}`,
            `Friend Status: ${uInfo.isFriend ? "Friends 🤝" : "Not Friends 👤"}`,
            `Birthday Today: ${uInfo.isBirthday ? "Yes 🎉🎂" : "No ❌"}`
          ]
        },
        {
          title: "Profile Links & Media",
          items: [
            `Profile Link: ${uInfo.profileUrl}`,
            `HD Avatar: Attached Below 📸`
          ]
        }
      ];

      const userInfoMsg = formatTree(mainTitle, sections);

      let payload = userInfoMsg;
      try {
        await downloadTempImage(avatarUrl, tempImgPath);
        payload = {
          body: userInfoMsg,
          attachment: fs.createReadStream(tempImgPath)
        };
      } catch (downloadErr) {
        console.warn("Avatar image download failed, sending text fallback:", downloadErr.message);
      }

      await sendHumanReply(ctx, payload);

      // Clean up temporary image file after sending
      if (fs.existsSync(tempImgPath)) {
        setTimeout(() => {
          fs.unlink(tempImgPath, () => {});
        }, 6000);
      }
    } catch (err) {
      console.error("Userinfo error:", err.message);
      await sendHumanReply(ctx, "❌ Error retrieving user info.");
    }
  }
};

