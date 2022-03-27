import fetch from 'node-fetch';
import cherio from 'cherio';

export default class Codewars {
  #codewars = 'https://www.codewars.com/';

  getKataLink(cid) {
    return this.#codewars + 'kata/' + cid;
  }

  getKataAPILink(cid) {
    return this.#codewars + 'api/v1/code-challenges/' + cid;
  }

  getAuthorsKatasAPILink(author) {
    return `${this.#codewars}api/v1/users/${author}/code-challenges/authored`;
  }

  async getKataAPIInfo(kata) {
    return await (await fetch(this.getKataAPILink(kata))).json();
  }
  async getAuthorsKatasAPIInfo(author) {
    return await (await fetch(this.getAuthorsKatasAPILink(author))).json();
  }

  async getKataFullInfo(cid) {
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
      const response = await fetch(this.getKataLink(cid));
      const req = await response.text();
      const $ = cherio.load(req);

      $('.w-full.panel.bg-ui-section:last-child tr').each(function () {
        info[$(this).children(':not(.text-right)').text()] = $(this).children('.text-right').text();
      });

      info.name = $('.ml-4.mb-3').text();
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
