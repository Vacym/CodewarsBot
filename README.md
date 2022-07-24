<!-- Some paragraphs were taken from https://github.com/codewars/discord-bot README.md. I hope they don't mind :) -->

[uri]: https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING 'Connection Strings'
[oauth]: https://www.dropbox.com/lp/developers/reference/oauth-guide 'OAuth guide'

# Codewars Bot

The unofficial [Telegram bot](https://t.me/codewars_bot) for Codewars.

This Telegram bot can help you keep track of your katas' changes.

## Project Status

Early stage. Expect breaking changes.

Feedback is appreciated (GitHub issues).

## Configuration

The following environment variables are required:

- `DATABASE_URI`: Database access string
- `TOKEN`: Access token for telegram bot
- `MODE`: Empty string in local and not empty in server
- `ADMINS`: List of admins
- `DROPBOX_REFRESH_TOKEN`,
- `DROPBOX_APP_KEY`,
- `DROPBOX_APP_SECRET`: Read [the OAuth Guide][oauth]
- `DROPBOX_PATH`: Folder with files at Dropbox in format **'/{folderName}'** or empty string

Use `.env` (gitignored) to configure these variables.

## Development Setup

- `bot`: You should [create telegram bot](https://core.telegram.org/bots#3-how-do-i-create-a-bot) and get it's token
- `database`:

  - `local`: [Install PostgreSQL](https://www.postgresql.org/download/), create database and write in **.env** file [URI][uri] in format **'{user}:{password}@{hostname}:{port}/{databaseName}'**

  - `remote`: Create PostgreSQL database on a remote server and write in **.env** file [URI][uri] that is displayed in the database properties

- `Dropbox`:

  - `Create app`: After creating account you should create app in [App Console](https://www.dropbox.com/developers/apps). You can get _Full Dropbox_ access and set folder with data in **DROPBOX_PATH** or get _App folder_ access and set empty string here
  - `Configure permissions`: You must give at least _files.content.write_ and _files.content.read_ permissions for your app
  - `Authorization`:

    1. Visit this url

       ```bash
       https://www.dropbox.com/oauth2/authorize?client_id=<App key>&response_type=code&token_access_type=offline
       ```

       Allow access and get **authorization_code**

    2. Run the command in the console and get refresh_token

       ```bash
       curl https://api.dropbox.com/oauth2/token -d code=<AUTHORIZATION_CODE> -d grant_type=authorization_code -u <APP_KEY>:<APP_SECRET>
       ```

    3. Set **Refresh token**, **App key** and **App secret** to **.env** file

    More information in [the OAuth Guide][oauth], [HTTP documentation](https://www.dropbox.com/developers/documentation/http/overview) and [this discussion](https://www.dropboxforum.com/t5/Dropbox-API-Support-Feedback/Oauth2-refresh-token-question-what-happens-when-the-refresh/td-p/486241)

  - `Prepare file storage`:

    Create path if you set it at **DROPBOX_PATH**.
    At this path create **lastMonthHistory** and **monthHistory** folders.

    Remember if you got **App folder** access, then your app in _'Apps'_ folder. This means that the root is in your app folder

## Startup

Install the [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) and run

```bash
npm run heroku
```

### Or

Just run

```bash
npm start
```

But so you should import **global.process.env** by yourself

---

## Code Style

[Prettier](https://prettier.io/) is used to ensure consistent style. I use the settings that are in git

It's recommended to [configure your editor](https://prettier.io/docs/en/editors.html) to format on save, and forget about formatting.

## License

[MIT](./LICENSE)
