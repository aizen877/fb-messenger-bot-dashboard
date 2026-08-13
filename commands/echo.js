module.exports = {
  name: "echo",
  aliases: [],
  description: "Echo back message",
  category: "general",
  async execute({ ctx, args, sendHumanReply }) {
    const textToEcho = args.join(" ").trim() || "Please provide text to echo! Example: /echo Hello";
    await sendHumanReply(ctx, textToEcho);
  }
};
