import { Markup } from 'telegraf';

import { backButton } from './../keyboards.js';
import send from './../send.js';

export default [
  [
    'information',
    async (ctx) => {
      await ctx.answerCbQuery();
      await send(ctx, 'Soon!', Markup.inlineKeyboard([backButton('menu')]));
    },
  ],
];
