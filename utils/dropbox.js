import { Dropbox } from 'dropbox';

const dbx = new Dropbox({
  accessToken: global.process.env.DROPBOX_TOKEN,
});
const dpfPrototipe = {
  readFile() {},
};

class dbfs {
  async open(path) {
    const dbfd = {
      path,
    };
    Object.setPrototypeOf(dbfd, dpfPrototipe);
    return dbfd;
  }

  async readFile(path) {
    const f = await dbx.filesDownload({ path });
    return f.result.fileBinary;
  }

  async writeFile(path, contents, flag) {
    dbx.filesUpload({ path, contents, mode: 'overwrite' });
  }

  async getMetadata(path) {
    return (await dbx.filesGetMetadata({ path })).result;
  }
}

export default new dbfs();
