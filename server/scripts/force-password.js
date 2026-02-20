//Realizar este script para forzar el cambio de contraseña del usuario admin@local,
//  creado el 19/02/2026 para implementar cambio de contraseña y vencimiento
import mongoose from "mongoose";
import IamUser from "../modules/iam/models/IamUser.model.js";
import "dotenv/config";

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const result = await IamUser.updateOne(
      { email: "admin@local" },
      { $set: { mustChangePassword: true } }
    );

    console.log("Usuario actualizado:", result);
    process.exit(0);

  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

run();
//Realizar este script para forzar el cambio de contraseña del usuario admin@local,
//  creado el 19/02/2026 para implementar cambio de contraseña y vencimiento