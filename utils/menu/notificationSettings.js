import { settingsKb } from './../keyboards.js';
import PG from './../pg.js';
import send from './../send.js';

export default [
  [
    'notification_settings',
    async (ctx) => {
      await ctx.answerCbQuery();

      await send(
        ctx,
        `You can choose how often you want to be notified when a kata is changed.
      To switch the mode, simply press the button`,
        settingsKb(ctx.session.user)
      );
    },
  ],
  [
    /toggle_(hour|day|month)/,
    async (ctx) => {
      const mode = ctx.match[1];
      const user = ctx.session.user;
      const client = await PG.getClient();

      try {
        await client.query('BEGIN');
        await ctx.answerCbQuery();

        const settings = await user.toggleSettings(mode);

        console.log('[Toggle notification]', ctx.session.user.id, '[mode]', mode);

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
