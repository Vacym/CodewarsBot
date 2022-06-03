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

additionalFuncs.queryRows = async function (text, values) {
  const result = await this.query(text, values);
  return result.rows;
};

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

  return result.rows.map((x) => x[0]);
};

additionalFuncs.getValidFollowers = async function (kataId, mode = 'hour') {
  const userTgIds = await this.queryColumn(
    `SELECT tg_id FROM users, settings WHERE user_id = id AND user_id IN (
      SELECT user_id from subscription WHERE kata_id = $1
    ) AND ${mode} = true`,
    [kataId]
  );

  return userTgIds;
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
      console.warn(
        `The last executed query on this client was: ${
          typeof client.lastQuery?.[0] == 'object'
            ? [client.lastQuery[0].text, client.lastQuery[0].values]
            : client.lastQuery?.[0]
        }`
      );
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

  async session(client, bodyFunction, errorFunction) {
    let isFirstClient = false;
    if (!client) {
      isFirstClient = true;
      client = await this.getClient();
    }

    try {
      if (isFirstClient) await client.query('BEGIN');

      var returnValue = await bodyFunction(client);

      if (isFirstClient) await client.query('COMMIT');
    } catch (e) {
      if (isFirstClient) await client.query('ROLLBACK');

      if (errorFunction) await errorFunction(e);
      else throw e;
    } finally {
      if (isFirstClient) client.release();
    }
    return returnValue;
  },

  async startSession(bodyFunction, errorFunction) {
    return await this.session(null, bodyFunction, errorFunction);
  },

  ...additionalFuncs,
};

/*
const client = await PG.getClient();

try {
  await client.query('BEGIN');

  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
*/
