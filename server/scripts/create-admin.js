import "dotenv/config";
import mongoose from "mongoose";
import IamUser from "../modules/iam/models/IamUser.model.js";
import { hashPassword } from "../modules/iam/utils/password.util.js";

async function main() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error("Falta MONGODB_URI en .env");
    }

    await mongoose.connect(mongoUri);
    console.log("Conectado a MongoDB");

    const email = "admin@local";
    const plainPassword = "Admin123*";

    const existing = await IamUser.findOne({ email });
    if (existing) {
      console.log("Usuario admin ya existe");
      process.exit(0);
    }

    const passwordHash = await hashPassword(plainPassword);

    const expires = new Date();
    expires.setMonth(expires.getMonth() + 2);

    const user = await IamUser.create({
      email,
      name: "Administrador",
      provider: "local",
      passwordHash,
      roles: ["admin"],
      perms: ["*"],
      active: true,
      mustChangePassword: true,
      passwordChangedAt: new Date(),
      passwordExpiresAt: expires
    });

    console.log("Usuario admin creado:");
    console.log("Email:", email);
    console.log("Password:", plainPassword);
    console.log("ID:", user._id);

    process.exit(0);

  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

main();