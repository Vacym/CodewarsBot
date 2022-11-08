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

export function informationKb() {
  return Markup.inlineKeyboard([
    [Markup.button.url(`Github`, 'https://github.com/Vacym/codewarsBot')],
    [Markup.button.url(`Chat me`, 'https://t.me/Vacymm')],
    [backButton('menu')],
  ]);
}

export function paginationKb(currentPage = 1, pageCount, callbackStart = '') {
  function createButtonText(number) {
    return currentPage == number
      ? `-${number}-`
      : (number == 1 && currentPage > 3 ? '« ' : '') +
          number +
          (number == pageCount && currentPage < pageCount - 2 ? ' »' : '');
  }
  const secondButton = Math.max(2, Math.min(currentPage - 1, pageCount - 3));

  const numbers = [
    1,
    ...Array.from(Array(Math.min(pageCount - 2, 3)), (_, x) => secondButton + x),
    pageCount,
  ];
  return Array.from(numbers, (x) => Markup.button.callback(createButtonText(x), callbackStart + x));
}
