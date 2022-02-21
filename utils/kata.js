import dbfs from './dropbox.js';
import PG from './pg.js';
import Slar from './sqlArray.js';
import toin from './toin.js';

/*
/history
  /monthHistory
    (Every month the kata's history is archived here)
    [kata_id]_[year]_[month].toin

  /lastMonthHistory
    (This is where the history of the current month is accumulated)
    [kata_id].toin
*/

class KatasManager {
  static async createKata(kataId, firstData) {
    const firstDataArray = KatasManager.dataToArray(firstData);
    const firstDataBin = toin.create([firstDataArray], { bits: 32 });

    return await dbfs.writeFile(`/history/lastMonthHistory/${kataId}.toin`, firstDataBin);
  }

  static async updateKata(kataId, newData) {
    const newDataArray = KatasManager.dataToArray(newData);
    const oldDataBin = await KatasManager.getKata(kataId);
    const addedDataBin = toin.add(oldDataBin, [newDataArray]);

    return await dbfs.writeFile(`/history/lastMonthHistory/${kataId}.toin`, addedDataBin);
  }

  static async getKata(kataId) {
    return await dbfs.readFile(`/history/lastMonthHistory/${kataId}.toin`);
  }

  static async getSpecificLine(kataId, hours) {
    const kataBin = await KatasManager.getKata(kataId);
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

  static dataToArray(data = {}) {
    function getHours(date) {
      return Math.floor(date / 3600000);
    }

    const dataArray = [
      data.hours instanceof Date ? getHours(data.hours) : data.hours ?? getHours(new Date()),
      (data.completed || data.hour_completed) ?? 0,
      (data.stars || data.hour_stars) ?? 0,
      (data.very || data.hour_very) ?? 0,
      (data.somewhat || data.hour_somewhat) ?? 0,
      (data.not || data.hour_not) ?? 0,
      (data.comments || data.hour_comments) ?? 0,
      (data.issues || data.hour_issues) ?? 0,
    ];

    return dataArray;
  }
}

class Kata {
  constructor(options = {}) {
    // id - kata id in database;
    // cid - kata id in Codewars;
    // Shuld be at least one of them

    this.cid = options.cid;
    this.id = options.id;
  }

  async init() {
    this.cid = this.cid || (await PG.getKataById(this.id));
    this.id = this.id || (await PG.getKataIdByCid(this.cid));
  }

  async getThisMonthInfo() {
    return toin.read(await KatasManager.getKata(this.id));
  }

  async getLastLineInfo() {
    return toin.readLastLine(await KatasManager.getKata(this.id));
  }

  async getSpecificLine(hours) {
    return await KatasManager.getSpecificLine(this.id, hours);
  }

  async updateInfo(newData = {}) {
    const client = await PG.getClient();

    try {
      await client.query('BEGIN');

      let query = `
      UPDATE history SET ${Object.entries(newData)
        .map((a) => a[0] + '=' + a[1])
        .join(',')} WHERE kata_id = '${this.id}';
      `;

      await client.query(query);

      await KatasManager.updateKata(this.id, newData);

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  static async createKata(cid, kataData = {}) {
    const client = await PG.getClient();

    try {
      await client.query('BEGIN');
      const kataId = await client.queryFirst('INSERT INTO katas (kata) VALUES ($1) RETURNING id', [
        cid,
      ]);

      const query = {
        text: `INSERT INTO history ( \
          kata_id, followers, \
          hour, day, month, \
          hour_completed, \
          hour_stars,     \
          hour_very,      \
          hour_somewhat,  \
          hour_not,       \
          hour_comments,  \
          hour_issues     \
        ) VALUES ( \
          $1, $2, $3, $4, $5, \
          $6, $7, $8, $9, $10, $11, $12 \
        )`,
        values: [
          kataId,
          kataData.arrayId,
          kataData.hour ?? true,
          kataData.day ?? true,
          kataData.month ?? true,
          kataData.completed ?? 0,
          kataData.stars ?? 0,
          kataData.very ?? 0,
          kataData.somewhat ?? 0,
          kataData.not ?? 0,
          kataData.comments ?? 0,
          kataData.issues ?? 0,
        ],
      };

      await client.query(query);

      await KatasManager.createKata(kataId, kataData);

      await client.query('COMMIT');

      return new Kata({ id: kataId, cid });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}

export default Kata;
