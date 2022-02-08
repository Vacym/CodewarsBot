import { Telegraf } from 'telegraf';
import PG from './pg.js';
import { mainMenuKb } from './keyboards.js';

async function checkUser(tgId) {
  let response = await PG.query(`SELECT id FROM users WHERE tg_id = $1`, [tgId]);

  return response.rowCount ? response.rows[0].id : false;
}

async function createNewUser(tgId) {
  const client = await PG.getClient();
  let userId;

  try {
    await client.query('BEGIN');
    userId = await client.queryFirst(`INSERT INTO users (tg_id) VALUES ($1) RETURNING id`, [tgId]);

    await client.query(
      `
      INSERT INTO settings (
        user_id, katas
      ) VALUES (
        $1, nextval('new_array_id')
      )`,
      [userId]
    );

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return userId;
}

async function userInitialization(ctx) {
  console.log(+new Date(), ctx.message?.text, 'checking');
  const tgId = ctx.from.id;

  let userId = await checkUser(tgId);

  if (!userId) {
    userId = await createNewUser(tgId);
    console.log('[New user]', tgId, userId);
    await ctx.reply(
      `\
Welcome to the bot for tracking changes in your katas in Codewars.
It is very important to me that users are happy with their interaction with the bot, \
so you can tell me about your experiences, bugs or suggestions.`,
      mainMenuKb()
    );
  }

  ctx.session.userId = userId;

  console.log('[Today user]', userId);
  return true;
}

function userManager() {
  return Telegraf.optional(
    async (ctx) => {
      console.log('id', ctx.session.userId);
      console.log(+new Date(), ctx.message?.text, ctx.session.checking);
      return !ctx.session.userId && !ctx.session.checking;
    },

    async (ctx, next) => {
      if (ctx.session.checking === undefined) {
        ctx.session.checking = userInitialization(ctx);
      }

      await ctx.session.checking;
      return await next();
    }
  );
}

export default userManager;
