import mongoose from "mongoose";
const schema = new mongoose.Schema({
  action:     String,   // user.create / role.update / perm.delete
  entity:     String,   // user | role | permission
  entityId:   String,
  actorId:    String,
  actorEmail: String,
  before:     Object,
  after:      Object
}, { timestamps: true });
export default mongoose.model("IamAudit", schema);
