import PG from './../pg.js';
import SqlSetManager from './../sqlSet.js';
import Kata from './kata.js';

class User {
  #valid;
  constructor(tg_id) {
    this.tg_id = tg_id;
  }

  //Public methods

  async init() {
    Object.assign(
      this,
      await PG.queryLine('SELECT * FROM users, settings WHERE id = user_id AND tg_id = $1', [
        this.tg_id,
      ])
    );
    this.#valid = Boolean(this.id);
  }

  async addKata(kata) {
    await SqlSetManager.addPair(this.id, kata.id);
    await kata.updateState();
  }

  async addKatas(katasArray) {
    for (const kata of katasArray) {
      //BOTTLENECK
      await this.addKata(kata);
    }
  }

  async deleteKata(kata) {
    await SqlSetManager.deletePair(this.id, kata.id);
    await kata.updateState();
  }

  async deleteKatas(katasArray) {
    for (const kata of katasArray) {
      //BOTTLENECK
      await this.deleteKata(kata);
    }
  }

  async toggleSettings(mode) {
    const client = await PG.getClient();

    try {
      await client.query('BEGIN');

      const settings = await client.queryLine(
        `UPDATE settings SET ${mode} = NOT ${mode} WHERE user_id = $1 RETURNING hour, day, month`,
        [this.id]
      );

      this[mode] = !this[mode];

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    const usersKatas = await Kata.getKatas((await this.getKataSet()).toArray());
    await usersKatas.updateState();

    // After remake Kata's settings updateState will not be necessary

    return this.settings;
  }

  async getKataSet() {
    return await SqlSetManager.getKataSet(this.id);
  }

  async getKataCids() {
    return await SqlSetManager.getUsersKataCids(this.id);
  }

  async getKataIds() {
    return await SqlSetManager.getUsersKataIds(this.id);
  }

  //Predicate methods

  async hasKata(kata) {
    return await SqlSetManager.hasPair(this.id, kata.id);
  }

  //Private methods

  async #initArtificially(properties) {
    Object.assign(this, properties);
    this.#valid = true;
  }

  //Getters

  get valid() {
    return this.#valid;
  }

  get settings() {
    const { hour, day, month } = this;
    return { hour, day, month };
  }

  //Static methods

  static async createUser(tgId) {
    const client = await PG.getClient();

    try {
      await client.query('BEGIN');
      const userId = await client.queryFirst(`INSERT INTO users (tg_id) VALUES ($1) RETURNING id`, [
        tgId,
      ]);

      const properties = await client.queryLine(
        `INSERT INTO settings (user_id) VALUES ($1) RETURNING *`,
        [userId]
      );
      properties.id = userId;

      const user = new User(tgId);
      user.#initArtificially(properties);

      await client.query('COMMIT');

      return user;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}

export default User;
