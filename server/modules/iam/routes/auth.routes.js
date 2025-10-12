import { Router } from "express";
import { buildContextFrom } from "../utils/rbac.util.js";
const r = Router();

r.get("/me", async (req,res,next)=>{
  try {
    const ctx = await buildContextFrom(req);
    res.json({ user: ctx.user, roles: ctx.roles, permissions: ctx.permissions });
  } catch (e) { next(e); }
});

export default r;
