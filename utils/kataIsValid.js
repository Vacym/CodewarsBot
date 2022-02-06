const kataIsValid = (str) => {
  // eslint-disable-next-line no-useless-escape
  let kataId = str.match(/www\.codewars\.com\/kata\/([^\/]+)/);
  kataId = kataId ? kataId[1] : str; // Link or just id
  return /^[a-z0-9]{24}$/.test(kataId) ? kataId : null;
};

export default kataIsValid;
