# Codewars Bot

The unofficial [Telegram bot](https://t.me/codewars_bot) for Codewars.

This Telegram bot can help you keep track of your katas' changes.

## Project Status

Early stage. Expect breaking changes.

Feedback is appreciated (GitHub issues).

## Configuration

> TODO: write a description for each variable.

The following environment variables are required:

- `DATABASE_URL`: Database access string
- `TOKEN`: Access token for telegram bot
- `MODE`: Empty string in local and not empty in server
- `ADMINS`: List of admins
- `DROPBOX_REFRESH_TOKEN`:
- `DROPBOX_APP_KEY`:
- `DROPBOX_APP_SECRET`:

Use `.env` (gitignored) to configure these variables.

## Development Setup

> TODO: write development setup (if somebody will need it)

### Code Style

[Prettier](https://prettier.io/) is used to ensure consistent style. I use the settings that are in git

It's recommended to [configure your editor](https://prettier.io/docs/en/editors.html) to format on save, and forget about formatting.

## License

[MIT](./LICENSE)
