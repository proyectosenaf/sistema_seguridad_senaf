import Zone from "../models/Zone.model.js";
import CP from "../models/Checkpoint.model.js";
import { asyncWrap } from "../../../utils/async.util.js";

export const listZones = asyncWrap(async (_req,res)=> res.json(await Zone.find({}).lean()));
export const createZone = asyncWrap(async (req,res)=>{
  const { name, code, description } = req.body;
  res.status(201).json(await Zone.create({ name, code, description, active:true }));
});
export const zoneCheckpoints = asyncWrap(async (req,res)=>{
  const cps = await CP.find({ zoneId:req.params.id, active:true }).sort({order:1}).lean();
  res.json(cps);
});
