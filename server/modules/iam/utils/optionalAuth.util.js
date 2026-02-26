// server/modules/iam/utils/optionalAuth.util.js
import { makeAuthMw } from "./auth.util.js";

export function makeOptionalAuthMw() {
  const authMw = makeAuthMw();
  const disableAuth = process.env.DISABLE_AUTH === "1";

  return (req, res, next) => {
    if (disableAuth) return next();

    const h = String(req.headers.authorization || "");
    if (!h.toLowerCase().startsWith("bearer ")) return next();

    return authMw(req, res, next);
  };
}

export default makeOptionalAuthMw;