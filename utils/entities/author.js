import fetch from 'node-fetch';
import { CodewarsKataArray } from './codewarsKata.js';
import Codewars from './../codewars.js';

class Author {
  constructor(name) {
    this.name = name;
  }

  async initKatas() {
    const response = await fetch(Codewars.getAuthorsKatasAPILink(this.name));
    if (response.status === 404) {
      this.katas = null;
      return;
    }

    this.katas = new CodewarsKataArray(...(await response.json()).data);
  }
}

export default Author;
