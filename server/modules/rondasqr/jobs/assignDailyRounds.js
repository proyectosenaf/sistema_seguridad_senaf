// server/modules/rondasqr/jobs/assignDailyRounds.js
import RqRound from "../models/RqRound.model.js";
import IamUser from "../../iam/models/IamUser.model.js";
import RqAssignment from "../models/RqAssignment.model.js";

function todayStr(d = new Date()) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function pickGuardId(user) {
  // ✅ Convención: guardId = Auth0 sub (estable)
  return user?.sub ? String(user.sub) : null;
}

function hasGuardRole(user) {
  const NS = process.env.IAM_ROLES_NAMESPACE || "https://senaf.local/roles";
  const roles = [
    ...(Array.isArray(user?.roles) ? user.roles : []),
    ...(Array.isArray(user?.[NS]) ? user[NS] : []),
  ]
    .map((r) => String(r).toLowerCase().trim())
    .filter(Boolean);

  return roles.includes("guardia") || roles.includes("guard") || roles.includes("rondasqr.guard");
}

export async function assignDailyRounds({ date = todayStr(), io, notifier } = {}) {
  // idempotente: si ya existe la asignación para date/guard/round, no duplica
  const rounds = await RqRound.find({ active: true }).lean();

  // ✅ Mejor: traer usuarios activos y filtrar rol guardia
  const users = await IamUser.find({ active: true }).lean();
  const guards = users.filter(hasGuardRole);

  for (const r of rounds) {
    for (const g of guards) {
      const guardId = pickGuardId(g);
      if (!guardId) continue;

      const res = await RqAssignment.updateOne(
        { date, guardId, roundId: r._id },
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

      // Si se insertó nuevo, puedes notificar aquí
      if (res.upsertedCount > 0) {
        // 🔔 notifier (push/email/etc)
        if (notifier?.generic) {
          try {
            await notifier.generic({
              userId: guardId,
              title: "Nueva ronda asignada",
              body: `${r.name || "Ronda"} — ${date}`,
              meta: { roundId: String(r._id), date },
            });
          } catch (e) {
            console.warn("[assignDailyRounds] notify error:", e?.message || e);
          }
        }

        // 🔔 socket: room guard-<sub>
        if (io) {
          try {
            io.to(`guard-${guardId}`).emit("rondasqr:nueva-asignacion", {
              title: "Nueva ronda asignada",
              body: `${r.name || "Ronda"} — ${date}`,
              meta: { roundId: String(r._id), date },
            });
          } catch (e) {
            console.warn("[assignDailyRounds] socket error:", e?.message || e);
          }
        }
      }
    }
  }

  return { ok: true, rounds: rounds.length, guards: guards.length, date };
}
