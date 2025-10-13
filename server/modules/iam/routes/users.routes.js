import { Router } from "express";
import IamUser from "../models/IamUser.model.js";
import { devOr, requirePerm } from "../utils/rbac.util.js";

const r = Router();

r.get("/", devOr(requirePerm("iam.users.manage")), async (req,res)=>{
  const q = String(req.query.q||"").toLowerCase();
  const users = await IamUser.find().sort({ name:1 }).lean();
  const items = users.filter(u => !q || `${u.name} ${u.email}`.toLowerCase().includes(q));
  res.json({ items });
});

r.post("/", devOr(requirePerm("iam.users.manage")), async (req,res)=>{
  const { name, email, roles=[], active=true } = req.body||{};
  const doc = await IamUser.create({ name, email, roles, active });
  res.status(201).json(doc);
});

r.patch("/:id", devOr(requirePerm("iam.users.manage")), async (req,res)=>{
  const { id } = req.params;
  const doc = await IamUser.findByIdAndUpdate(id, { $set: req.body||{} }, { new:true });
  if (!doc) return res.status(404).json({ message:"No encontrado" });
  res.json(doc);
});

r.post("/:id/enable", devOr(requirePerm("iam.users.manage")), async (req,res)=>{
  const { id } = req.params;
  const doc = await IamUser.findByIdAndUpdate(id, { $set: { active: true } }, { new:true });
  res.json(doc);
});

r.post("/:id/disable", devOr(requirePerm("iam.users.manage")), async (req,res)=>{
  const { id } = req.params;
  const doc = await IamUser.findByIdAndUpdate(id, { $set: { active: false } }, { new:true });
  res.json(doc);
});

export default r;
