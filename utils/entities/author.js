import fetch from 'node-fetch';
import { CodewarsKataArray } from './codewarsKata.js';

class Author {
  constructor(name) {
    this.name = name;
  }

  async initKatas() {
    const response = await fetch(
      `https://www.codewars.com/api/v1/users/${this.name}/code-challenges/authored`
    );
    if (response.status === 404) {
      this.katas = null;
      return;
    }

    this.katas = new CodewarsKataArray(...(await response.json()).data);
  }
}

export default Author;
