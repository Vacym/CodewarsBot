import { Markup } from 'telegraf';

import { backButton } from './../keyboards.js';
import send from './../send.js';

export default [
  [
    'information',
    async (ctx) => {
      ctx.answerCbQuery();
      send(ctx, 'Soon!', Markup.inlineKeyboard([backButton('menu')]));
    },
  ],
];
