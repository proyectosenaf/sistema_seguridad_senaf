// server/modules/iam/routes/auth.routes.js
import { Router } from "express";
import { requireAuth } from "../utils/auth.util.js";

const r = Router();

// /api/iam/v1/auth/me
r.get("/me", requireAuth, (req, res) => {
  res.json({
    ok: true,
    user: {
      id: req.user.id,
      roles: req.user.roles || [],
      perms: req.user.perms || [],
    },
  });
});

export default r;
