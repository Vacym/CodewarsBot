const MODE = Boolean(process.env.MODE); // true: on server, false: locally
const ADMINS = JSON.parse(process.env.ADMINS);

// bot libraries
import { Telegraf, Scenes } from 'telegraf';

// util libraries
import { initializeMenu, firstMenu } from './utils/menu/menu.js';
import { mainMenuKb } from './utils/keyboards.js';
import History from './utils/history.js';

// Running the bot

const bot = new Telegraf(global.process.env.TOKEN);
bot.telegram.sendMessage(ADMINS[0], `Starting a ${MODE ? 'remote' : 'local'} server`);
// Notification for me

// Middlewares

import { session } from './utils/session.js';
import userManager from './utils/userManager.js';
import * as scenes from './utils/scenes.js';

const stage = new Scenes.Stage([
  scenes.addKataScene,
  scenes.deleteKataScene,
  scenes.addAuthorsKatasScene,
  scenes.deleteAuthorsKatasScene,
]);
stage.hears('exit', (ctx) => ctx.scene.leave());

bot.use(session(), stage.middleware(), userManager());

const history = new History(bot);
history.startTracking();

bot.start((ctx) => {
  ctx.reply(
    `\
To subscribe or unsubscribe to the kata click "Add kata"/"Delete kata" button.
Then paste the link to this kata and confirm operation.

To subscribe or unsubscribe to the all katas of a certain author click "Add author"/"Delete author" button.
Then paste the link or nickname of the author and choose which type of katas (Beta or Approved).

You can check the status of the katas you are subscribed to by clicking "Menu" > "Catalog of katas"

If you want to change the frequency of incoming change notifications of katas 
Сlick the "Menu" button, then in the window that appears click "Notification settings" `,
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

bot.hears('Add author', async (ctx) => {
  await ctx.scene.enter('addAuthorsKatas');
});

bot.hears('Delete author', async (ctx) => {
  await ctx.scene.enter('deleteAuthorsKatas');
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
