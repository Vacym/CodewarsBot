import { Dropbox } from 'dropbox';
import fs from 'fs';
import path from 'path';

const dbx = new Dropbox({
  refreshToken: global.process.env.DROPBOX_REFRESH_TOKEN,
  clientId: global.process.env.DROPBOX_APP_KEY,
  clientSecret: global.process.env.DROPBOX_APP_SECRET,
});

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
      console.log('start operation queue');
      this.#startQueue();
    }
  }
  async #startQueue() {
    // While loop with await
    // Cheap and cheerful

    while (this.#mainQueue.length > 0) {
      await this.#queueFunctions[this.#mainQueue[0].type](...this.#mainQueue[0].parameters);
      console.log('operation next', this.#mainQueue.length);
      this.#mainQueue.shift();
    }
    console.log('end operation queue');
  }
}

class DbxfsCashe {
  constructor(options) {
    options = options || {};

    this.dbx = options.dbx;
    this.dbxRoot = options.dbxRoot || '';
    this.localRoot = options.localRoot || '';

    this.dbxfsSynchronizer = new DbxfsSynchronizer(this.dbx, this);
  }

  async readFile(filePath, options = {}) {
    const localFilePath = this.constructLocalPath(filePath);
    try {
      return fs.readFileSync(localFilePath, options);
    } catch (err) {
      if (err.code === 'ENOENT') {
        // No such file or directory
        // It means that file is not loaded yet

        await this.#downloadFile(filePath);
        return fs.readFileSync(localFilePath, options);
      } else {
        throw err;
      }
    }
  }

  async writeFile(filePath, data, options) {
    const localFilePath = this.constructLocalPath(filePath);
    const dbxFolderPath = this.constructDbxPath(path.dirname(filePath));

    try {
      fs.writeFileSync(localFilePath, data, options);
    } catch (err) {
      if (err.code === 'ENOENT') {
        // No such file or directory
        // This means that the path are not prepared
        // But does this path exist on dropbox?

        await this.dbx.filesListFolder({ path: dbxFolderPath, limit: 1 });
        // An exception is thrown if the folder does not exist

        this.#preparePath(localFilePath);
        fs.writeFileSync(localFilePath, data, options);
      } else {
        throw err;
      }
    }

    this.dbxfsSynchronizer.addToWriteQueue(filePath);
  }

  async copyFile(from_path, to_path) {
    const localFromFilePath = this.constructLocalPath(from_path);
    const localToFilePath = this.constructLocalPath(to_path);
    const dbxFromFilePath = this.constructDbxPath(from_path);
    const dbxToFolderPath = this.constructDbxPath(path.dirname(to_path));

    try {
      fs.copyFileSync(localFromFilePath, localToFilePath);
    } catch (err) {
      if (err.code === 'ENOENT') {
        // No such file or directory
        // This means that the file is not downloaded
        // But does this file exist on dropbox?

        await this.dbx.filesListFolder({ path: dbxToFolderPath, limit: 1 });
        await this.dbx.filesGetMetadata({ path: dbxFromFilePath });
        // An exception is thrown if the folder does not exist

        this.#preparePath(localToFilePath);
      } else {
        throw err;
      }

      this.dbxfsSynchronizer.addToCopyQueue(from_path, to_path);
    }
  }

  appendFile() {
    // TODO
  }

  async deleteFile(filePath) {
    const localFilePath = this.constructLocalPath(filePath);
    const dbxFilePath = this.constructDbxPath(filePath);

    try {
      fs.unlinkSync(localFilePath);
    } catch (err) {
      if (err.code === 'ENOENT') {
        // No such file or directory
        // This means that the file is not downloaded
        // But does this file exist on dropbox?

        await this.dbx.filesGetMetadata({ path: dbxFilePath });
        // An exception is thrown if the file does not exist
      } else {
        throw err;
      }
    }

    this.dbxfsSynchronizer.addToDeleteQueue(filePath);
  }

  // Internal methods

  async #downloadFile(filePath) {
    const file = await this.dbx.filesDownload({ path: this.constructDbxPath(filePath) });

    const localFilePath = this.constructLocalPath(file.result.path_display);

    this.#preparePath(localFilePath);
    fs.writeFileSync(localFilePath, file.result.fileBinary);
  }

  #preparePath(filePath) {
    // Create folders for file

    const folders = path.dirname(filePath).split(/(?!^)\//);

    for (let i = 0; i < folders.length; i++) {
      const subFolder = path.join(...folders.slice(0, i + 1));

      if (!fs.existsSync(subFolder)) {
        fs.mkdirSync(subFolder);
      }
    }
  }

  constructDbxPath(filePath) {
    return this.dbxRoot + filePath;
  }

  constructLocalPath(filePath) {
    return this.localRoot + filePath.replace(this.dbxRoot, '');
  }
}

const dbxfs = new DbxfsCashe({ dbxRoot: '/history', localRoot: 'file:///tmp', dbx });

export default dbxfs;
