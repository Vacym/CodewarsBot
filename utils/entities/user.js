import PG from './../pg.js';
import SqlSetManager from './../sqlSet.js';
import Kata from './kata.js';

class User {
  #valid;
  constructor(tg_id) {
    this.tg_id = tg_id;
  }

  //Public methods

  async init(client) {
    await PG.session(client, async (client) => {
      Object.assign(
        this,
        await client.queryLine('SELECT * FROM users, settings WHERE id = user_id AND tg_id = $1', [
          this.tg_id,
        ])
      );
    });
    this.#valid = Boolean(this.id);
  }

  async addKata(kata, client) {
    await SqlSetManager.addPair(this.id, kata.id, client);
    await kata.updateState(client);
  }

  async addKatas(katasArray, client) {
    await PG.session(client, async (client) => {
      for (const kata of katasArray) {
        //BOTTLENECK
        await this.addKata(kata, client);
      }
    });
  }

  async deleteKata(kata, client) {
    await PG.session(client, async (client) => {
      await SqlSetManager.deletePair(this.id, kata.id, client);
      await kata.updateState(client);
    });
  }

  async deleteKatas(katasArray, client) {
    await PG.session(client, async (client) => {
      for (const kata of katasArray) {
        //BOTTLENECK
        await this.deleteKata(kata, client);
      }
    });
  }

  async toggleSettings(mode, client) {
    await PG.session(client, async (client) => {
      const settings = await client.queryLine(
        `UPDATE settings SET ${mode} = NOT ${mode} WHERE user_id = $1 RETURNING hour, day, month`,
        [this.id]
      );

      this[mode] = !this[mode];

      const usersKatas = await Kata.getKatas((await this.getKataSet()).toArray(), client);
      await usersKatas.updateState(client);
      // After remake Kata's settings updateState will not be necessary
    });

    return this.settings;
  }

  async getKataSet(client) {
    return await SqlSetManager.getKataSet(this.id, client);
  }

  async getKataCids(client) {
    return await SqlSetManager.getUsersKataCids(this.id, client);
  }

  async getKataIds(client) {
    return await SqlSetManager.getUsersKataIds(this.id, client);
  }

  //Predicate methods

  async hasKata(kata, client) {
    return await SqlSetManager.hasPair(this.id, kata.id, client);
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

  static async createUser(tgId, client) {
    return await PG.session(client, async (client) => {
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

      return user;
    });
  }
}

export default User;
