const MODE = Boolean(process.env.MODE); // true: on server, false: locally
const ADMINS = JSON.parse(process.env.ADMINS);

// bot libraries
import { Telegraf, session, Scenes } from 'telegraf';
import { mainMenuKb } from './utils/keyboards.js';
// util libraries

import { addKataScene, deleteKataScene } from './utils/scenes.js';
import { initializeMenu, firstMenu } from './utils/menu.js';
import History from './utils/history.js';
import PG from './utils/pg.js';
import Slar from './utils/sqlArray.js';
import { checkUser, createNewUser } from './utils/newUser.js';
PG.Slar = Slar;

// Running the bot

const bot = new Telegraf(global.process.env.TOKEN);
bot.telegram.sendMessage('1278955287', `Starting a ${MODE ? 'remote' : 'local'} server`);
// Notification for me

const stage = new Scenes.Stage([addKataScene, deleteKataScene]);
stage.hears('exit', (ctx) => ctx.scene.leave());
bot.use(session(), stage.middleware());

const history = new History(bot);
history.startTracking();

bot.use(
  Telegraf.optional(
    async (ctx) => {
      return !ctx.session.checked;
    },

    async (ctx, next) => {
      const tgId = ctx.message?.from.id || ctx.update.callback_query.from.id;

      let userId = await checkUser(tgId);

      if (!userId) {
        userId = await createNewUser(tgId);
        console.log('[New user]', tgId, userId);
        await ctx.reply(
          `\
Welcome to the bot for tracking changes in your katas in Codewars.
It is very important to me that users are happy with their interaction with the bot, \
so you can tell me about your experiences, bugs or suggestions.`,
          mainMenuKb()
        );
      }

      ctx.session.userId = userId;
      ctx.session.checked = true;

      console.log('[Today user]', userId);

      await next();
    }
  )
);

bot.start((ctx) => {
  ctx.reply(
    `\
In order to subscribe to the kata, click "Add kata".
Then paste the link to this kata and confirm the subscription.

To unsubscribe from the kata click "Delete kata" button
Then paste the link to that kata and confirm unsubscribe.

If you want to change the frequency of incoming change notifications of katas 
Press the "Menu" button, then in the window that appears press "Notification settings" `,
    mainMenuKb()
  );
});

bot.command('ping', (ctx) => {
  ctx.reply('pong');
});

bot.hears('Add kata', async (ctx) => {
  await ctx.scene.enter('addKata');
});

bot.hears('Delete kata', async (ctx) => {
  await ctx.scene.enter('deleteKata');
});

initializeMenu(bot);
bot.hears('Menu', async (ctx) => {
  await ctx.reply(...firstMenu);
});

bot.on('text', (ctx) => {
  // undefined command
  ctx.reply(`This command is undefined.`, mainMenuKb());
  console.log(ctx.message.from.id + ': ' + ctx.message.text);
});

bot.launch();
