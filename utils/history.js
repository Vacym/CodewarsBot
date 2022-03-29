import PG from './pg.js';
import Kata from './entities/kata.js';
import Codewars from './codewars.js';

// every hour: 00 min
// every day: 21:00
// every month: 1 21:00

class History {
  constructor(bot) {
    this.bot = bot;
    this.HOUR_CHECK = 18;
  }

  async startTracking() {
    const MINUTES_55 = 3300000;
    const waitHour = this.timeForNextCheck();

    console.log('hour', this.timeString(+waitHour));
    setTimeout(this.checkAndUpdate.bind(this), waitHour > MINUTES_55 ? 0 : waitHour);
  }

  async checkAndUpdate() {
    const mode = this.determineMode(new Date());

    console.log('check', mode);
    const result = await PG.query(
      `SELECT ${this.needProperties(
        mode
      )} FROM history, katas WHERE kata_id = id AND time < $1 AND ${mode} = true`,
      [this.timeOfPreviousCheck().toJSON()]
    );

    console.log(result.rowCount, this.timeOfPreviousCheck(mode).toJSON());

    for (const kataProperties of result.rows) {
      //BOTTLENECK
      const kata = Kata.initKataWithProperties(kataProperties);
      const newData = await Codewars.getKataFullInfo(kata.cid);
      await this.sendAndUpdateKata(kata, newData, mode);
    }

    const wait = this.timeForNextCheck();
    setTimeout(this.checkAndUpdate.bind(this), wait);
  }

  async sendAndUpdateKata(kata, newData, mode = 'hour') {
    const nowTime = new Date();
    newData.time = nowTime;

    await this.sendChanges(kata, newData, 'hour', nowTime);
    if (mode == 'day' || mode == 'month') {
      await this.sendChanges(kata, newData, 'day', nowTime);
    }
    if (mode == 'month') {
      await this.sendChanges(kata, newData, 'month', nowTime);
    }

    await kata.updateInfo(newData, mode);
  }

  async sendChanges(kata, newData, mode, nowTime = new Date()) {
    const followers = await PG.getValidFollowers(kata.followers, mode);

    if (followers.length == 0) return;

    const oldData = await kata.getInfo(mode);
    let text = History.generateKataText(oldData, newData);

    console.log('[Text updated]', kata.cid, newData.name);

    text =
      `Changes «<a href="${Codewars.getKataLink(kata.cid)}"><b>${
        newData.name
      }</b></a>» in ${this.timeString(nowTime - oldData.time)}.\n` + text;

    const options = {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };

    // Sending messages

    for (const follower of followers) {
      //BOTTLENECK
      try {
        await this.bot.telegram.sendMessage(follower, text, options);
      } catch (e) {
        if (e.response.error_code != 403) {
          // If the user hasn't blocked us
          console.error(e);
        }
      }
    }
  }

  determineMode(date) {
    return date.getUTCHours() == this.HOUR_CHECK
      ? this.isLastDay(date)
        ? 'month'
        : 'day'
      : 'hour';
  }

  timeForNextCheck(mode = 'hour') {
    const nextHour = new Date();
    nextHour.setUTCHours(nextHour.getUTCHours() + 1);
    nextHour.setMinutes(0);
    nextHour.setSeconds(0);
    return nextHour - new Date();
  }

  timeOfPreviousCheck(mode = 'hour') {
    const nowTime = new Date();
    const hour = new Date(nowTime.toDateString());
    hour.setHours(nowTime.getHours());
    return hour;
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

  needProperties() {
    return `id, cid, followers, time, completed, stars, votes_very, votes_somewhat, votes_not, comments`;
  }

  floatUTCHour(date = new Date()) {
    return (date / 3600000) % 24;
  }

  isLastDay(date = new Date()) {
    const mutationDate = new Date(date.getTime());
    mutationDate.setUTCDate(mutationDate.getUTCDate() + 1);
    return mutationDate.getUTCDate() === 1;
  }

  static generateKataText(oldData, newData) {
    // data.property[0] - old, data.property[1] - new

    const plus = (delta) => (delta < 0 ? '' : '+');
    const sign = (num) => plus(num) + num;

    let text = '';

    if (oldData.completed != newData.completed) {
      const delta = newData.completed - oldData.completed;
      text += `${text ? '\n' : ''}\
Completed <b>${newData.completed}</b> times <i>(${sign(delta)})</i>`;
    }

    if (oldData.stars != newData.stars) {
      const delta = newData.stars - oldData.stars;
      text += `${text ? '\n' : ''}\
Stars: <b>${newData.stars}</b> <i>(${sign(delta)})</i>.`;
    }

    if (oldData.comments != newData.comments) {
      const delta = newData.comments - oldData.comments;
      text += `${text ? '\n' : ''}\
Comments: <b>${newData.comments}</b> <i>(${sign(delta)})</i>.`;
    }

    if (
      oldData.votes_very != newData.votes_very ||
      oldData.votes_somewhat != newData.votes_somewhat ||
      oldData.votes_not != newData.votes_not
    ) {
      oldData.totalVotes = oldData.votes_very + oldData.votes_somewhat + oldData.votes_not;
      newData.totalVotes = newData.votes_very + newData.votes_somewhat + newData.votes_not;

      oldData.rating =
        ((oldData.votes_very + oldData.votes_somewhat / 2) / oldData.totalVotes) * 100;
      newData.rating =
        ((newData.votes_very + newData.votes_somewhat / 2) / newData.totalVotes) * 100;

      const deltaVoites = newData.totalVotes - oldData.totalVotes;
      const deltaVery = newData.votes_very - oldData.votes_very;
      const deltaSomewhat = newData.votes_somewhat - oldData.votes_somewhat;
      const deltaNot = newData.votes_not - oldData.votes_not;
      text += `${text ? '\n' : ''}\
Rating was changed.
Votes: <b>${newData.totalVotes}</b> <i>(${sign(deltaVoites)})</i>
  Very: <b>${newData.votes_very}</b> <i>(${sign(deltaVery)})</i>
  Somewhat: <b>${newData.votes_somewhat}</b> <i>(${sign(deltaSomewhat)})</i>
  Not much: <b>${newData.votes_not}</b> <i>(${sign(deltaNot)})</i>

Rating: <b>${oldData.rating.toFixed(2)}%</b> => <b>${newData.rating.toFixed(2)}%</b>`;
    }

    return text;
  }
}

export default History;
