import { Markup } from 'telegraf';

import { backButton } from './../keyboards.js';
import PG from './../pg.js';
import send from './../send.js';
import Codewars from './../codewars.js';
import Kata from '../entities/kata.js';

function generateKataText(info) {
  info.totalVoites = info.votes_very + info.votes_somewhat + info.votes_not;
  info.rating = ((info.votes_very + info.votes_somewhat / 2) / info.totalVoites) * 100;

  return `\
«<a href="${Codewars.getKataLink(info.cid)}"><b>${info.name}</b></a>».\n
Completed <b>${info.completed}</b> times.
Stars: <b>${info.stars}</b>
Comments: <b>${info.comments}</b>

Votes: <b>${info.totalVoites}</b>
  Very: <b>${info.votes_very}</b>
  Somewhat: <b>${info.votes_somewhat}</b>
  Not much: <b>${info.votes_not}</b>

Rating: <b>${info.rating.toFixed(2)}%</b>`;
}

export default [
  [
    'kata_katalog',
    async (ctx) => {
      await ctx.answerCbQuery();

      const kataCids = await PG.startSession(async (client) => {
        return await ctx.session.user.getKataCids(client);
      });

      if (ctx.session.kataNames === undefined) {
        ctx.session.kataNames = {};
      }

      const newNames = [];

      for (const cid of kataCids) {
        if (ctx.session.kataNames[cid] === undefined) {
          const response = Codewars.getKataAPIInfo(cid);
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

      ctx.editMessageText(
        'Loaded!',
        Markup.inlineKeyboard([...katasKeyboard, [backButton('menu')]])
      );
    },
  ],
  [
    /^kata_info:([a-z\d]{24})$/,
    async (ctx) => {
      await ctx.answerCbQuery();
      const cid = ctx.match[1];
      const options = {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: Markup.inlineKeyboard([backButton('kata_katalog')]).reply_markup,
      };

      PG.startSession(async (client) => {
        const kata = new Kata({ cid });
        await kata.init(client);
        kata.name = ctx.session.kataNames[cid];

        send(ctx, generateKataText(kata), options);
      });
    },
  ],
];
