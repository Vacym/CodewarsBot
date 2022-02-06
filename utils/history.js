import fetch from 'node-fetch';
import cherio from 'cherio';
import PG from './pg.js';
import Slar from './sqlArray.js';

// every hour: 00 min
// every day: 21:00
// every month: 1 21:00

class History {
  constructor(bot) {
    this.bot = bot;
    this.HOUR_CHECK = 18;
  }

  linkKata(kata) {
    return 'https://www.codewars.com/kata/' + kata;
  }

  async test() {
    let result = await PG.query('SELECT * FROM katas');
    console.log(result);
  }

  needProperties(mode = 'hour') {
    return `id, kata, followers, ${mode}_time as time, ${mode}_completed as completed, ${mode}_stars as stars, ${mode}_very as very, ${mode}_somewhat as somewhat, ${mode}_not as not`;
  }

  floatUTCHour(date = new Date()) {
    return (date / 3600000) % 24;
  }

  isLastDay(dt) {
    var test = new Date(dt.getTime());
    test.setDate(test.getDate() + 1);
    return test.getDate() === 1;
  }

  async checkAndUpdate(mode = 'hour') {
    console.log('check', mode);
    const result = await PG.query(
      `SELECT ${this.needProperties(
        mode
      )} FROM history, katas WHERE kata_id = id AND ${mode}_time < $1 AND ${mode} = true`,
      [this.timeOfPreviousCheck(mode).toJSON()]
    );

    console.log(result.rowCount, this.timeOfPreviousCheck(mode).toJSON());

    for (const kata of result.rows) {
      const newInfo = await this.checkKata(kata.kata);
      await this.updateKata(kata, newInfo, mode);
    }

    const wait = this.timeForNextCheck(mode);
    setTimeout(this.checkAndUpdate.bind(this), wait, mode);
  }

  async startTracking() {
    const MINUTES_55 = 3300000;

    const waitHour = this.timeForNextCheck('hour');
    // const waitHour = 2000;
    console.log('hour', this.timeString(+waitHour));
    console.log(`Next check in ${new Date(waitHour).getMinutes()} minutes`);
    setTimeout(this.checkAndUpdate.bind(this), waitHour > MINUTES_55 ? 0 : waitHour, 'hour');

    const waitDay = this.timeForNextCheck('day');
    console.log('day', this.timeString(+waitDay));
    // console.log(`Next check in ${new Date(waitDay).getMinutes()} minutes`);
    setTimeout(this.checkAndUpdate.bind(this), waitDay, 'day');

    const waitMonth = this.timeForNextCheck('month');
    console.log('month', this.timeString(+waitMonth));
    if (waitMonth < 172800000) {
      setTimeout(this.checkAndUpdate.bind(this), waitMonth, 'month');
    }
  }

  timeForNextCheck(mode = 'hour') {
    if (mode == 'hour') {
      const nextHour = new Date();
      nextHour.setUTCHours(nextHour.getUTCHours() + 1);
      nextHour.setMinutes(0);
      nextHour.setSeconds(0);
      return nextHour - new Date();
    } else if (mode == 'day') {
      const nowTime = new Date();
      const hour = new Date(
        nowTime.getUTCFullYear(),
        nowTime.getUTCMonth(),
        nowTime.getUTCDate(),
        this.HOUR_CHECK,
        -nowTime.getTimezoneOffset()
      );
      if (this.floatUTCHour(nowTime) > this.HOUR_CHECK) {
        hour.setUTCDate(nowTime.getUTCDate() + 1);
      }
      return hour - nowTime;
    } else if (mode == 'month') {
      const nowTime = new Date();
      const increment =
        this.floatUTCHour(nowTime) > this.HOUR_CHECK && this.isLastDay(nowTime) ? 2 : 1;
      const lastDay = new Date(
        nowTime.getUTCFullYear(),
        nowTime.getUTCMonth() + increment,
        0,
        this.HOUR_CHECK,
        -nowTime.getTimezoneOffset()
      );
      return lastDay - nowTime;
    }
  }

  timeOfPreviousCheck(mode = 'hour') {
    if (mode == 'hour') {
      const nowTime = new Date();
      const hour = new Date(nowTime.toDateString());
      hour.setHours(nowTime.getHours());
      return hour;
    } else if (mode == 'day') {
      const nowTime = new Date();
      const day = new Date(
        nowTime.getUTCFullYear(),
        nowTime.getUTCMonth(),
        nowTime.getUTCDate(),
        this.HOUR_CHECK,
        -nowTime.getTimezoneOffset()
      );
      if ((nowTime / 3600000) % 24 < this.HOUR_CHECK) {
        day.setUTCDate(nowTime.getUTCDate() - 1);
      }
      return day;
    } else if (mode == 'month') {
      const nowTime = new Date();
      const lastDay = new Date(
        nowTime.getUTCFullYear(),
        nowTime.getUTCMonth(),
        0,
        0,
        -nowTime.getTimezoneOffset()
      );
      return lastDay;
    }
  }

  async addNewKata(kata) {
    await PG.query(`INSERT INTO history (kata_id) VALUES (${kata.kata_id});`);
  }

