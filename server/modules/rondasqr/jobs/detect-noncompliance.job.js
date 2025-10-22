// jobs/detect-noncompliance.job.js
import { detectInactivity } from "../services/alerts.service.js";
import omissionsSvc from "../services/omissions.service.js";

export default function scheduleJobs(agenda) {
  // cada 5 min
  agenda.define("rq_detect_inactivity", async () => detectInactivity());
  agenda.every("5 minutes", "rq_detect_inactivity");

  // cada 10 min recalcular omisiones (incumplimiento)
  agenda.define("rq_detect_noncompliance", async () => {
    const from = new Date(Date.now()-24*60*60*1000).toISOString().slice(0,10);
    const to   = new Date().toISOString().slice(0,10);
    await omissionsSvc.findOmissions({ from, to }); // puedes persistir resultados/alertas si quieres
  });
  agenda.every("10 minutes", "rq_detect_noncompliance");
}
