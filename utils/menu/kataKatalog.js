import { Markup } from 'telegraf';

import { backButton } from './../keyboards.js';
import PG from './../pg.js';
import fetch from 'node-fetch';
import send from './../send.js';

async function getKataInfo(kata) {
  return await (await fetch('http://www.codewars.com/api/v1/code-challenges/' + kata)).json();
}

function getKataText(info) {
  info.totalVoites = info.hour_very + info.hour_somewhat + info.hour_not;
  info.rating = ((info.hour_very + info.hour_somewhat / 2) / info.totalVoites) * 100;

  return `\
«<a href="https://www.codewars.com/kata/${info.kata}"><b>${info.name}</b></a>».\n
Completed <b>${info.hour_completed}</b> times.
Stars: <b>${info.hour_stars}</b>
Rating was changed.
Votes: <b>${info.totalVoites}</b>
  Very: <b>${info.hour_very}</b>
  Somewhat: <b>${info.hour_somewhat}</b>
  Not much: <b>${info.hour_not}</b>

Rating: <b>${info.rating.toFixed(2)}%</b>`;
}

export default [
  [
    'kata_katalog',
    async (ctx) => {
      await ctx.answerCbQuery();

      const client = await PG.getClient();

      try {
        const katas = await client.queryColumn(
          `SELECT kata FROM katas WHERE id IN (
              SELECT CAST(value AS INTEGER) FROM arrays WHERE id = (
                SELECT katas FROM settings WHERE user_id = $1 ORDER BY index ASC
              )
            )`,
          [1]
        );

        if (ctx.session.kataNames === undefined) {
          ctx.session.kataNames = {};
        }

        const newNames = [];

        const last = new Date();

        for (const kata of katas) {
          if (ctx.session.kataNames[kata] === undefined) {
            const response = getKataInfo(kata);
            newNames.push(response);
          }
        }

        if (newNames.length) {
          await send(ctx, 'Loading...', Markup.inlineKeyboard([backButton('menu')]));
        }

        for (const name of await Promise.all(newNames)) {
          ctx.session.kataNames[name.id] = name.name;
        }

        const katasKeyboard = Object.entries(ctx.session.kataNames).map((kata) => {
          return [Markup.button.callback(kata[1], `kata_info:${kata[0]}`)];
        });

        console.log('time:', new Date() - last);
        ctx.editMessageText(
          'Loaded!',
          Markup.inlineKeyboard([...katasKeyboard, [backButton('menu')]])
        );
      } catch (e) {
        console.error(e);
      } finally {
        client.release();
      }
    },
  ],
  [
    /^kata_info:([a-z\d]{24})$/,
    async (ctx) => {
      await ctx.answerCbQuery();
      const kata = ctx.match[1];
      const options = {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: Markup.inlineKeyboard([backButton('kata_katalog')]).reply_markup,
      };

      console.log(options.reply_markup);

      const client = await PG.getClient();

      try {
        await client.query('BEGIN');

        const kataData = await client.queryLine(
          `SELECT * FROM history WHERE kata_id = (SELECT id FROM katas WHERE kata = $1)`,
          [kata]
        );
        await send(
          ctx,
          getKataText({ ...kataData, kata: kata, name: ctx.session.kataNames[kata] }),
          options
        );

        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        console.error(e);
      } finally {
        client.release();
      }

      console.log(kata);
    },
  ],
];
