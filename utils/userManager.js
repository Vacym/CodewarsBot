import { Telegraf } from 'telegraf';

import PG from './pg.js';
import { mainMenuKb } from './keyboards.js';
import User from './entities/user.js';

async function initUser(ctx) {
  const tgId = ctx.from.id;

  let user = new User(tgId);
  await user.init();

  if (user.valid === false) {
    user = await User.createUser(tgId);
    console.log('[New user]', tgId, user.id);
    await ctx.reply(
      `\
Welcome to the bot for tracking changes in your katas in Codewars.
It is very important to me that users are happy with their interaction with the bot, \
so you can tell me about your experiences, bugs or suggestions.`,
      mainMenuKb()
    );
  }

  ctx.session.user = user;

  console.log('[Today user]', user.id);
  return true;
}

function userManager() {
  return Telegraf.optional(
    async (ctx) => {
      return 'checking' in ctx.session === false;
    },

    async (ctx, next) => {
      if (ctx.session.checking === undefined) {
        ctx.session.checking = initUser(ctx);
      }

      await ctx.session.checking;
      return await next();
    }
  );
}

export default userManager;
