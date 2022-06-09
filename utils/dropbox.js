import { Dropbox } from 'dropbox';
import fs from 'fs';
import path from 'path';

const dbx = new Dropbox({
  refreshToken: global.process.env.DROPBOX_REFRESH_TOKEN,
  clientId: global.process.env.DROPBOX_APP_KEY,
  clientSecret: global.process.env.DROPBOX_APP_SECRET,
});

class Dbfs {
  static async readFile(path) {
    const f = await dbx.filesDownload({ path });
    return f.result.fileBinary;
  }

  static async writeFile(path, contents, flag) {
    return await dbx.filesUpload({ path, contents, mode: 'overwrite' });
  }

  static async copyFile(from_path, to_path) {
    return await dbx.filesCopyV2({ from_path, to_path });
  }

  static async addToFile(path, contents) {
    const oldFile = await Dbfs.readFile(path);
    const newFile = Buffer.concat([oldFile, contents]);
    await Dbfs.writeFile(path, newFile);
  }

  static async deleteFile(path) {
    dbx.filesDelete({ path });
  }

  static async getMetadata(path) {
    return (await dbx.filesGetMetadata({ path })).result;
  }
}

class DbfsSynchronizer {
  #mainQueue;
  #queueFunctions;

  constructor(dbx, dbfs) {
    this.dbx = dbx;
    this.dbfs = dbfs;

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
        const localPath = this.dbfs.constructLocalPath(filePath);
        const dbPath = this.dbfs.constructDbPath(filePath);
        const contents = fs.readFileSync(localPath);

        await this.dbx.filesUpload({ path: dbPath, contents, mode: 'overwrite' });
      },

      delete: async (filePath) => {
        const dbPath = this.dbfs.constructDbPath(filePath);

        await this.dbx.filesDeleteV2({ path: dbPath });
      },

      copy: async (from_path, to_path) => {
        const dbFromPath = this.dbfs.constructDbPath(from_path);
        const dbToPath = this.dbfs.constructDbPath(to_path);

        await dbx.filesCopyV2({ from_path: dbFromPath, to_path: dbToPath });
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

class DbfsCashe {
  constructor(options) {
    options = options || {};

    this.dbRoot = options.dbRoot || '';
    this.localRoot = options.localRoot || '';

    this.dbfsSynchronizer = new DbfsSynchronizer(dbx, this);
  }

  async readFile(filePath, options = {}) {
    const localFilePath = this.constructLocalPath(filePath);
    try {
      return fs.readFileSync(localFilePath, options);
    } catch (err) {
      if (err.errno == -4058) {
        // No such file or directory
        // It means that file is not loaded yet

        await this.downloadFile(filePath);
        return fs.readFileSync(localFilePath, options);
      } else {
        throw err;
      }
    }
  }

  async writeFile(filePath, data, options) {
    const localFilePath = this.constructLocalPath(filePath);
    const dbFolderPath = this.constructDbPath(path.dirname(filePath));

    try {
      fs.writeFileSync(localFilePath, data, options);
    } catch (err) {
      if (err.errno == -4058) {
        // No such file or directory
        // This means that the path are not prepared
        // But does this path exist on dropbox?

        await dbx.filesListFolder({ path: dbFolderPath, limit: 1 });
        // An exception is thrown if the folder does not exist

        this.preparePath(localFilePath);
        fs.writeFileSync(localFilePath, data, options);
      } else {
        throw err;
      }
    }

    this.dbfsSynchronizer.addToWriteQueue(filePath);
  }

  async copyFile(from_path, to_path) {
    const localFromFilePath = this.constructLocalPath(from_path);
    const localToFilePath = this.constructLocalPath(to_path);
    const dbFromFilePath = this.constructDbPath(from_path);
    const dbToFolderPath = this.constructDbPath(path.dirname(to_path));

    try {
      fs.copyFileSync(localFromFilePath, localToFilePath);
    } catch (err) {
      if (err.errno == -4058) {
        // No such file or directory
        // This means that the file is not downloaded
        // But does this file exist on dropbox?

        await dbx.filesListFolder({ path: dbToFolderPath, limit: 1 });
        await dbx.filesGetMetadata({ path: dbFromFilePath });
        // An exception is thrown if the folder does not exist

        this.preparePath(localToFilePath);
      } else {
        throw err;
      }

      this.dbfsSynchronizer.addToCopyQueue(from_path, to_path);
    }
  }

  appendFile() {
    // TODO
  }

  async deleteFile(filePath) {
    const localFilePath = this.constructLocalPath(filePath);
    const dbFilePath = this.constructDbPath(filePath);

    try {
      fs.unlinkSync(localFilePath);
    } catch (err) {
      if (err.errno == -4058) {
        // No such file or directory
        // This means that the file is not downloaded
        // But does this file exist on dropbox?

        await dbx.filesGetMetadata({ path: dbFilePath });
        // An exception is thrown if the file does not exist
      } else {
        throw err;
      }
    }

    this.dbfsSynchronizer.addToDeleteQueue(filePath);
  }

  // Internal methods

  async downloadFile(filePath) {
    const file = await dbx.filesDownload({ path: this.constructDbPath(filePath) });

    const localFilePath = this.constructLocalPath(file.result.path_display);

    this.preparePath(localFilePath);
    fs.writeFileSync(localFilePath, file.result.fileBinary);
  }

  preparePath(filePath) {
    // Create folders for file

    const folders = path.dirname(filePath).split(/(?!^)\//);

    for (let i = 0; i < folders.length; i++) {
      const subFolder = path.join(...folders.slice(0, i + 1));

      if (!fs.existsSync(subFolder)) {
        fs.mkdirSync(subFolder);
      }
    }
  }

  constructDbPath(filePath) {
    return this.dbRoot + filePath;
  }

  constructLocalPath(filePath) {
    return this.localRoot + filePath.replace(this.dbRoot, '');
  }
}

const dbfs = new DbfsCashe({ dbRoot: '', localRoot: '/tmp' });

export default dbfs;
