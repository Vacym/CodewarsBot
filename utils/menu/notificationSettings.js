import { settingsKb } from './../keyboards.js';
import PG from './../pg.js';
import send from './../send.js';

export default [
  [
    'notification_settings',
    async (ctx) => {
      await ctx.answerCbQuery();

      const settings = (
        await PG.query(
          'SELECT * FROM settings WHERE user_id = (SELECT id FROM users WHERE tg_id = $1)',
          [ctx.update.callback_query.from.id]
        )
      ).rows[0];

      await send(
        ctx,
        `You can choose how often you want to be notified when a kata is changed.
      To switch the mode, simply press the button`,
        settingsKb(settings)
      );
    },
  ],
  [
    /toggle_(hour|day|month)/,
    async (ctx) => {
      const mode = ctx.match[1];
      const client = await PG.getClient();

      try {
        await client.query('BEGIN');
        await ctx.answerCbQuery();

        const settings = await client.queryLine(
          `UPDATE settings SET ${mode} = NOT ${mode} WHERE user_id = (SELECT id FROM users WHERE tg_id = $1) RETURNING *`,
          [ctx.update.callback_query.from.id]
        );

        console.log('[Toggle notification]', ctx.session.userId, '[mode]', mode);

        await client.updateUsersKataSettings(ctx.session.userId, mode);

        await ctx.editMessageReplyMarkup(settingsKb(settings).reply_markup);

        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    },
  ],
];
