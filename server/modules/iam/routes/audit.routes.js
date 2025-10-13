// server/modules/iam/routes/audit.routes.js
import { Router } from "express";
import mongoose from "mongoose";
import { devOr, requirePerm } from "../utils/rbac.util.js";

const r = Router();

// Schema opcional (si ya tienes un modelo IamAudit, esto no lo rompe)
const IamAuditSchema = new mongoose.Schema(
  {
    action: String,
    entity: String,
    entityId: String,
    actorId: String,
    actorEmail: String,
    before: Object,
    after: Object,
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

// Devuelve items aunque la colección no exista (-> [])
r.get("/", devOr(requirePerm("iam.roles.manage")), async (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit || 100)));
  try {
    // Usa modelo si está/puede crearse
    const Audit =
      mongoose.models.IamAudit ||
      mongoose.model("IamAudit", IamAuditSchema, "iamaudits");

    const items = await Audit.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json({ items });
  } catch (_e) {
    // Fallback: intenta directo con la colección (si no hay schema/model)
    try {
      const col =
        mongoose.connection?.collection("iamaudits") ||
        mongoose.connection?.collection("iam_audit");
      if (!col) return res.json({ items: [] });

      const items = await col
        .find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      return res.json({ items });
    } catch {
      return res.json({ items: [] });
    }
  }
});

export default r;
