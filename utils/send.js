export default async (ctx, text, extra) => {
  try {
    if (ctx.updateType === 'message') {
      await ctx.reply(text, extra);
    } else if (ctx.updateType === 'callback_query') {
      await ctx.answerCbQuery();
      await ctx.editMessageText(text, extra);
    }
  } catch (err) {
    if (
      err.response.description ==
      'Bad Request: message is not modified: specified new message content and reply markup are exactly the same as a current content and reply markup of the message'
    ) {
      // message is not modified
    } else {
      console.error(err);
      ctx.reply('Error');
    }
  }
};
