import { Router } from "express";
import IamRole from "../models/IamRole.model.js";
import { devOr, requirePerm } from "../utils/rbac.util.js";

const r = Router();

r.get("/", devOr(requirePerm("iam.roles.manage")), async (_req,res)=> {
  const items = await IamRole.find().sort({ name:1 }).lean();
  res.json({ items });
});

r.post("/", devOr(requirePerm("iam.roles.manage")), async (req,res)=>{
  const { code: rawCode, name, description, permissions=[] } = req.body || {};
  const code = (rawCode || name).toLowerCase().replace(/\s+/g,"_");
  const doc = await IamRole.create({ code, name, description, permissions });
  res.status(201).json(doc);
});

r.patch("/:id", devOr(requirePerm("iam.roles.manage")), async (req,res)=>{
  const { id } = req.params;
  const doc = await IamRole.findByIdAndUpdate(id, { $set: req.body||{} }, { new: true });
  if (!doc) return res.status(404).json({ message:"No encontrado" });
  res.json(doc);
});

r.delete("/:id", devOr(requirePerm("iam.roles.manage")), async (req,res)=>{
  const { id } = req.params;
  const role = await IamRole.findById(id).lean();
  if (!role) return res.status(404).json({ message:"No encontrado" });
  if ((role.name||"").toLowerCase()==="admin") return res.status(400).json({ message:"No se puede eliminar admin" });
  await IamRole.deleteOne({ _id:id });
  res.json({ ok:true });
});

export default r;
