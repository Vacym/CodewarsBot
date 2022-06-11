import fs from 'fs';

class DbxfsSynchronizer {
  #mainQueue;
  #queueFunctions;

  constructor(dbx, dbxfs) {
    this.dbx = dbx;
    this.dbxfs = dbxfs;

    this.#mainQueue = [];

    this.#generateAllQueueHandlers();
  }

  addToWriteQueue(filePath) {
    this.#addToQueue('write', [filePath]);
  }

  addToDeleteQueue(filePath) {
    this.#addToQueue('delete', [filePath]);
  }

  addToCopyQueue(from_path, to_path) {
    this.#addToQueue('copy', [from_path, to_path]);
  }

  #generateAllQueueHandlers() {
    this.#queueFunctions = {
      write: async (filePath) => {
        const localPath = this.dbxfs.constructLocalPath(filePath);
        const dbxPath = this.dbxfs.constructDbxPath(filePath);
        const contents = fs.readFileSync(localPath);

        await this.dbx.filesUpload({ path: dbxPath, contents, mode: 'overwrite' });
      },

      delete: async (filePath) => {
        const dbxPath = this.dbxfs.constructDbxPath(filePath);

        await this.dbx.filesDeleteV2({ path: dbxPath });
      },

      copy: async (from_path, to_path) => {
        const dbxFromPath = this.dbxfs.constructDbxPath(from_path);
        const dbxToPath = this.dbxfs.constructDbxPath(to_path);

        await this.dbx.filesCopyV2({ from_path: dbxFromPath, to_path: dbxToPath });
      },
    };
  }

  #addToQueue(type, parameters) {
    const emptyQueue = this.#mainQueue.length === 0;
    this.#mainQueue.push({ type, parameters });

    if (emptyQueue) {
      this.#startQueue();
    }
  }
  async #startQueue() {
    // While loop with await
    // Cheap and cheerful

    while (this.#mainQueue.length > 0) {
      await this.#queueFunctions[this.#mainQueue[0].type](...this.#mainQueue[0].parameters);
      this.#mainQueue.shift();
    }
  }
}

export default DbxfsSynchronizer;
