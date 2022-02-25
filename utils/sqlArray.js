import PG from './pg.js';

class SqlArray {
  constructor(nameDB) {
    this.nameDB = nameDB;

    this.sqlArray = {
      sql: this,

      test() {
        console.log('test');
      },

      async push(...items) {
        const client = await PG.getClient();

        try {
          await client.query('BEGIN');

          let listOfValues = items.map(
            (value, index) => `(${this.id}, ${index + this.length}, '${value}')`
          );

          await client.query(
            `INSERT INTO ${this.sql.nameDB} (id, index, value) \
            VALUES ${listOfValues.join(', ')}`
          );

          for (const item of items) {
            this[this.length++] = item.toString();
          }

          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      },

      async splice(index, deleteCount, ...items) {
        const client = await PG.getClient();
        const offset = items.length - deleteCount;

        try {
          await client.query('BEGIN');

          const listAdd = items.map((item, i) => `(${this.id}, ${index + i}, '${item}')`);

          const stringAdd = listAdd.length
            ? `INSERT INTO ${this.sql.nameDB} (id, index, value) \
            VALUES ${listAdd.join(', ')}`
            : '';
          await client.query(
            `SELECT split(${this.id}, ${index}, ${index + deleteCount}, \
            ${offset});` + stringAdd
          );

          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }

        if (offset < 0) {
          for (let x = 0; x < this.length + offset; x++) {
            if (x < index) continue;

            if (x < index + items.length) {
              this[x] = items[x - index];
              continue;
            }
            this[x] = this[x - offset];
          }

          for (let x = this.length + offset; x < this.length; x++) {
            delete this[x];
          }
        } else if (offset > 0) {
          for (let x = this.length + offset - 1; x >= 0; x--) {
            if (x < index) continue;

            if (x < index + items.length) {
              this[x] = items[x - index];
              continue;
            }
            this[x] = this[x - offset];
          }
        }
        this.length += offset;
      },

      async deleteByName(name) {
        let result = await PG.query(
          `SELECT index from ${this.sql.nameDB}
          WHERE id = ${this.id} AND value = '${name}';`
        );

        const index = result.rowCount != 0 ? result.rows[0].index : null;
        if (index === null) return;
        await this.splice(index, 1);
      },
    };

    this.sqlArray[Symbol.iterator] = function () {
      return {
        array: this,
        index: 0,

        next() {
          if (this.index < this.array.length) {
            return { done: false, value: this.array[this.index++] };
          } else {
            return { done: true };
          }
        },
      };
    };
  }

  async newArray(...values) {
    const array = {};
    const client = await PG.getClient();

    try {
      await client.query('BEGIN');

      let id = await client.queryFirst(`SELECT nextval('new_array_id');`);

      let listOfValues = values.map((value, index) => `(${id}, ${index}, '${value}')`);

      if (values.length) {
        await PG.query(
          `INSERT INTO ${this.nameDB} (id, index, value) \
          VALUES ${listOfValues.join(', ')}`
        );
      }

      Object.setPrototypeOf(array, this.sqlArray);

      for (let i = 0; i < values.length; i++) {
        array[i] = values[i];
      }

      array.length = values.length;
      array.id = id;

      await client.query('COMMIT');
      return array;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async getArray(id) {
    if (!Number(id)) throw 'Not a number';
    const result = await PG.query(
      `SELECT index, value from arrays WHERE id = $1 ORDER BY index ASC`,
      [id]
    );

    const array = {};
    Object.setPrototypeOf(array, this.sqlArray);

    for (const row of result.rows) {
      array[row.index] = row.value;
    }

    array.length = result.rowCount;
    array.id = id;

    return array;
  }

  async includes(item, id) {
    if (item === undefined || id === undefined || item === null || id === null) {
      return false;
    }

    let result = await PG.query(`SELECT index, value FROM arrays WHERE id = $1 AND value = $2`, [
      id,
      item,
    ]);

    return result.rowCount != 0;
  }
}

const Slar = new SqlArray('arrays');

export default Slar;
