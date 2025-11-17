import mongoose from "mongoose";
const { Schema } = mongoose;

const IamAuditSchema = new Schema(
  {
    action:     { type: String, index: true },                 // create | update | delete | activate | deactivate
    entity:     { type: String, enum: ["user","role","permission"], index: true },
    entityId:   { type: String, index: true },
    actorId:    { type: String, index: true, sparse: true },
    actorEmail: { type: String, index: true },                 // usamos regex/i en GET
    before:     Schema.Types.Mixed,
    after:      Schema.Types.Mixed,
  },
  {
    timestamps: true,           // createdAt / updatedAt
    versionKey: false,
    minimize: false,            // guarda objetos vacíos si llegan
  }
);

/* =========================
 * Índices compuestos (consultas típicas)
 * =======================*/
IamAuditSchema.index({ createdAt: -1 });                         // ordenación por fecha
IamAuditSchema.index({ entity: 1, action: 1, createdAt: -1 });   // filtro por entidad/acción + rango
IamAuditSchema.index({ actorEmail: 1, createdAt: -1 });          // filtro por actor + rango
IamAuditSchema.index({ entity: 1, createdAt: -1 });              // solo entidad + rango
IamAuditSchema.index({ action: 1, createdAt: -1 });              // solo acción + rango

/* =========================
 * (Opcional) TTL para limpieza automática
 * Descomenta si quisieras expirar registros viejos (ej. 180 días)
 * =======================*/
// IamAuditSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

export default mongoose.model("IamAudit", IamAuditSchema);
