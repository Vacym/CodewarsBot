import { Dropbox } from 'dropbox';
import fetch from 'node-fetch';
import './../env.js';

const dbx = new Dropbox({
  refreshToken: global.process.env.DROPBOX_REFRESH_TOKEN,
  clientId: global.process.env.DROPBOX_APP_KEY,
  clientSecret: global.process.env.DROPBOX_APP_SECRET,
});
const dpfPrototipe = {
  readFile() {},
};

class dbfs {
  static async open(path) {
    const dbfd = {
      path,
    };
    Object.setPrototypeOf(dbfd, dpfPrototipe);
    return dbfd;
  }

  static async readFile(path) {
    const f = await dbx.filesDownload({ path });
    return f.result.fileBinary;
  }

  static async writeFile(path, contents, flag) {
    return await dbx.filesUpload({ path, contents, mode: 'overwrite' });
  }

  static async addToFile(path, contents) {
    const oldFile = await dbfs.readFile(path);
    const newFile = Buffer.concat([oldFile, contents]);
    await dbfs.writeFile(path, newFile);
  }

  static async getMetadata(path) {
    return (await dbx.filesGetMetadata({ path })).result;
  }
}

export default dbfs;
