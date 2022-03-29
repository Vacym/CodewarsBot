import { Telegraf, Scenes } from 'telegraf';
import { mainMenuKb, removeKd, approvedBetaKatasKb } from './../keyboards.js';

import PG from './../pg.js';
import convertAuthorOrKata from './../kataIsValid.js';
import { Kata, KatasArray } from './../entities/kata.js';
import Author from './../entities/author.js';
import { CodewarsKataArray } from './../entities/codewarsKata.js';
import Codewars from './../codewars.js';

const addAuthorsKatasScene = new Scenes.WizardScene(
  'addAuthorsKatas',
  Telegraf.on('text', async (ctx) => {
    let subscribeObject = convertAuthorOrKata(ctx.message.text);
    console.log(subscribeObject);

    if (subscribeObject.type != 'users') {
      ctx.reply('Incorrect input format', mainMenuKb());
      return ctx.scene.leave();
    }

    const sc = ctx.scene.state;
    const author = new Author(subscribeObject.object);
    await author.initKatas();

    if (author.katas === null) {
      ctx.reply(`Author ${author.name} does not exist`, mainMenuKb());
      return ctx.scene.leave();
    }
    if (author.katas.length == 0) {
      ctx.reply(`Author ${author.name} does not have katas`, mainMenuKb());
      return ctx.scene.leave();
    }

    const client = await PG.getClient();

    try {
      await client.query('BEGIN');

      const usersKatas = Array.from(await client.getKatasOfUser(ctx.session.userId));
      const oldKatas = await Kata.getExistingKatas(author.katas.cids);

      const oldUserKatas = oldKatas.filter((kata) => usersKatas.includes(String(kata.id)));
      const oldUserKatasCids = oldUserKatas.map((kata) => kata.cid);
      const newKatas = excerptNewKatas(author.katas, oldUserKatasCids);
      console.log('new', newKatas);
      sc.newKatas = newKatas;
      sc.oldKatas = oldKatas;

      ctx.wizard.next();
      ctx.reply(
        `\
  You are not subscribed to ${newKatas.approved.length} from ${author.katas.approved.length} approved katas
  You are not subscribed to ${newKatas.beta.length} from ${author.katas.beta.length} beta katas
  
  Which katas do you want to subscribe for?\
  `,
        approvedBetaKatasKb()
      );

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      ctx.scene.leave();
      ctx.reply('Error', mainMenuKb());
      console.error(e);
    } finally {
      client.release();
    }
  }),
  Telegraf.on('text', async (ctx) => {
    const { approved, beta } = convertChoosingTypeOfKataString(ctx.message.text);
    if (approved === false && beta === false) {
      ctx.reply('Отмена', mainMenuKb());
      return ctx.scene.leave();
    }

    const sc = ctx.scene.state;
    const newKatas = sc.newKatas;
    const oldKatas = sc.oldKatas;
    const oldKatasCids = oldKatas.map((kata) => kata.cid);

    const katasCidsForCreate = new CodewarsKataArray();
    const katasForUpdate = new KatasArray();

    if (approved) separateCreateAndUpdate(newKatas.approved.cids);
    if (beta) separateCreateAndUpdate(newKatas.beta.cids);

    console.log('KatasCidsForCreate', katasCidsForCreate);
    console.log('KatasForUpdate', katasForUpdate);

    const dataOfNewKatas = [];
    for (const cid of katasCidsForCreate) {
      //BOTTLENECK
      dataOfNewKatas.push(await Codewars.getKataFullInfo(cid));
    }

    await katasForUpdate.addKatasToUser(ctx.session.userId);
    const createdKatas = await Kata.createKatas(dataOfNewKatas, ctx.session.userId);
    const userKatasSlarArray = await PG.getKatasOfUser(ctx.session.userId);

    userKatasSlarArray.push(...createdKatas.ids);

    return ctx.scene.leave();

    function separateCreateAndUpdate(cids) {
      for (const cid of cids) {
        if (oldKatasCids.includes(cid)) {
          katasForUpdate.push(oldKatas.find((kata) => kata.cid == cid));
        } else {
          katasCidsForCreate.push(cid);
        }
      }
    }
  })
);

