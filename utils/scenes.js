import { Telegraf, session, Scenes, Markup } from 'telegraf';
import { mainMenuKb, removeKd, justYesNoKb } from './keyboards.js';

import PG from './pg.js';
import Slar from './sqlArray.js';
import History from './history.js';
import kataIsValid from './kataIsValid.js';
import fetch from 'node-fetch';

// Scenes

const addKataScene = new Scenes.WizardScene(
  'addKata',
  Telegraf.on('text', async (ctx) => {
    let kata = kataIsValid(ctx.message.text);
    if (!kata) {
      ctx.reply('Incorrect input format', mainMenuKb());
      return ctx.scene.leave();
    }

    const sc = ctx.scene.state;
    const client = await PG.getClient();

    try {
      await client.query('BEGIN');

      // Checking for the presence of kata in the table
      const [kataId, arrayId] = (await client.queryLine({
        text: 'SELECT kata_id, followers FROM history WHERE kata_id IN (SELECT id FROM katas WHERE kata = $1)',
        values: [kata],
        rowMode: 'array',
      })) || [null, null];

      if (kataId) {
        // If this kata is in the table
        sc.kataId = kataId;

        if (await Slar.includes(ctx.session.userId, arrayId)) {
          // If the person has already signed
          ctx.scene.leave();
          ctx.reply('You are already subscribed to this kata', mainMenuKb());
          return;
        }
      }

      // If the person is not signed or the kata is not in the table

      sc.req = await History.prototype.checkKata(kata);
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
      const votes = req.very + req.somewhat + req.not;
      return `
The subscription was successful.
Current kata parameters.
  -Completed: ${req.completed},
  -Stars: ${req.stars},
  -Rating: ${(((req.very + req.somewhat / 2) / votes) * 100).toFixed(2)}%`;
    };

    let subscribeResult = (req) => {
      ctx.reply(textSuccessSubscribe(req), mainMenuKb());
      // tracking.addKata(req.id);
    };

    if (ctx.message.text != 'Yes') {
      ctx.reply('Cancel', mainMenuKb());
      return ctx.scene.leave();
    }

    const client = await PG.getClient();

    try {
      await client.query('BEGIN');

      const req = ctx.scene.state.req;
      let kataId = ctx.scene.state.kataId;

      const settings = await client.queryLine(`
        SELECT hour, day, month FROM settings WHERE user_id = '${ctx.session.userId}'
      `);

      if (kataId === undefined) {
        // If the kata is not in the table
        const array = await Slar.newArray(ctx.session.userId);

        kataId = await client.queryFirst('INSERT INTO katas (kata) VALUES ($1) RETURNING id', [
          req.id,
        ]);

        console.log(
          '[New kata add]',
          req.id,
          req.name,
          '[by]',
          ctx.message.from.id,
          '[id]',
          kataId
        );

        const query = {
          text: `INSERT INTO history ( \
            kata_id, followers, \
            hour,           day,           month, \
            hour_completed, day_completed, month_completed, \
            hour_stars,     day_stars,     month_stars, \
            hour_very,      day_very,      month_very, \
            hour_somewhat,  day_somewhat,  month_somewhat, \
            hour_not,       day_not,       month_not \
          ) VALUES ( \
            $1, $2, $3, $4, $5, \
            $6, $6, $6, \
            $7, $7, $7, \
            $8, $8, $8, \
            $9, $9, $9, \
            $10, $10, $10 \
          )`,
          values: [
            kataId,
            array.id,
            settings.hour,
            settings.day,
            settings.month,
            req.completed,
            req.stars,
            req.very,
            req.somewhat,
            req.not,
          ],
        };

        await client.query(query);
      } else {
        // If the kata is on the table

        const history = await client.queryLine(
          `
        SELECT
          followers, hour, day, month
        FROM history WHERE
          kata_id = $1
        `,
          [kataId]
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
          [kataId]
        );
      }

      const userArray = await client.getKatasOfUser(ctx.session.userId);
      await userArray.push(kataId);

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
    let kata = kataIsValid(ctx.message.text);
    if (!kata) {
      ctx.reply('Incorrect input format', mainMenuKb());
      return ctx.scene.leave();
    }

    const sc = ctx.scene.state;

    // Checking for a kata in the table
    const client = await PG.getClient();

    try {
      await client.query('BEGIN');

      const query = {
        text: `SELECT followers, kata_id FROM history WHERE kata_id IN (
          SELECT id FROM katas WHERE kata = $1
        )`,
        values: [kata],
        rowMode: 'array',
      };

      [sc.arrayId, sc.kataId] = (await client.queryLine(query)) || [];

      if (!(await Slar.includes(ctx.session.userId, sc.arrayId))) {
        // If the person has not signed
        ctx.reply('You are not subscribed to this kata', mainMenuKb());
        return ctx.scene.leave();
      }

      const response = await (
        await fetch('http://www.codewars.com/api/v1/code-challenges/' + kata)
      ).json(); // Requesting a kata

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

      const kataId = ctx.scene.state.kataId;
      const kataArray = await Slar.getArray(ctx.scene.state.arrayId);
      const userArray = await client.getKatasOfUser(ctx.session.userId);
      const kata = await client.getKataById(kataId);

      // Removing a user from an array
      await userArray.deleteByName(kataId);
      await kataArray.deleteByName(ctx.session.userId);

      if (kataArray.length === 0) {
        // If he is the only subscriber
        console.log('[Full delete]', kataId);
        await client.query(`DELETE FROM history WHERE kata_id = '${kataId}';`);
        await client.query(`DELETE FROM katas WHERE id = '${kataId}';`);
      }

      ctx.reply('The unsubscribe was successful', mainMenuKb());
      console.log('[Kata delete]', kata, '[by]', ctx.message.from.id, '[id]', kataId);

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

const settingsScene = new Scenes.WizardScene('settings', (ctx) => {
  ctx.reply('Very soon!');
  return ctx.scene.leave();
});

export { addKataScene, settingsScene, deleteKataScene };
