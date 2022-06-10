import { Markup } from 'telegraf';

export function mainMenuKb() {
  return Markup.keyboard([
    ['Add kata', 'Delete kata'],
    ['Add author', 'Delete author'],
    ['Menu'],
  ]).resize();
}

export function yesNoKb(yes, no) {
  return Markup.inlineKeyboard(
    [Markup.button.callback('Yes', yes), Markup.button.callback('No', no)],
    { columns: 2 }
  );
}

export function justYesNoKb() {
  return Markup.keyboard([['Yes', 'No']]).resize();
}

export function removeKd() {
  return Markup.removeKeyboard();
}

export function backButton(link) {
  return Markup.button.callback('<- Back', link);
}

export function settingsKb(settings) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(`Hourly ${settings.hour ? '✅' : '❌'}`, 'toggle_hour')],
    [Markup.button.callback(`Daily ${settings.day ? '✅' : '❌'}`, 'toggle_day')],
    [Markup.button.callback(`Monthly ${settings.month ? '✅' : '❌'}`, 'toggle_month')],
    [backButton('menu')],
  ]);
}

export function approvedBetaKatasKb() {
  return Markup.keyboard([['Approved', 'Beta'], ['Both'], ['Neither']]).resize();
}

export function iformationKb() {
  return Markup.inlineKeyboard([
    [Markup.button.url(`Github`, 'https://github.com/Vacym/codewarsBot')],
    [Markup.button.url(`Chat me`, 'https://t.me/Vacymm')],
    [backButton('menu')],
  ]);
}
