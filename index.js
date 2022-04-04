const MODE = Boolean(process.env.MODE); // true: on server, false: locally
const ADMINS = JSON.parse(process.env.ADMINS);
import './env.js';

// bot libraries
import { Telegraf, Scenes } from 'telegraf';
import { session } from './utils/session.js';
import userManager from './utils/userManager.js';

// util libraries
import * as scenes from './utils/scenes.js';
import { initializeMenu, firstMenu } from './utils/menu/menu.js';
import { mainMenuKb } from './utils/keyboards.js';
import History from './utils/history.js';

// Running the bot

const bot = new Telegraf(global.process.env.TOKEN);
bot.telegram.sendMessage(ADMINS[0], `Starting a ${MODE ? 'remote' : 'local'} server`);
// Notification for me

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

bot.hears("Add author's katas", async (ctx) => {
  await ctx.scene.enter('addAuthorsKatas');
});

bot.hears("Delete author's katas", async (ctx) => {
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
