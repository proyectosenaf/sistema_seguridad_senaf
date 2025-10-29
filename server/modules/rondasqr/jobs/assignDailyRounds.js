// server/modules/rondasqr/jobs/assignDailyRounds.js
import RqRound from "../models/RqRound.model.js";
import IamUser from "../../iam/models/IamUser.model.js";
import RqAssignment from "../models/RqAssignment.model.js";

function todayStr(d = new Date()) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function assignDailyRounds({ date = todayStr(), io, notifier } = {}) {
  // idempotente: si ya existe la asignación para date/guard/round, no duplica
  const rounds = await RqRound.find({ active: true }).lean();
  const guards = await IamUser.find({ roles: "guardia", active: true }).lean();

  for (const r of rounds) {
    for (const g of guards) {
      const res = await RqAssignment.updateOne(
        { date, guardId: String(g._id), roundId: r._id },
        { $setOnInsert: { status: "assigned", notified: false, notifiedAt: null, notifiedBy: null } },
        { upsert: true }
      );

      // Si se insertó nuevo, puedes notificar aquí o dejar que otra cola lo haga:
      if (res.upsertedCount > 0 && notifier) {
        try {
          await notifier.generic({
            userId: String(g._id),
            title: "Nueva ronda asignada",
            body: `${r.name || "Ronda"} — ${date}`,
            meta: { roundId: String(r._id), date },
          });
        } catch (e) {
          console.warn("[assignDailyRounds] notify error:", e?.message || e);
        }
      }
    }
  }

  return { ok: true, rounds: rounds.length, guards: guards.length, date };
}
