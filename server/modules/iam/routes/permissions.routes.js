// server/modules/iam/routes/permissions.routes.js
import { Router } from "express";
import IamPermission from "../models/IamPermission.model.js";
import { requirePerm, devOr } from "../utils/rbac.util.js";

const r = Router();

// Listar catálogo de permisos (agrupado por group)
r.get("/", devOr(requirePerm("iam.roles.manage")), async (_req, res) => {
  const docs = await IamPermission.find()
    .sort({ group: 1, order: 1, key: 1 })
    .lean();

  const groups = Object.values(
    docs.reduce((acc, d) => {
      (acc[d.group] ||= []).push(d);
      return acc;
    }, {})
  );

  res.json({ items: docs, groups });
});

// Crear permiso
r.post("/", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  const { key, label, group, order = 0 } = req.body || {};
  if (!key || !label || !group) {
    return res
      .status(400)
      .json({ message: "key, label y group son requeridos" });
  }

  // Evitar duplicados por key
  const exists = await IamPermission.findOne({ key }).lean();
  if (exists) {
    return res.status(409).json({ message: "Ya existe un permiso con esa key" });
  }

  const doc = await IamPermission.create({ key, label, group, order });
  res.status(201).json(doc);
});

// Actualizar permiso
r.patch("/:id", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  const { id } = req.params;
  const update = req.body || {};

  const doc = await IamPermission.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true }
  );

  if (!doc) return res.status(404).json({ message: "No encontrado" });
  res.json(doc);
});

// Eliminar permiso
r.delete("/:id", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  const { id } = req.params;

  const del = await IamPermission.deleteOne({ _id: id });
  if (del.deletedCount === 0) {
    return res.status(404).json({ message: "No encontrado" });
  }

  res.json({ ok: true });
});

export default r;
