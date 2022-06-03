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

    if (subscribeObject.type != 'users') {
      ctx.reply('Incorrect input format', mainMenuKb());
      return ctx.scene.leave();
    }

    const sc = ctx.scene.state;
    const user = ctx.session.user;
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

    await PG.startSession(
      async (client) => {
        const usersKatasIds = await user.getKataIds(client);
        const dbKatas = await Kata.getExistingKatas(author.katas.cids);

        const userKatas = dbKatas.filter((kata) => usersKatasIds.includes(kata.id));
        const newKatas = excreptNewKatas(author.katas, userKatas.cids);

        sc.newKatas = newKatas;
        sc.dbKatas = dbKatas;

        ctx.wizard.next();
        ctx.reply(
          `\
  You are not subscribed to ${newKatas.approved.length} from ${author.katas.approved.length} approved katas
  You are not subscribed to ${newKatas.beta.length} from ${author.katas.beta.length} beta katas
  
  Which katas do you want to subscribe for?\
  `,
          approvedBetaKatasKb()
        );
      },
      (e) => {
        ctx.scene.leave();
        ctx.reply('Error', mainMenuKb());
        console.error(e);
      }
    );
  }),
  Telegraf.on('text', async (ctx) => {
    const { approved, beta } = convertChoosingTypeOfKataString(ctx.message.text);
    if (approved === false && beta === false) {
      ctx.reply('Cancel', mainMenuKb());
      return ctx.scene.leave();
    }

    const sc = ctx.scene.state;
    const user = ctx.session.user;
    const dbKatas = sc.dbKatas;
    let newKatas = sc.newKatas;

    // Filter the right kinds of katas
    if (approved !== beta) {
      newKatas = beta ? newKatas.beta : newKatas.approved;
    }

    const { kataCidsForCreate, katasForUpdate } = separateCreateAndUpdate(newKatas.cids, dbKatas);

    const dataOfNewKatas = [];
    for (const cid of kataCidsForCreate) {
      //BOTTLENECK
      dataOfNewKatas.push(await Codewars.getKataFullInfo(cid));
    }

    await PG.startSession(async (client) => {
      const createdKatas = await Kata.createKatas(dataOfNewKatas, client);
      await user.addKatas(katasForUpdate, client);
      await user.addKatas(createdKatas, client);
    });

    ctx.reply(`You have been subscribed to ${newKatas.length} katas`, mainMenuKb());

    return ctx.scene.leave();

    function separateCreateAndUpdate(cids, dbKatas) {
      const kataCidsForCreate = new CodewarsKataArray();
      const katasForUpdate = new KatasArray();
      const dbKatasCids = dbKatas.cids;

      for (const cid of cids) {
        if (dbKatasCids.includes(cid)) {
          katasForUpdate.push(dbKatas.find((kata) => kata.cid == cid));
        } else {
          kataCidsForCreate.push(cid);
        }
      }
      return { kataCidsForCreate, katasForUpdate };
    }
  })
);

addAuthorsKatasScene.enter((ctx) => ctx.reply('Enter author', removeKd()));

const deleteAuthorsKatasScene = new Scenes.WizardScene(
  'deleteAuthorsKatas',
  Telegraf.on('text', async (ctx) => {
    let subscribeObject = convertAuthorOrKata(ctx.message.text);

    if (subscribeObject.type != 'users') {
      ctx.reply('Incorrect input format', mainMenuKb());
      return ctx.scene.leave();
    }

    const sc = ctx.scene.state;
    const user = ctx.session.user;
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

    await PG.startSession(
      async (client) => {
        const usersKatasIds = await user.getKataIds(client);
        const dbKatas = await Kata.getExistingKatas(author.katas.cids);

        const userKatas = dbKatas.filter((kata) => usersKatasIds.includes(kata.id));
        const oldKatas = excreptOldKatas(author.katas, userKatas.cids);

        sc.oldKatas = oldKatas;
        sc.dbKatas = dbKatas;

        ctx.wizard.next();
        ctx.reply(
          `\
  You are subscribed to ${oldKatas.approved.length} from ${author.katas.approved.length} approved katas
  You are subscribed to ${oldKatas.beta.length} from ${author.katas.beta.length} beta katas
  
  What katas do you want to unsubscribe to?\
  `,
          approvedBetaKatasKb()
        );
      },
      (e) => {
        ctx.scene.leave();
        ctx.reply('Error', mainMenuKb());
        console.error(e);
      }
    );
  }),
  Telegraf.on('text', async (ctx) => {
    const { approved, beta } = convertChoosingTypeOfKataString(ctx.message.text);
    if (approved === false && beta === false) {
      ctx.reply('Cancel', mainMenuKb());
      return ctx.scene.leave();
    }

    const sc = ctx.scene.state;
    const user = ctx.session.user;
    const dbKatas = sc.dbKatas;
    let oldKatas = sc.oldKatas;

    // Filter the right kinds of katas
    if (approved !== beta) {
      oldKatas = beta ? oldKatas.beta : oldKatas.approved;
    }

    const katasForDelete = matchDeleteKatas(oldKatas.cids, dbKatas);

    await user.deleteKatas(katasForDelete);

    ctx.reply(`You have been unsubscribed to ${oldKatas.length} katas`, mainMenuKb());

    return ctx.scene.leave();

    function matchDeleteKatas(cids, dbKatas) {
      const katasForDelete = new KatasArray();

      for (const cid of cids) {
        katasForDelete.push(dbKatas.find((kata) => kata.cid == cid));
      }
      return katasForDelete;
    }
  })
);

// TO DO: minimize code duplication

deleteAuthorsKatasScene.enter((ctx) => ctx.reply('Enter author', removeKd()));

function excreptNewKatas(authorsKatas, dbKatasCids) {
  return authorsKatas.filter((kata) => dbKatasCids.includes(kata.cid) == false);
}

function excreptOldKatas(authorsKatas, dbKatasCids) {
  return authorsKatas.filter((kata) => dbKatasCids.includes(kata.cid));
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
