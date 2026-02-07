// server/modules/rondasqr/jobs/assignDailyRounds.js
import RqRound from "../models/RqRound.model.js";
import IamUser from "../../iam/models/IamUser.model.js";
import RqAssignment from "../models/RqAssignment.model.js";

/**
 * YYYY-MM-DD en zona horaria de Honduras.
 * FIX: evita UTC shift de toISOString() (HN = America/Tegucigalpa)
 */
function todayStrHN(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Tegucigalpa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export async function assignDailyRounds({ date = todayStrHN(), io, notifier } = {}) {
  // idempotente: si ya existe la asignación para date/guard/round, no duplica
  const rounds = await RqRound.find({ active: true }).lean();
  const guards = await IamUser.find({ roles: "guardia", active: true }).lean();

  for (const r of rounds) {
    for (const g of guards) {
      const res = await RqAssignment.updateOne(
        { date, guardId: String(g._id), roundId: r._id },
        {
          $setOnInsert: {
            status: "assigned",
            notified: false,
            notifiedAt: null,
            notifiedBy: null,
          },
        },
        { upsert: true }
      );

      if (res?.upsertedCount > 0 && notifier) {
        try {
          await notifier.generic({
            userId: String(g._id),
            title: "Nueva ronda asignada",
            body: `${r?.name || "Ronda"} — ${date}`,
            meta: { roundId: String(r._id), date },
          });
        } catch (e) {
          console.warn("[assignDailyRounds] notify error:", e?.message || e);
        }
      }

      // Si en tu socket server usas room `guard-<id>`, puedes emitir aquí (no lo fuerzo para no romper):
      // if (io && res?.upsertedCount > 0) io.to(`guard-${String(g._id)}`).emit("rondasqr:nueva-asignacion", {...});
    }
  }

  return { ok: true, rounds: rounds.length, guards: guards.length, date };
}
