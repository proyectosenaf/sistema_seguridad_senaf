// server/modules/rondas/utils/async.util.js
export const asyncWrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
