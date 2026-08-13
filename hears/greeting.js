module.exports = {
  name: "greeting",
  pattern: /^(hello|hi|hey|কেমন আছ|হাই|হ্যালো)/i,
  description: "Responds to greeting keywords",
  async execute({ ctx, sendHumanReply }) {
    const responses = [
      "হ্যালো! কেমন আছেন? 😊",
      "হাই! আমি ফেসবুক মেসেঞ্জার বোট। কিভাবে সাহায্য করতে পারি?",
      "আসসালামু আলাইকুম! আশা করি ভালো আছেন।"
    ];
    const randomReply = responses[Math.floor(Math.random() * responses.length)];
    await sendHumanReply(ctx, randomReply);
  }
};
