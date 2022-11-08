import { Markup } from 'telegraf';

import notificationSettings from './notificationSettings.js';
import kataCatalog from './kataCatalog.js';
import information from './information.js';

import send from './../send.js';

function createAction(trigger, fun) {
  return [
    trigger,
    async (ctx) => {
      try {
        await fun(ctx);
      } catch (e) {
        console.error(e);
      }
    },
  ];
}

function addActionsBot(bot, actions) {
  for (const action of actions) {
    bot.action(...createAction(...action));
  }
}

const firstMenu = [
  'Menu',
  Markup.inlineKeyboard([
    [Markup.button.callback('Notification settings', 'notification_settings')],
    [Markup.button.callback('Catalog of katas', 'kata_catalog:1')],
    [Markup.button.callback('About', 'information')],
  ]),
];

const firstMenuAction = [
  'menu',
  async (ctx) => {
    await ctx.answerCbQuery();
    await send(ctx, ...firstMenu);
  },
];

function initializeMenu(bot) {
  addActionsBot(bot, [firstMenuAction]);
  addActionsBot(bot, notificationSettings);
  addActionsBot(bot, kataCatalog);
  addActionsBot(bot, information);
}

export { initializeMenu, firstMenu };
