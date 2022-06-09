import dbxfs from '../dropbox.js';
import PG from '../pg.js';
import toin from '../toin.js';

/*
/history
  /monthHistory
    (Every month the kata's history is archived here)
    [kata_id]_[year]_[month].toin

  /lastMonthHistory
    (This is where the history of the current month is accumulated)
    [kata_id].toin
*/

function getHours(date) {
  return Math.floor(date / 3600000);
}

class KataFilesManager {
  static async createKata(kataId, firstData) {
    const firstDataArray = KataFilesManager.dataToArray(firstData);
    const firstDataBin = toin.create([firstDataArray], { bits: 32 });

    return await dbxfs.writeFile(`/lastMonthHistory/${kataId}.toin`, firstDataBin);
  }

  static async updateKata(kataId, newData) {
    const newDataArray = KataFilesManager.dataToArray(newData);
    const oldDataBin = await KataFilesManager.getKata(kataId);
    const addedDataBin = toin.add(oldDataBin, [newDataArray]);

    return await dbxfs.writeFile(`/lastMonthHistory/${kataId}.toin`, addedDataBin);
  }

  static async archiveKata(kataId, year, month) {
    return await dbxfs.copyFile(
      `/lastMonthHistory/${kataId}.toin`,
      `/monthHistory/${kataId}_${year}_${month}.toin`
    );
  }

  static async getKata(kataId) {
    return await dbxfs.readFile(`/lastMonthHistory/${kataId}.toin`);
  }

  static async getSpecificLine(kataId, hours) {
    const kataBin = await KataFilesManager.getKata(kataId);
    const { bytes, lineLength } = toin.getPropertiesFtin(kataBin);
    const bytesOnLine = lineLength * bytes;

    // Finding a number that <= hours, by brute-force from the end
    for (let i = (kataBin.length - 2) / bytesOnLine - 1; i >= 0; i--) {
      const number = toin.readNumber(
        kataBin.subarray(2 + bytesOnLine * i, 2 + bytesOnLine * i + bytes)
      );
      if (number > hours) continue;

      const line = toin.readLine(
        kataBin.subarray(2 + bytesOnLine * i, 2 + bytesOnLine * (i + 1)),
        bytes
      );
      return line;
    }
  }

  static async deleteKata(kataId) {
    dbxfs.deleteFile(`/lastMonthHistory/${kataId}.toin`);
  }

  static dataToArray(data = {}) {
    data.hours = data.time;

    const dataArray = [
      data.hours instanceof Date ? getHours(data.hours) : data.hours ?? getHours(new Date()),
      data.completed ?? 0,
      data.stars ?? 0,
      (data.very || data.votes_very) ?? 0,
      (data.somewhat || data.votes_somewhat) ?? 0,
      (data.not || data.votes_not) ?? 0,
      data.comments ?? 0,
    ];

    return dataArray;
  }

  static arrayToData(array = []) {
    const data = {
      hours: array[0],
      completed: array[1],
      stars: array[2],
      votes_very: array[3],
      votes_somewhat: array[4],
      votes_not: array[5],
      comments: array[6],

      time: new Date(array[0] * 3600000),
    };

    return data;
  }
}

class KatasArray extends Array {
  async updateState(client) {
    for (const kata of this) {
      //BOTTLENECK
      await kata.updateState(client);
    }
  }

  get ids() {
    return Array.from(this.map((kata) => kata.id));
  }

  get cids() {
    return Array.from(this.map((kata) => kata.cid));
  }
}

class Kata {
  constructor(options = {}) {
    // id - kata id in database;
    // cid - kata id in Codewars;
    // Shuld be at least one of them

    if ('id' in options === 'cid' in options) {
      throw 'Exactly one of the parameters shuld be defined';
    }

    this.cid = options.cid;
    this.id = options.id;
  }

  async init(client) {
    await PG.session(client, async (client) => {
      Object.assign(
        this,
        this.id
          ? await client.queryLine(
              'SELECT * FROM history, katas WHERE history.kata_id = katas.id AND id = $1',
              [this.id]
            )
          : await client.queryLine(
              'SELECT * FROM history, katas WHERE history.kata_id = katas.id AND cid = $1',
              [this.cid]
            )
      );
      this.valid = Boolean(this.cid && this.id);
    });
  }

  async getThisMonthInfo() {
    return toin.read(await KataFilesManager.getKata(this.id));
  }

  async getLastLineInfo() {
    return toin.readLastLine(await KataFilesManager.getKata(this.id));
  }

  async getInfo(mode = 'hour') {
    switch (mode) {
      case 'hour':
        return this;

      case 'day':
        return await this.getSpecificLine(getHours(new Date()) - 24);

      case 'month':
        var firstDay = new Date();
        firstDay.setUTCDate(1);
        return await this.getSpecificLine(getHours(firstDay));
    }
  }

