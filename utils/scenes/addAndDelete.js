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

    try {
      await client.query('BEGIN');

      // Checking for the presence of kata in the table

      const kata = new Kata({ cid });
      await kata.init();
      sc.kata = kata;

      if (kata.valid) {
        // If this kata is in the table

        if (await Slar.includes(ctx.session.userId, kata.followers)) {
          // If the person has already signed
          ctx.scene.leave();
          ctx.reply('You are already subscribed to this kata', mainMenuKb());
          return;
        }
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
      let kata = ctx.scene.state.kata;

      const settings = await client.queryLine(`
          SELECT hour, day, month FROM settings WHERE user_id = '${ctx.session.userId}'
        `);

      if (!kata.valid) {
        // If the kata is not in the database
        const array = await Slar.newArray(ctx.session.userId);

        kata = await Kata.createKata(req.id, { followers: array.id, ...settings, ...req }, client);

        console.log(
          '[New kata add]',
          req.id,
          req.name,
          '[by]',
          ctx.message.from.id,
          '[id]',
          kata.id
        );
      } else {
        // If the kata is on the database

        const history = await client.queryLine(
          `
          SELECT
            followers, hour, day, month
          FROM history WHERE
            kata_id = $1
          `,
          [kata.id]
        );

        const followers = await Slar.getArray(history.followers);
        await followers.push(ctx.session.userId);

        await client.query(
          `
          UPDATE history SET (hour, day, month) = (
            ${history.hour || settings.hour},
            ${history.day || settings.day},
            ${history.month || settings.month}
          ) WHERE kata_id = $1
          `,
          [kata.id]
        );
      }

      const userArray = await client.getKatasOfUser(ctx.session.userId);
      await userArray.push(kata.id);

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

    // Checking for a kata in the table
    const client = await PG.getClient();

    try {
      await client.query('BEGIN');

      sc.kata = new Kata({ cid });
      await sc.kata.init();

      if (!(await Slar.includes(ctx.session.userId, sc.kata.followers))) {
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
    const client = await PG.getClient();

    try {
      await client.query('BEGIN');

      const kata = ctx.scene.state.kata;
      const kataArray = await Slar.getArray(kata.followers);
      const userArray = await client.getKatasOfUser(ctx.session.userId);

      // Removing a user from an array
      await userArray.deleteByName(kata.id);
      await kataArray.deleteByName(ctx.session.userId);

      if (kataArray.length === 0) {
        // If he is the only subscriber
        console.log('[Full delete]', kata.id);
        await kata.delete();
      }

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
