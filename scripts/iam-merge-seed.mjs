// scripts/iam-merge-seed.mjs
import { MongoClient } from "mongodb";
import { permisosKeys, rolesKeys } from "../client/src/iam/catalog/perms.js";

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "senafseg";

const COL_PERMS = "iam_permissions";
const COL_ROLES = "iam_roles";

const DRY_RUN = String(process.env.DRY_RUN || "false") === "true";

const now = () => new Date();

const sameSet = (a = [], b = []) => {
  if (a.length !== b.length) return false;
  return a.every((x) => b.includes(x));
};

async function main() {
  if (!MONGODB_URI) {
    throw new Error("Falta MONGODB_URI");
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  console.log("DB:", DB_NAME);
  console.log("DRY_RUN:", DRY_RUN);

  await db.collection(COL_PERMS).createIndex({ key: 1 }, { unique: true });
  await db.collection(COL_ROLES).createIndex({ code: 1 }, { unique: true });

  // ===== PERMISOS =====
  let pInsert = 0, pUpdate = 0, pSkip = 0;

  for (const [key, label] of Object.entries(permisosKeys)) {
    const group = key.split(".")[0];
    const existing = await db.collection(COL_PERMS).findOne({ key });

    if (!existing) {
      pInsert++;
      if (!DRY_RUN) {
        await db.collection(COL_PERMS).insertOne({
          key,
          label,
          group,
          order: 0,
          createdAt: now(),
          updatedAt: now()
        });
      }
      continue;
    }

    if (existing.label !== label || existing.group !== group) {
      pUpdate++;
      if (!DRY_RUN) {
        await db.collection(COL_PERMS).updateOne(
          { _id: existing._id },
          { $set: { label, group, updatedAt: now() } }
        );
      }
    } else {
      pSkip++;
    }
  }

  // ===== ROLES =====
  let rInsert = 0, rUpdate = 0, rSkip = 0;

  for (const [code, perms] of Object.entries(rolesKeys)) {
    const existing = await db.collection(COL_ROLES).findOne({ code });

    if (!existing) {
      rInsert++;
      if (!DRY_RUN) {
        await db.collection(COL_ROLES).insertOne({
          code,
          name: code,
          description: "",
          permissions: perms,
          createdAt: now(),
          updatedAt: now()
        });
      }
      continue;
    }

    const current = existing.permissions || [];

    if (!sameSet(current, perms)) {
      rUpdate++;
      if (!DRY_RUN) {
        await db.collection(COL_ROLES).updateOne(
          { _id: existing._id },
          { $set: { permissions: perms, updatedAt: now() } }
        );
      }
    } else {
      rSkip++;
    }
  }

  console.log("PERMISOS -> insert:", pInsert, "update:", pUpdate, "skip:", pSkip);
  console.log("ROLES    -> insert:", rInsert, "update:", rUpdate, "skip:", rSkip);

  await client.close();
  console.log("✅ FIN");
}

main().catch(console.error);