  async getSpecificLine(hours) {
    return KataFilesManager.arrayToData(await KataFilesManager.getSpecificLine(this.id, hours));
  }

  async getSuitableFollowers(notificationLevel) {
    return await PG.getValidFollowers(this.id, notificationLevel);
  }

  async updateInfo(newData, notificationLevel, client) {
    PG.session(client, async (client) => {
      const query = {
        text: `UPDATE history SET  \
          time = $1,           \
          completed = $2,      \
          stars = $3,          \
          votes_very = $4,     \
          votes_somewhat = $5, \
          votes_not = $6,      \
          comments = $7        \
        WHERE kata_id = $8`,
        values: [
          newData.time,
          newData.completed,
          newData.stars,
          newData.votes_very,
          newData.votes_somewhat,
          newData.votes_not,
          newData.comments,
          this.id,
        ],
      };

      await client.query(query);

      if (notificationLevel == 1) {
        // If month
        await KataFilesManager.archiveKata(
          this.id,
          newData.time.getUTCFullYear(),
          newData.time.getUTCMonth()
        );
        await KataFilesManager.createKata(this.id, newData);
      } else {
        await KataFilesManager.updateKata(this.id, newData);
      }
    });
  }

  async updateState(client) {
    // Delete kata if no one is subscribed to it
    await PG.session(client, async (client) => {
      const countRows = await client.queryFirst(
        `SELECT COUNT(*) FROM subscription WHERE kata_id = $1`,
        [this.id]
      );

      if (countRows == 0) {
        await this.delete(client);
      }
    });
  }

  async delete(client) {
    await PG.session(client, async (client) => {
      await client.query(`DELETE FROM history WHERE kata_id = $1;`, [this.id]);
      await client.query(`DELETE FROM katas WHERE id = $1;`, [this.id]);
      await KataFilesManager.deleteKata(this.id);
    });
  }

  static async createKata(cid, kataData = {}, client) {
    return await PG.session(client, async (client) => {
      const kataId = await client.queryFirst('INSERT INTO katas (cid) VALUES ($1) RETURNING id', [
        cid,
      ]);

      const query = {
        text: `INSERT INTO history ( \
          kata_id, \
          completed,      \
          stars,          \
          votes_very,     \
          votes_somewhat, \
          votes_not,      \
          comments        \
        ) VALUES ( \
          $1, $2, $3, $4, $5, $6, $7 \
        )`,
        values: [
          kataId,
          kataData.completed ?? 0,
          kataData.stars ?? 0,
          kataData.votes_very ?? 0,
          kataData.votes_somewhat ?? 0,
          kataData.votes_not ?? 0,
          kataData.comments ?? 0,
        ],
      };

      await client.query(query);

      await KataFilesManager.createKata(kataId, kataData);

      return new Kata({ id: kataId });
      // TODO: return inited kata
    });
  }

  static async createKatas(katasData = [], client) {
    const newKatas = new KatasArray();
    for (const kataData of katasData) {
      //BOTTLENECK
      const newKata = await Kata.createKata(kataData.id, kataData, client);
      newKatas.push(newKata);
    }
    return newKatas;
  }

  static async getPeriodicKatas(notificationLevel, time, client) {
    return await PG.session(client, async (client) => {
      const katasData = await client.queryRows(
        `SELECT * FROM katas, history WHERE kata_id = id AND time < $1 AND $2 <= (
        SELECT max(notification_level) FROM settings WHERE user_id IN (
          SELECT user_id FROM subscription WHERE kata_id = katas.id
        )
      )`,
        [time.toJSON(), notificationLevel]
      );

      const katas = katasData.map((data) => this.#initKataWithProperties(data));
      return katas;
    });
  }

  static #initKataWithProperties(properties) {
    const kata = new Kata({ id: properties.id });
    kata.valid = true;
    Object.assign(kata, properties);

    // TO DO: adequate initialization

    return kata;
  }

  static async getExistingKatas(cids) {
    const katasRequest = await PG.query(
      `SELECT * FROM katas, history WHERE id = kata_id and cid IN (${cids.map(
        (cid) => `'${cid}'`
      )})`
    );

    const katas = new KatasArray(
      ...katasRequest.rows.map((properties) => Kata.#initKataWithProperties(properties))
    );

    return katas;
  }

  static async getKatas(ids, client) {
    return await PG.session(client, async (client) => {
      const katasRequest = await client.query(
        `SELECT * FROM katas, history WHERE id = kata_id and id IN (${ids.map((id) => `'${id}'`)})`
      );

      const katas = new KatasArray(
        ...katasRequest.rows.map((properties) => Kata.#initKataWithProperties(properties))
      );

      return katas;
    });
  }
}

export default Kata;
export { Kata, KatasArray };
