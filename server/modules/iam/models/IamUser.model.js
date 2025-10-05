// modules/iam/models/IamUser.model.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const IamUserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true, trim: true, lowercase: true },
  name:     { type: String, required: true, trim: true },
  email:    { type: String, trim: true, lowercase: true },
  phone:    { type: String, trim: true },
  password: { type: String, required: true, select: false }, // hash
  roles:    { type: [String], default: [] },                  // ej: ["admin","guard"]
  perms:    { type: [String], default: [] },                  // ej: ["iam.users.manage"]
  active:   { type: Boolean, default: true },
}, { timestamps: true });

// Hash antes de guardar si cambió la contraseña
IamUserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Métodos de ayuda
IamUserSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

const IamUser = mongoose.model("IamUser", IamUserSchema);
export default IamUser;
