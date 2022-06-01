import fetch from 'node-fetch';
import cheerio from 'cheerio';

const server = 'https://www.codewars.com/';

export default class Codewars {
  static getKataLink(cid) {
    return server + 'kata/' + cid;
  }

  static getKataAPILink(cid) {
    return server + 'api/v1/code-challenges/' + cid;
  }

  static getAuthorsKatasAPILink(author) {
    return `${server}api/v1/users/${author}/code-challenges/authored`;
  }

  static async getKataAPIInfo(cid) {
    return await (await fetch(Codewars.getKataAPILink(cid))).json();
  }
  static async getAuthorsKatasAPIInfo(author) {
    return await (await fetch(Codewars.getAuthorsKatasAPILink(author))).json();
  }

  static async getKataFullInfo(cid) {
    // Retrieves advanced information about the kata from its web page

    function shorten(info) {
      const shortInfo = {};
      const shortNames = {
        'Total Times Completed': 'completed',
        'Total Stars': 'stars',
        'Total "Very Satisfied" Votes': 'votes_very',
        'Total "Somewhat Satisfied" Votes': 'votes_somewhat',
        'Total "Not Satisfied" Votes': 'votes_not',
      };

      for (const oldName in info) {
        if (oldName in shortNames) {
          shortInfo[shortNames[oldName]] = +info[oldName];
        }
      }
      shortInfo.name = info.name;
      shortInfo.comments = parseInt(info.comments);
      shortInfo.id = cid;

      return shortInfo;
    }

    const info = {};
    try {
      const response = await fetch(Codewars.getKataLink(cid));
      const req = await response.text();
      const $ = cheerio.load(req);

      $('.w-full.panel.bg-ui-section:last-child tr').each(function () {
        info[$(this).children(':not(.text-right)').text()] = $(this).children('.text-right').text();
      });

      info.name = $('meta[property="og:title"]').attr('content');
      info.comments =
        $('.icon-moon-comments')
          .parent()
          .text()
          .match(/\((\d+)\)/)?.[1] ?? 0;
    } catch (e) {
      console.log(e);
      throw e;
    }

    return shorten(info);
  }
}
