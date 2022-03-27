class CodewarsKataArray extends Array {
  constructor(...katas) {
    if (katas.length === 1 && typeof katas[0] == 'number') {
      super(...katas);
      return;
    }

    super(
      ...katas.map((kata) => ({
        cid: kata.id ?? kata.cid,
        rank: kata.rank,
        name: kata.name,
      }))
    );
  }

  get approved() {
    return this.filter((kata) => kata.rank !== null);
  }
  get beta() {
    return this.filter((kata) => kata.rank === null);
  }

  get both() {
    return this;
  }

  get cids() {
    return Array.from(this.map((kata) => kata.cid));
  }

  get names() {
    return Array.from(this.map((kata) => kata.name));
  }
}

export { CodewarsKataArray };
