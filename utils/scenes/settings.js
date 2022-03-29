import { Scenes } from 'telegraf';

const settingsScene = new Scenes.WizardScene('settings', (ctx) => {
  ctx.reply('Very soon!');
  return ctx.scene.leave();
});

export { settingsScene };
