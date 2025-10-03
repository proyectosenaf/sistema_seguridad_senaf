import mongoose from "mongoose";

const SupervisionPlanSchema = new mongoose.Schema({
  guardia: { type: String, required: true, trim: true },
  area:    { type: String, required: true, trim: true },

  // periodicidad
  frecuencia: { type: String, enum: ["diaria","semanal","mensual"], required: true },
  diasSemana: [{ type: Number }], // 0=Dom .. 6=Sáb (solo semanal)
  diaMes: { type: Number },       // 1..31 (solo mensual)
  hora:   { type: String, default: "09:00" }, // "HH:mm"

  inicio: { type: Date, default: Date.now },
  fin:    { type: Date, default: null },

  activo: { type: Boolean, default: true },

  // quién creó el plan
  createdBy: { sub: String, name: String, email: String },
}, { timestamps: true });

export default mongoose.model("SupervisionPlan", SupervisionPlanSchema);
// (Opcional) Puedes agregar métodos estáticos o de instancia si es necesario
// Ejemplo: SupervisionPlanSchema.statics.findActive = function() { return this.find({ activo: true }); };
// Ejemplo: SupervisionPlanSchema.methods.isActive = function() { return this.activo    