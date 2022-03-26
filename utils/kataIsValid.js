const kataIsValid = (str) => {
  return /^[a-z0-9]{24}$/.test(str);
};

function convertAuthorOrKata(str) {
  let reResult = str.match(/www\.codewars\.com\/(\w*)\/([^/]+)/);
  if (reResult === null || reResult[1] == 'kata') {
    const isKata = kataIsValid(str) || kataIsValid(reResult?.[2]);
    if (isKata) {
      return { type: 'kata', object: reResult?.[2] || str };
    }
  }
  if (reResult === null || reResult[1] == 'users') {
    return { type: 'users', object: reResult?.[2] || str };
  }
  return { type: null, object: null };
}

export default convertAuthorOrKata;