  async updateKata(kata, data, mode = 'hour') {
    // kata - kata in database
    // dara - new checked data of kata
    const newData = {};
    const nowTime = new Date();
    let text = this.generateChangesTextAndModifyData(kata, data, newData, mode);
    newData[`${mode}_time`] = `'${nowTime.toISOString()}'`;

    const client = await PG.getClient();

    try {
      await client.query('BEGIN');
      let query = `
      UPDATE history SET ${Object.entries(newData)
        .map((a) => a[0] + '=' + a[1])
        .join(',')} WHERE kata_id = '${kata.id}';
      `;

      client.query(query);
      console.log(kata);

      if (!text) return;

      const followers = await client.getValidFollowers(kata.followers, mode);

      if (followers.length == 0) return;

      console.log('[Text updated]', kata.kata);

      text =
        `Changes «<a href="${this.linkKata(kata.kata)}"><b>${
          data.name
        }</b></a>» in ${this.timeString(nowTime - kata.time)}.\n` + text;

      const options = {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      };

      // Sending messages

      for (const follower of followers) {
        try {
          this.bot.telegram.sendMessage(follower, text, options);
        } catch (e) {
          if (e.response.error_code != 403) {
            // If the user hasn't blocked us
            console.error(e);
          }
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(e);
    } finally {
      client.release();
    }
  }

  async checkKata(kata) {
    function shorten(info) {
      const shortInfo = {};
      const shortNames = {
        'Total Times Completed': 'completed',
        'Total Stars': 'stars',
        'Total "Very Satisfied" Votes': 'very',
        'Total "Somewhat Satisfied" Votes': 'somewhat',
        'Total "Not Satisfied" Votes': 'not',
      };

      for (const oldName in info) {
        if (oldName in shortNames) {
          shortInfo[shortNames[oldName]] = +info[oldName];
        }
      }
      shortInfo.name = info.name;
      shortInfo.id = kata;

      return shortInfo;
    }

    const info = {};
    try {
      const response = await fetch('https://www.codewars.com/kata/' + kata);
      const req = await response.text();
      const $ = cherio.load(req);

      $('.w-full.panel.bg-ui-section:last-child tr').each(function () {
        info[$(this).children(':not(.text-right)').text()] = $(this).children('.text-right').text();
      });

      info.name = $('.ml-4.mb-3').text();
    } catch (e) {
      console.error(e);
    }

    return shorten(info);
  }

  generateChangesTextAndModifyData(kata, data, newData, mode = 'hour') {
    const plus = (delta) => (delta < 0 ? '' : '+');

    let text = '';
    data.totalVoites = data.very + data.somewhat + data.not;
    kata.totalVoites = kata.very + kata.somewhat + kata.not;
    data.rating = ((data.very + data.somewhat / 2) / data.totalVoites) * 100;
    kata.rating = ((kata.very + kata.somewhat / 2) / kata.totalVoites) * 100;

    if (data.completed != kata.completed) {
      const delta = data.completed - kata.completed;
      text += `\nCompleted <b>${data.completed}</b> times \
<i>(${plus(delta)}${delta})</i>`;

      newData[`${mode}_completed`] = data.completed;
    }

    if (data.stars != kata.stars) {
      const delta = data.stars - kata.stars;
      text += `\nStars: <b>${data.stars}</b> <i>(${plus(delta)}${delta})</i>.`;

      newData[`${mode}_stars`] = data.stars;
    }

    if (
      data.totalVoites != kata.totalVoites ||
      (data.rating != kata.rating && data.totalVoites != 0 && kata.totalVoites)
    ) {
      const deltaVoites = data.totalVoites - kata.totalVoites;
      const deltaVery = data.very - kata.very;
      const deltaSomewhat = data.somewhat - kata.somewhat;
      const deltaNot = data.not - kata.not;
      text += `${text ? '\n' : ''}\
Rating was changed.
Votes: <b>${data.totalVoites}</b> <i>(${plus(deltaVoites)}${deltaVoites})</i>
  Very: <b>${data.very}</b> <i>(${plus(deltaVery)}${deltaVery})</i>
  Somewhat: <b>${data.somewhat}</b> <i>(${plus(deltaSomewhat)}${deltaSomewhat})</i>
  Not much: <b>${data.not}</b> <i>(${plus(deltaNot)}${deltaNot})</i>

Rating: <b>${kata.rating.toFixed(2)}%</b> => <b>${data.rating.toFixed(2)}%</b>`;

      newData[`${mode}_very`] = data.very;
      newData[`${mode}_somewhat`] = data.somewhat;
      newData[`${mode}_not`] = data.not;
    }

    return text;
  }

  getTimeDelta(oldTime, newTime = new Date()) {
    return Math.abs(newTime - oldTime);
  }

  timeString(milliseconds, round = true, options) {
    options = { ms: false, s: false, min: true, hour: true, day: true, ...options };

    const delta = { ms: milliseconds, s: 0, min: 0, hour: 0, day: 0 };
    delta.s = Math.floor(delta.ms / 1000);
    delta.ms -= delta.s * 1000;

    delta.min = Math.floor(delta.s / 60);
    delta.s -= delta.min * 60;

    delta.hour = Math.floor(delta.min / 60);
    delta.min -= delta.hour * 60;
    if (round == true && (delta.min < 5 || delta.min > 54)) {
      if (delta.min > 54) delta.hour++;
      delta.min = 0;
    }

    delta.day = Math.floor(delta.hour / 24);
    delta.hour -= delta.day * 24;

    let stringTime = '';
    stringTime += `${delta.day ? `${delta.day} day${delta.day == 1 ? '' : 's'} ` : ''}`;
    stringTime += `${delta.hour ? `${delta.hour} hour${delta.hour == 1 ? '' : 's'} ` : ''}`;
    stringTime += `${delta.min ? `${delta.min} minutes` : ''}`;

    return stringTime.trimEnd();
  }
}

export default History;
