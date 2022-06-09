import { Dropbox } from 'dropbox';
import { Dbxfs } from './dbxfs/dbxfs.js';

const dbx = new Dropbox({
  refreshToken: global.process.env.DROPBOX_REFRESH_TOKEN,
  clientId: global.process.env.DROPBOX_APP_KEY,
  clientSecret: global.process.env.DROPBOX_APP_SECRET,
});

const dbxfs = new Dbxfs({ dbxRoot: '/testHistory', localRoot: '/tmp', dbx });

export default dbxfs;
