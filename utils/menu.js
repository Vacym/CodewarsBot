import { Telegraf, session, Scenes, Markup } from 'telegraf';
import { mainMenuKb, removeKd, justYesNoKb, backButton, settingsKb } from './keyboards.js';

import PG from './pg.js';
import Slar from './sqlArray.js';
import History from './history.js';
import kataIsValid from './kataIsValid.js';
import fetch from 'node-fetch';
import send from './send.js';

const actions = [];

function addActionBot(action, fn) {
  actions.push([
    action,
    async (ctx) => {
      console.log(ctx.session);
      try {
        await fn(ctx);
      } catch (e) {
        console.error(e);
      }
    },
  ]);
}

addActionBot('menu', async (ctx) => {
  ctx.answerCbQuery();
  send(ctx, ...firstMenu);
});

addActionBot('notifications_settings', async (ctx) => {
  ctx.answerCbQuery();
  // console.log(ctx.update.callback_query);
  const settings = (
    await PG.query(
      'SELECT * FROM settings WHERE user_id = (SELECT id FROM users WHERE tg_id = $1)',
      [ctx.update.callback_query.from.id]
    )
  ).rows[0];

  send(
    ctx,
    `You can choose how often you want to be notified when a kata is changed.
To switch the mode, simply press the button`,
    settingsKb(settings)
  );
});

addActionBot(/toggle_(hour|day|month)/, async (ctx) => {
  const mode = ctx.match[1];
  console.log(mode);
  const client = await PG.getClient();

  try {
    await client.query('BEGIN');

    const settings = await client.queryLine(
      `UPDATE settings SET ${mode} = NOT ${mode} WHERE user_id = (SELECT id FROM users WHERE tg_id = $1) RETURNING *`,
      [ctx.update.callback_query.from.id]
    );

    console.log(ctx.session);

    client.updateUsersKataSettings(ctx.session.userId, mode);

    await ctx.editMessageReplyMarkup(settingsKb(settings).reply_markup);

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    ctx.answerCbQuery();
    client.release();
  }
});

addActionBot('kata_katalog', async (ctx) => {
  ctx.answerCbQuery();
  send(ctx, 'Soon!', Markup.inlineKeyboard([backButton('menu')]));
});

const firstMenu = [
  "This is the menu (Honestly, I just don't know what to write here.)",
  Markup.inlineKeyboard([
    [Markup.button.callback('Notification settings', 'notifications_settings')],
    [Markup.button.callback('Catalog of kats', 'kata_katalog')],
  ]),
];

function initializeMenu(bot) {
  for (const action of actions) {
    bot.action(...action);
  }
}

export { initializeMenu, firstMenu };
