import { Telegraf, Scenes } from 'telegraf';
import { mainMenuKb, removeKd, justYesNoKb } from './../keyboards.js';

import PG from './../pg.js';
import Slar from './../sqlArray.js';
import convertAuthorOrKata from './../kataIsValid.js';
import { Kata } from './../entities/kata.js';
import Codewars from './../codewars.js';

const addKataScene = new Scenes.WizardScene(
  'addKata',
  Telegraf.on('text', async (ctx) => {
    let subscribeObject = convertAuthorOrKata(ctx.message.text);

    if (subscribeObject.type != 'kata') {
      ctx.reply('Incorrect input format', mainMenuKb());
      return ctx.scene.leave();
    }

    const cid = subscribeObject.object;
    const sc = ctx.scene.state;
    const client = await PG.getClient();
    const user = ctx.session.user;

    try {
      await client.query('BEGIN');

      // Checking for the presence of kata in the table

      const kata = new Kata({ cid });
      await kata.init();
      sc.kata = kata;

      if (kata.valid && (await user.hasKata(kata))) {
        // If the person has already signed
        ctx.reply('You are already subscribed to this kata', mainMenuKb());
        return ctx.scene.leave();
      }

      // If the person is not signed or the kata is not in the table

      sc.req = await Codewars.getKataFullInfo(cid);
      if (!sc.req.name) {
        // If there is an error in the query
        ctx.reply("We couldn't find this kata.", mainMenuKb());
        return ctx.scene.leave();
      }

      ctx.wizard.next();
      ctx.reply(`Do you want to subscribe to the kata "${sc.req.name}"?`, justYesNoKb());

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
    let textSuccessSubscribe = (req) => {
      const votes = req.votes_very + req.votes_somewhat + req.votes_not;
      return `
  The subscription was successful.
  Current kata parameters.
    -Completed: ${req.completed},
    -Stars: ${req.stars},
    -Comments: ${req.comments}
    -Rating: ${(((req.votes_very + req.votes_somewhat / 2) / votes) * 100).toFixed(2)}%`;
    };

    let subscribeResult = (req) => {
      ctx.reply(textSuccessSubscribe(req), mainMenuKb());
    };

    if (ctx.message.text != 'Yes') {
      ctx.reply('Cancel', mainMenuKb());
      return ctx.scene.leave();
    }

    const client = await PG.getClient();

    try {
      await client.query('BEGIN');

      const req = ctx.scene.state.req;
      const user = ctx.session.user;
      let kata = ctx.scene.state.kata;

      if (!kata.valid) {
        // If the kata is not in the database

        kata = await Kata.createKata(req.id, req, client);

        console.log(
          '[New kata add]',
          req.id,
          req.name,
          '[by]',
          ctx.message.from.id,
          '[id]',
          kata.id
        );
      }

      await user.addKata(kata);

      subscribeResult(req);

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      ctx.scene.leave();
      ctx.reply('Error', mainMenuKb());
      console.error(e);
    } finally {
      client.release();
    }

    ctx.scene.leave();
  })
);

addKataScene.enter((ctx) =>
  ctx.reply('Enter the id of the kata you want to subscribe to, or a link to it', removeKd())
);

const deleteKataScene = new Scenes.WizardScene(
  'deleteKata',
  Telegraf.on('text', async (ctx) => {
    let subscribeObject = convertAuthorOrKata(ctx.message.text);

    if (subscribeObject.type != 'kata') {
      ctx.reply('Incorrect input format', mainMenuKb());
      return ctx.scene.leave();
    }

    const cid = subscribeObject.object;
    const sc = ctx.scene.state;
    const user = ctx.session.user;

    // Checking for a kata in the table
    const client = await PG.getClient();

    try {
      await client.query('BEGIN');

      sc.kata = new Kata({ cid });
      await sc.kata.init();

      if ((await user.hasKata(sc.kata)) === false) {
        // If the person has not signed
        ctx.reply('You are not subscribed to this kata', mainMenuKb());
        return ctx.scene.leave();
      }

      const response = await Codewars.getKataAPIInfo(cid); // Requesting a kata

      // Confirmation request
      ctx.reply(`Do you want to unsubscribe from the kata "${response.name}"?`, justYesNoKb());

      ctx.wizard.next();

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
    if (ctx.message.text != 'Yes') {
      ctx.reply('Cancel', mainMenuKb());
      return ctx.scene.leave();
    }

    const kata = ctx.scene.state.kata;
    const user = ctx.session.user;

    const client = await PG.getClient();

    try {
      await client.query('BEGIN');

      await user.deleteKata(kata);

      ctx.reply('The unsubscribe was successful', mainMenuKb());
      console.log('[Kata delete]', kata.cid, '[by]', ctx.message.from.id, '[id]', kata.id);

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(e);
      ctx.reply('Error', mainMenuKb());
    } finally {
      client.release();
    }

    ctx.scene.leave();
  })
);

deleteKataScene.enter((ctx) =>
  ctx.reply('Enter the id of the kata you want to unsubscribe from, or a link to it', removeKd())
);

export { addKataScene, deleteKataScene };
