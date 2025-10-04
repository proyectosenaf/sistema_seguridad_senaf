import CP from "../models/Checkpoint.model.js";
import { makeQR } from "../services/qr.service.js";
import { asyncWrap } from "../utils/async.util.js";

export const createCheckpoint = asyncWrap(async (req,res)=>{
  const { zoneId, code, name, order=1, expectedSecondsFromStart=0, graceSeconds=60 } = req.body;
  const cp = await CP.create({
    zoneId, code, name, order, expectedSecondsFromStart, graceSeconds,
    qrPayload:`senaf:rondas:checkpoint:${code}`,
  });
  res.status(201).json(cp);
});
export const getCheckpointQR = asyncWrap(async (req,res)=>{
  const { format="png" } = req.query;
  const cp = await CP.findById(req.params.id).lean();
  if(!cp) return res.status(404).end();
  const data = await makeQR(cp.qrPayload,{ type: format==="svg"?"svg":"png" });
  if(format==="svg"){ res.setHeader("Content-Type","image/svg+xml"); return res.send(data); }
  res.setHeader("Content-Type","image/png"); res.send(data);
});
