export const pick = (obj, fields) => {
  const o = {};
  for (const f of fields) if (obj[f] !== undefined) o[f] = obj[f];
  return o;
};