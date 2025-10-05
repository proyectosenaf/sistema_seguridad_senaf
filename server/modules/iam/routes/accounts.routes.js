import { Router } from "express";
import mongoose from "mongoose";
import IamUser from "../models/IamUser.model.js";
import IamRole from "../models/IamRole.model.js";
import { requireAuth } from "../utils/iam.middleware.js";
import { iamAllowPerm } from "../utils/iam.middleware.js";

const r = Router();

// LISTAR usuarios
r.get("/", requireAuth, iamAllowPerm("iam.users.manage"), async (_req, res) => {
  const users = await IamUser.find().populate("roleId", "name code permissions").lean();
  res.json({ ok: true, items: users });
});

// CREAR usuario (campos de tu UI)
r.post("/", requireAuth, iamAllowPerm("iam.users.manage"), async (req, res) => {
  const { fullName, username, password, confirmPassword, email, phone, roleId, active } = req.body || {};

  if (!fullName || !username || !password || !confirmPassword || !roleId) {
    return res.status(400).json({ ok: false, error: "faltan_campos" });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ ok: false, error: "password_no_coincide" });
  }
  if (!mongoose.Types.ObjectId.isValid(roleId)) {
    return res.status(400).json({ ok: false, error: "rol_invalido" });
  }
  const role = await IamRole.findById(roleId);
  if (!role) return res.status(400).json({ ok: false, error: "rol_no_existe" });

  const exists = await IamUser.findOne({ username });
  if (exists) return res.status(409).json({ ok: false, error: "usuario_ya_existe" });

  const u = new IamUser({ fullName, username, email, phone, roleId, active: !!active });
  await u.setPassword(password);
  await u.save();

  res.status(201).json({ ok: true, data: { _id: u._id } });
});

// EDITAR usuario (sin obligar a cambiar pass)
r.patch("/:id", requireAuth, iamAllowPerm("iam.users.manage"), async (req, res) => {
  const { id } = req.params;
  const { fullName, email, phone, roleId, active, password, confirmPassword } = req.body || {};

  const u = await IamUser.findById(id);
  if (!u) return res.status(404).json({ ok: false, error: "no_encontrado" });

  if (roleId) {
    if (!mongoose.Types.ObjectId.isValid(roleId)) return res.status(400).json({ ok: false, error: "rol_invalido" });
    const role = await IamRole.findById(roleId);
    if (!role) return res.status(400).json({ ok: false, error: "rol_no_existe" });
    u.roleId = roleId;
  }
  if (fullName != null) u.fullName = fullName;
  if (email != null) u.email = email;
  if (phone != null) u.phone = phone;
  if (active != null) u.active = !!active;

  if (password || confirmPassword) {
    if (password !== confirmPassword) {
      return res.status(400).json({ ok: false, error: "password_no_coincide" });
    }
    await u.setPassword(password);
  }

  await u.save();
  res.json({ ok: true });
});

export default r;
