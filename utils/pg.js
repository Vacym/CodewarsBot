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

const additionalFuncs = {};

additionalFuncs.queryLine = async function (text, values) {
  const result = await this.query(text, values);
  return result.rowCount ? result.rows[0] : null;
};

additionalFuncs.queryFirst = async function (text, values) {
  const query = {
    text,
    values,
    rowMode: 'array',
  };
  const result = await this.query(query);

  return result.rowCount ? result.rows[0][0] : null;
};

additionalFuncs.queryColumn = async function (text, values) {
  const query = {
    text,
    values,
    rowMode: 'array',
  };
  const result = await this.query(query);

  return result.rowCount ? result.rows.map((x) => x[0]) : null;
};

additionalFuncs.getKataById = async function (kataId) {
  const kata = await this.queryFirst(`SELECT kata FROM katas WHERE id = $1`, [kataId]);
  return kata;
};
additionalFuncs.getKataIdByCid = async function (kataCid) {
  const kata = await this.queryFirst(`SELECT id FROM katas WHERE kata = $1`, [kataCid]);
  return kata;
};

additionalFuncs.getTgById = async function (userId) {
  const user = await this.queryFirst(`SELECT tg_id FROM users WHERE id = $1`, [userId]);
  return user;
};

additionalFuncs.getKatasOfUser = async function (userId) {
  const arrayId = await this.queryFirst(`SELECT katas FROM settings WHERE user_id = $1`, [
    String(userId),
  ]);
  if (!arrayId) return [];
  return this.Slar.getArray(arrayId);
};

additionalFuncs.getUserSettings = async function (tgId) {
  return this.queryLine(
    'SELECT * FROM settings WHERE user_id = (SELECT id FROM users WHERE tg_id = $1)',
    [tgId]
  );
};

additionalFuncs.updateUsersKataSettings = async function (userId, mode = 'hour') {
  const katas = await this.query(
    `SELECT * from history where kata_id IN (
      SELECT CAST(value AS INTEGER) FROM arrays WHERE id = (
        SELECT katas FROM settings WHERE user_id = $1
      )
    )`,
    [userId]
  );

  let changing_katas = [];
  for (const kata of katas.rows) {
    const following = await this.queryFirst(
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
    this.query(
      `UPDATE history SET ${mode} = NOT ${mode} WHERE kata_id IN (${changing_katas.toString()})`
    );
  }
};

additionalFuncs.getValidFollowers = async function (arrayId, mode = 'hour') {
  const userIds = await this.query(
    `SELECT user_id FROM settings WHERE user_id IN (
      SELECT CAST(value AS INTEGER) FROM arrays WHERE id = $1
    ) AND ${mode} = true`,
    [arrayId]
  );

  if (userIds.rowCount == 0) return [];

  const users = await this.query(
    `SELECT tg_id FROM users WHERE id IN (
      ${userIds.rows.map((val) => val.user_id).toString()}
    )`
  );

  return users.rows.map((val) => val.tg_id);
};

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

    Object.assign(client, additionalFuncs);

    return client;
  },

  ...additionalFuncs,
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
