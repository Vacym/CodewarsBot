// Took the original session and downgraded it to suit my needs

function session(options) {
  let _a;
  const getSessionKey =
    (_a = options === null || options === void 0 ? void 0 : options.getSessionKey) !== null &&
    _a !== void 0
      ? _a
      : defaultGetSessionKey;
  const store = {};

  return async (ctx, next) => {
    const key = await getSessionKey(ctx);
    if (key == null) {
      return await next();
    }
    ctx.session = store[key];

    if (ctx.session === void 0) {
      ctx.session = {};
      store[key] = ctx.session;
    }
    await next();
  };
}

async function defaultGetSessionKey(ctx) {
  var _a, _b;
  const fromId = (_a = ctx.from) === null || _a === void 0 ? void 0 : _a.id;
  const chatId = (_b = ctx.chat) === null || _b === void 0 ? void 0 : _b.id;
  if (fromId == null || chatId == null) {
    return undefined;
  }
  return `${fromId}:${chatId}`;
}

export { session };
