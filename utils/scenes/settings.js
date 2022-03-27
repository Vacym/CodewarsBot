import { Telegraf, session, Scenes, Markup } from 'telegraf';
import { mainMenuKb, removeKd, justYesNoKb, approvedBetaKatasKb } from './../keyboards.js';

import PG from './../pg.js';
import Slar from './../sqlArray.js';
import History from './../history.js';
import convertAuthorOrKata from './../kataIsValid.js';
import fetch from 'node-fetch';
import { Kata, KatasArray } from './../entities/kata.js';
import Author from './../entities/author.js';
import { CodewarsKataArray } from './../entities/codewarsKata.js';
import Codewars from './../codewars.js';

const settingsScene = new Scenes.WizardScene('settings', (ctx) => {
  ctx.reply('Very soon!');
  return ctx.scene.leave();
});

export { settingsScene };
