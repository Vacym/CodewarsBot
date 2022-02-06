import PG from './pg.js';

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

export { checkUser, createNewUser };
