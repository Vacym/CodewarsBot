import { Markup } from 'telegraf';

import { informationKb } from './../keyboards.js';
import send from './../send.js';

export default [
  [
    'information',
    async (ctx) => {
      await ctx.answerCbQuery();
      await send(
        ctx,
        `\
This open source bot can track activity on your katas.
I would be very grateful if you could leave feedback (or even contribute on Github)

You can invoke the instructions by sending the /start command

To contact: @Vacymm
Bot version: ${process.env.npm_package_version}`,
        informationKb()
      );
    },
  ],
];
