// services/omissions.service.js
import RqPlan from "../models/RqPlan.model.js";
import RqRound from "../models/RqRound.model.js";
import RqPoint from "../models/RqPoint.model.js";
import RqMark from "../models/RqMark.model.js";

export default {
  async findOmissions({ from, to, siteId, roundId }) {
    // 1) cargar planes activos de la ronda en rango
    const rounds = roundId ? [roundId] : (await RqRound.find(siteId?{siteId}:{ }).select("_id").lean()).map(r=>r._id);
    const plans  = await RqPlan.find({ roundId: { $in: rounds }, active: true }).lean();

    // 2) generar ventanas esperadas (fecha/hora por punto)
    // (implementación compacta por brevedad; en prod puedes expandir)
    const expected = [];
    const start = new Date(from+"T00:00:00");
    const end   = new Date(to+"T23:59:59");
    for (const p of plans) {
      for (let d=new Date(start); d<=end; d.setDate(d.getDate()+1)) {
        if (!p.daysOfWeek.includes(d.getDay())) continue;
        const [hh,mm] = p.startTime.split(":").map(Number);
        const base = new Date(d); base.setHours(hh,mm,0,0);
        const times = [0]; // una vez, o repetición
        if (p.repeatEveryMinutes>0) {
          for (let t=p.repeatEveryMinutes; t<24*60; t+=p.repeatEveryMinutes) times.push(t);
        }
        for (const minutes of times) {
          const at = new Date(base.getTime()+minutes*60*1000);
          expected.push({ roundId:p.roundId, at, grace:(p.lateThresholdSeconds||180) });
        }
      }
    }

    // 3) buscar marcas reales
    const marks = await RqMark.find({ at: { $gte:start, $lte:end }, ...(siteId?{siteId}:{}) })
                   .select("roundId pointId at").lean();

    // 4) detectar omisiones por ventana
    const result = [];
    for (const ex of expected) {
      const within = marks.find(m => String(m.roundId)===String(ex.roundId) &&
         Math.abs(new Date(m.at)-ex.at)<= (ex.grace*1000));
      if (!within) {
        result.push({ roundId: ex.roundId, at: ex.at, state: "Omitido" });
      }
    }
    return result;
  }
};
