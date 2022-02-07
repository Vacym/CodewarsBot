// Connecting the database
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.MODE
    ? {
        rejectUnauthorized: false,
      }
    : false,
});

export default {
  async query(text, params) {
    // Use only when only one query is needed
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    // console.log('[executed query]', { text, duration, rows: res.rowCount });

    return res;
  },

  async getClient() {
    const client = await pool.connect();

    const query = client.query;
    const release = client.release;
    // set a timeout of 5 seconds, after which we will log this client's last query
    const timeout = setTimeout(() => {
      console.warn('[WARNING] A client has been checked out for more than 5 seconds!');
      console.warn(`The last executed query on this client was: ${client.lastQuery}`);
    }, 5000);
    // monkey patch the query method to keep track of the last query executed
    client.query = (...args) => {
      client.lastQuery = args;
      return query.apply(client, args);
    };
    client.release = () => {
      // clear our timeout
      clearTimeout(timeout);
      // set the methods back to their old un-monkey-patched version
      client.query = query;
      client.release = release;
      return release.apply(client);
    };

    // My own functions

    client.queryLine = async (text, values) => {
      const result = await client.query(text, values);
      return result.rowCount ? result.rows[0] : null;
    };

    client.queryFirst = async (text, values) => {
      const query = {
        text,
        values,
        rowMode: 'array',
      };
      const result = await client.query(query);

      return result.rowCount ? result.rows[0][0] : null;
    };

    client.getKataById = async (kataId) => {
      const kata = await client.queryFirst(`SELECT kata FROM katas WHERE id = $1`, [kataId]);
      return kata;
    };

    client.getTgById = async (userId) => {
      const user = await client.queryFirst(`SELECT tg_id FROM users WHERE id = $1`, [userId]);
      return user;
    };

    client.getKatasOfUser = async (userId) => {
      const arrayId = await client.queryFirst(`SELECT katas FROM settings WHERE user_id = $1`, [
        String(userId),
      ]);
      if (!arrayId) return [];
      return this.Slar.getArray(arrayId);
    };

    client.getUserSettings = async (tgId) => {
      return client.queryLine(
        'SELECT * FROM settings WHERE user_id = (SELECT id FROM users WHERE tg_id = $1)',
        [tgId]
      );
    };

    client.updateUsersKataSettings = async (userId, mode = 'hour') => {
      const katas = await client.query(
        `SELECT * from history where kata_id IN (
          SELECT CAST(value AS INTEGER) FROM arrays WHERE id = (
            SELECT katas FROM settings WHERE user_id = $1
          )
        )`,
        [userId]
      );

      let changing_katas = [];
      for (const kata of katas.rows) {
        const following = await client.queryFirst(
          `SELECT true = ANY (
            SELECT ${mode} FROM settings WHERE user_id IN (
              SELECT CAST(value AS INTEGER) FROM arrays WHERE id = $1
            )
          )`,
          [kata.followers]
        );

        if (following != kata[mode]) {
          changing_katas.push(kata.kata_id);
        }
      }

      if (changing_katas.length) {
        client.query(
          `UPDATE history SET ${mode} = NOT ${mode} WHERE kata_id IN (${changing_katas.toString()})`
        );
      }
    };

    client.getValidFollowers = async (arrayId, mode = 'hour') => {
      const userIds = await client.query(
        `SELECT user_id FROM settings WHERE user_id IN (
          SELECT CAST(value AS INTEGER) FROM arrays WHERE id = $1
        ) AND ${mode} = true`,
        [arrayId]
      );

      if (userIds.rowCount == 0) return [];

      const users = await client.query(
        `SELECT tg_id FROM users WHERE id IN (
          ${userIds.rows.map((val) => val.user_id).toString()}
        )`
      );

      return users.rows.map((val) => val.tg_id);
    };

    return client;
  },

  Slar: undefined,
};

// const client = await PG.getClient();

// try {
//   await client.query('BEGIN');

//   await client.query('COMMIT');
// } catch (e) {
//   await client.query('ROLLBACK');
//   throw e;
// } finally {
//   client.release();
// }