addAuthorsKatasScene.enter((ctx) => ctx.reply('Enter author', removeKd()));

const deleteAuthorsKatasScene = new Scenes.WizardScene(
  'deleteAuthorsKatas',
  Telegraf.on('text', async (ctx) => {
    let subscribeObject = convertAuthorOrKata(ctx.message.text);
    console.log(subscribeObject);

    if (subscribeObject.type != 'users') {
      ctx.reply('Incorrect input format', mainMenuKb());
      return ctx.scene.leave();
    }

    const sc = ctx.scene.state;
    const author = new Author(subscribeObject.object);
    await author.initKatas();

    if (author.katas === null) {
      ctx.reply(`Author ${author.name} does not exist`, mainMenuKb());
      return ctx.scene.leave();
    }
    if (author.katas.length == 0) {
      ctx.reply(`Author ${author.name} does not have katas`, mainMenuKb());
      return ctx.scene.leave();
    }

    const client = await PG.getClient();

    try {
      await client.query('BEGIN');

      const usersKatas = Array.from(await client.getKatasOfUser(ctx.session.userId));
      const oldKatas = await Kata.getExistingKatas(author.katas.cids);

      const oldUserKatas = oldKatas.filter((kata) => usersKatas.includes(String(kata.id)));
      const oldUserKatasCids = oldUserKatas.map((kata) => kata.cid);
      const oldCodewarsKatas = excerptOldKatas(author.katas, oldUserKatasCids);
      console.log('new', oldCodewarsKatas);
      sc.oldCodewarsKatas = oldCodewarsKatas;
      sc.oldKatas = oldKatas;

      ctx.wizard.next();
      ctx.reply(
        `\
  You are subscribed to ${oldCodewarsKatas.approved.length} from ${author.katas.approved.length} approved katas
  You are subscribed to ${oldCodewarsKatas.beta.length} from ${author.katas.beta.length} beta katas
  
  What katas do you want to unsubscribe to?\
  `,
        approvedBetaKatasKb()
      );

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      ctx.scene.leave();
      ctx.reply('Error', mainMenuKb());
      console.error(e);
    } finally {
      client.release();
    }
  }),
  Telegraf.on('text', async (ctx) => {
    const { approved, beta } = convertChoosingTypeOfKataString(ctx.message.text);
    if (approved === false && beta === false) {
      ctx.reply('Отмена', mainMenuKb());
      return ctx.scene.leave();
    }

    const sc = ctx.scene.state;
    const oldCodewarsKatas = sc.oldCodewarsKatas;
    const oldKatas = sc.oldKatas;
    const oldKatasCids = oldKatas.map((kata) => kata.cid);

    // TO DO: deleting katas

    return ctx.scene.leave();
  })
);

// TO DO: minimize code duplication

deleteAuthorsKatasScene.enter((ctx) => ctx.reply('Enter author', removeKd()));

function excerptNewKatas(authorsKatas, oldKatasCids) {
  return authorsKatas.filter((kata) => oldKatasCids.includes(kata.cid) == false);
}

function excerptOldKatas(authorsKatas, oldKatasCids) {
  return authorsKatas.filter((kata) => oldKatasCids.includes(kata.cid));
}

function convertChoosingTypeOfKataString(typeString) {
  const convertedString = { approved: false, beta: false };
  switch (typeString) {
    case 'Approved':
      convertedString.approved = true;
      break;
    case 'Beta':
      convertedString.beta = true;
      break;
    case 'Both':
      convertedString.approved = true;
      convertedString.beta = true;
      break;
  }
  return convertedString;
}

export { addAuthorsKatasScene, deleteAuthorsKatasScene };
