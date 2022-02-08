import { Markup } from 'telegraf';

import { backButton } from './../keyboards.js';
import PG from './../pg.js';
import send from './../send.js';

export default [
  [
    'kata_katalog',
    async (ctx) => {
      await ctx.answerCbQuery();
      await send(ctx, 'Soon!', Markup.inlineKeyboard([backButton('menu')]));
    },
  ],
];
