import { Markup } from 'telegraf';

import { backButton, paginationKb } from './../keyboards.js';
import PG from './../pg.js';
import send from './../send.js';
import Codewars from './../codewars.js';
import Kata from '../entities/kata.js';

function generateKataText(info) {
  info.totalVotes = info.votes_very + info.votes_somewhat + info.votes_not;
  info.rating = ((info.votes_very + info.votes_somewhat / 2) / info.totalVotes) * 100;

  return `\
«<a href="${Codewars.getKataLink(info.cid)}"><b>${info.name}</b></a>».\n
Completed <b>${info.completed}</b> times.
Stars: <b>${info.stars}</b>
Comments: <b>${info.comments}</b>

Votes: <b>${info.totalVotes}</b>
  Very: <b>${info.votes_very}</b>
  Somewhat: <b>${info.votes_somewhat}</b>
  Not much: <b>${info.votes_not}</b>

Rating: <b>${info.rating.toFixed(2)}%</b>`;
}

function generateKataConfirmationText(kataCid, kataName) {
  return `\
Are you sure you want to delete \
«<a href="${Codewars.getKataLink(kataCid)}"><b>${kataName}</b></a>»?`;
}

async function kataCatalog(ctx) {
  const receivedPage = ctx.match[1]; // count from 1
  const katasOnPage = 5;

  const allKataCids = await PG.startSession(async (client) => {
    return await ctx.session.user.getKataCids(client);
  });

  const pageCount = Math.ceil(allKataCids.length / katasOnPage);

  const currentPage = Math.min(pageCount, +receivedPage);
  const kataCids = allKataCids.slice((currentPage - 1) * katasOnPage, currentPage * katasOnPage);

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

  for (const name of await Promise.all(newNames)) {
    ctx.session.kataNames[name.id] = name.name;
  }

  const katasKeyboard = kataCids.map((cid) => {
    return [Markup.button.callback(ctx.session.kataNames[cid], `kata_info:${cid}:${currentPage}`)];
  });

  const text = katasKeyboard.length
    ? 'Catalog of katas'
    : 'You are not a subscriber to any of the katas';

  await send(
    ctx,
    text,
    Markup.inlineKeyboard([
      ...katasKeyboard,
      pageCount > 1 ? paginationKb(currentPage, pageCount, 'kata_catalog:') : [],
      [backButton('menu')],
    ])
  );
}

export default [
  [/kata_catalog:(\d+)/, kataCatalog],
  [
    /^kata_info:([a-z\d]{24}):(\d+)$/,
    async (ctx) => {
      const cid = ctx.match[1];
      const page = ctx.match[2];
      const options = {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: Markup.inlineKeyboard([
          [backButton(`kata_catalog:${page}:${page}`)],
          [Markup.button.callback('Delete kata', `kata_delete_confirmation:${cid}:${page}`)],
        ]).reply_markup,
      };

      PG.startSession(async (client) => {
        const kata = new Kata({ cid });
        await kata.init(client);
        kata.name = ctx.session.kataNames?.[cid];

        send(ctx, generateKataText(kata), options);
      });
    },
  ],
  [
    /^kata_delete_confirmation:([a-z\d]{24}):(\d+)$/,
    async (ctx) => {
      const cid = ctx.match[1];
      const page = ctx.match[2];
      const kataName = ctx.session.kataNames?.[cid];
      const options = {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('No', `kata_info:${cid}:${page}`)],
          [Markup.button.callback('Yes', `kata_delete:${cid}:${page}`)],
        ]).reply_markup,
      };

      send(ctx, generateKataConfirmationText(cid, kataName), options);
    },
  ],
  [
    /^kata_delete:([a-z\d]{24}):(\d+)$/,
    async (ctx) => {
      const cid = ctx.match[1];
      const page = ctx.match[2];

      await PG.startSession(async (client) => {
        const kata = new Kata({ cid });
        await kata.init(client);

        await ctx.session.user.deleteKata(kata, client);
      });

      ctx.match[1] = page; // Strange

      await ctx.answerCbQuery('Successfully deleted');
      await kataCatalog(ctx);
    },
  ],
];
