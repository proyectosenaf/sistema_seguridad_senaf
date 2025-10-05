// client/src/pages/IAM/IamAdminPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { iamApi } from "../../iam/iamApi";

const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Pill({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-2 py-1 rounded-md text-sm border",
        active
          ? "border-primary/60 bg-primary/10"
          : "border-neutral-700 hover:border-neutral-600",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
function Btn({ children, onClick, className = "", type = "button", disabled=false }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={
        "px-3 py-2 rounded-lg border border-neutral-700 hover:border-neutral-500 disabled:opacity-50 " +
        className
      }
    >
      {children}
    </button>
  );
}

export default function IamAdminPage() {
  const [tab, setTab] = useState("users"); // users | roles
  return (
    <main className="space-y-6">
      <h1 className="text-xl font-semibold">IAM — Administración</h1>
      <div className="flex gap-2">
        <Pill active={tab === "users"} onClick={() => setTab("users")}>Usuarios</Pill>
        <Pill active={tab === "roles"} onClick={() => setTab("roles")}>Roles</Pill>
      </div>
      {tab === "users" ? <UsersPanel /> : <RolesPanel />}
    </main>
  );
}

/* -------------------- Usuarios -------------------- */
function UsersPanel() {
  const [roles, setRoles] = useState([]);
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "", username: "", email: "", phone: "",
    password: "", confirm: "", active: true, roleIds: []
  });

  async function load() {
    setLoading(true); setError("");
    try {
      const r = await iamApi.listRoles();   setRoles(r.items || r);
      const a = await iamApi.listAccounts(q); setItems(a.items || a);
    } catch (e) { setError(e?.message || "No se pudo cargar IAM"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [q]);

  const v = useMemo(() => {
    const e = {};
    if (!form.name.trim()) e.name = "Requerido";
    if (!form.username.trim()) e.username = "Requerido";
    if (!form.email.trim()) e.email = "Requerido";
    else if (!emailRx.test(form.email.trim())) e.email = "Correo inválido";
    if (form.password || form.confirm) {
      if ((form.password || "").length < 8) e.password = "Mínimo 8 caracteres";
      if (form.password !== form.confirm) e.confirm = "No coincide";
    }
    if (!form.roleIds.length) e.roleIds = "Selecciona al menos un rol";
    return { ok: Object.keys(e).length === 0, errors: e };
  }, [form]);

  const toggleRoleChip = (rid) =>
    setForm(f => {
      const s = new Set(f.roleIds);
      s.has(rid) ? s.delete(rid) : s.add(rid);
      return { ...f, roleIds: [...s] };
    });

  async function create() {
    if (!v.ok) return;
    const payload = {
      name: form.name.trim(),
      username: form.username.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      active: !!form.active,
      roleIds: form.roleIds.slice(),
      password: form.password ? form.password : undefined,
    };
    setLoading(true); setError("");
    try {
      const created = await iamApi.createAccount(payload);
      if (created?._id && payload.roleIds?.length) {
        try { await iamApi.setAccountRoles(created._id, payload.roleIds); } catch {}
      }
      setForm({ name:"", username:"", email:"", phone:"", password:"", confirm:"", active:true, roleIds:[] });
      await load();
    } catch (e) { setError(e?.message || "No se pudo crear el usuario"); }
    finally { setLoading(false); }
  }

  const effectivePerms = useMemo(() => {
    const sel = new Set(form.roleIds.map(String));
    const all = roles.filter(r => sel.has(String(r._id))).flatMap(r => r.permissions || []);
    return [...new Set(all)].sort();
  }, [form.roleIds, roles]);

  return (
    <>
      {!!error && <div className="rounded-md border border-red-800/40 bg-red-900/10 px-3 py-2 text-sm text-red-300">{error}</div>}

      <section className="rounded-2xl border border-neutral-800 p-4">
        <h2 className="font-medium mb-3">Crear usuario (app)</h2>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-1">
            <label className="text-sm opacity-70">Nombre completo</label>
            <input className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
              placeholder="Juan Pérez" value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/>
            {v.errors.name && <div className="text-xs text-red-400 mt-1">{v.errors.name}</div>}
          </div>
          <div>
            <label className="text-sm opacity-70">Usuario</label>
            <input className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
              placeholder="jperez" value={form.username} onChange={e=>setForm({...form, username:e.target.value})}/>
            {v.errors.username && <div className="text-xs text-red-400 mt-1">{v.errors.username}</div>}
          </div>
          <div>
            <label className="text-sm opacity-70">Correo</label>
            <input className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
              placeholder="correo@empresa.com" value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/>
            {v.errors.email && <div className="text-xs text-red-400 mt-1">{v.errors.email}</div>}
          </div>
          <div>
            <label className="text-sm opacity-70">Teléfono</label>
            <input className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
              placeholder="+58 555-1234" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})}/>
          </div>
          <div>
            <label className="text-sm opacity-70">Contraseña</label>
            <input type="password" className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
              placeholder="********" value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/>
            {v.errors.password && <div className="text-xs text-red-400 mt-1">{v.errors.password}</div>}
          </div>
          <div>
            <label className="text-sm opacity-70">Confirmar contraseña</label>
            <input type="password" className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
              placeholder="********" value={form.confirm} onChange={e=>setForm({...form, confirm:e.target.value})}/>
            {v.errors.confirm && <div className="text-xs text-red-400 mt-1">{v.errors.confirm}</div>}
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.active} onChange={e=>setForm({...form, active:e.target.checked})}/>
              Activo
            </label>
            <button type="button" onClick={create} disabled={loading || !v.ok}
              className="ml-auto px-4 py-2 rounded-md border border-primary/60 bg-primary/20 hover:bg-primary/30 disabled:opacity-50">
              {loading ? "Guardando…" : "Crear"}
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-sm opacity-70 mb-1">Rol del usuario</div>
          <div className="flex flex-wrap gap-2">
            {roles.map(r => {
              const on = form.roleIds.includes(String(r._id));
              return (
                <button key={r._id} type="button" onClick={()=>toggleRoleChip(String(r._id))}
                  className={`px-3 py-1 rounded-md border text-sm ${on ? "border-primary/60 bg-primary/10":"border-neutral-700 hover:bg-neutral-800"}`}>
                  {r.name}
                </button>
              );
            })}
            {v.errors.roleIds && <div className="text-xs text-red-400 mt-1">{v.errors.roleIds}</div>}
          </div>
        </div>

        <div className="mt-3">
          <div className="text-sm opacity-70 mb-1">Permisos efectivos (por roles)</div>
          <div className="text-xs text-neutral-300 bg-neutral-950 border border-neutral-800 rounded-md p-2 min-h-[40px]">
            {effectivePerms.length ? effectivePerms.join(" · ") : "—"}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">Usuarios</h2>
          <input className="rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
            placeholder="Buscar email/nombre…" value={q} onChange={e=>setQ(e.target.value)}/>
        </div>

        {loading ? <div className="text-sm opacity-70">Cargando…</div> :
          items?.length ? (
            <div className="space-y-3">
              {items.map(acc => <AccountRow key={acc._id} acc={acc} allRoles={roles} onChanged={load}/>)}
            </div>
          ) : <div className="text-sm opacity-70">Sin usuarios.</div>}
      </section>
    </>
  );
}

function AccountRow({ acc, allRoles, onChanged }) {
  const selected = new Set((acc.roleIds || []).map(r => String(r._id || r)));
  const [busy, setBusy] = useState(false);

  async function toggleActive(nextActive) {
    setBusy(true);
    try { nextActive ? await iamApi.enableAccount(acc._id) : await iamApi.disableAccount(acc._id); await onChanged(); }
    finally { setBusy(false); }
  }
  async function toggleRole(rid) {
    setBusy(true);
    try { const next = new Set(selected); next.has(rid)?next.delete(rid):next.add(rid);
      await iamApi.setAccountRoles(acc._id, [...next]); await onChanged(); }
    finally { setBusy(false); }
  }

  return (
    <div className="p-3 rounded-xl border border-neutral-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-medium">{acc.name || "—"} <span className="text-xs text-neutral-400">({acc.status || "—"})</span></div>
          <div className="text-sm text-neutral-400">{acc.email || "—"}</div>
          {acc.username && <div className="text-xs text-neutral-500">Usuario: {acc.username}</div>}
          {acc.phone && <div className="text-xs text-neutral-500">Tel: {acc.phone}</div>}
        </div>
        <div className="flex gap-2">
          {acc.status !== "disabled" ? (
            <Btn onClick={()=>toggleActive(false)} disabled={busy}>Desactivar</Btn>
          ) : (
            <Btn onClick={()=>toggleActive(true)} disabled={busy}>Activar</Btn>
          )}
        </div>
      </div>
      <div className="mt-2 text-sm">
        <div className="opacity-70">Roles:</div>
        <div className="mt-1 flex flex-wrap gap-2">
          {allRoles.map(r => {
            const rid = String(r._id), on = selected.has(rid);
            return (
              <button key={rid} disabled={busy} onClick={()=>toggleRole(rid)}
                className={`px-2 py-1 rounded-md border text-xs ${on ? "border-primary/60 bg-primary/10":"border-neutral-700 hover:bg-neutral-800"} disabled:opacity-50`}>
                {r.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* -------------------- Roles + Catálogo (con DnD + Auditoría) -------------------- */
function RolesPanel() {
  const [roles, setRoles] = useState([]);
  const [catalog, setCatalog] = useState([]); // [{group, items:[{_id,key,label,order}]}]
  const [sel, setSel] = useState(null);
  const [err, setErr] = useState("");
  const [editCatalog, setEditCatalog] = useState(false);
  const [audit, setAudit] = useState([]);

  async function load() {
    setErr("");
    try {
      const rs = await iamApi.listRoles(); setRoles(rs.items || rs || []);
      const p = await iamApi.listPermissions(); setCatalog(p.groups || p || []);
      try { const a = await iamApi.listAudit(50); setAudit(a.items || []); } catch {}
    } catch (e) { setErr(e?.message || String(e)); }
  }
  useEffect(() => { load(); }, []);

  const startNew = () => setSel({ _id:null, name:"", description:"", permissions:[] });
  const togglePermInSel = (perm) =>
    setSel(r => {
      const s = new Set(r.permissions || []);
      s.has(perm) ? s.delete(perm) : s.add(perm);
      return { ...r, permissions:[...s] };
    });

  const saveRole = async () => {
    try {
      const payload = { name: sel.name, description: sel.description, permissions: sel.permissions || [] };
      if (sel._id) await iamApi.updateRole(sel._id, payload);
      else setSel(await iamApi.createRole(payload));
      await load();
    } catch (e) { setErr(e?.message || String(e)); }
  };
  const removeRole = async (id) => {
    if (!confirm("¿Eliminar este rol?")) return;
    try { await iamApi.deleteRole(id); setSel(null); await load(); }
    catch (e) { setErr(e?.message || String(e)); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="font-medium flex-1">Roles</h2>
        <Btn onClick={()=>setEditCatalog(v=>!v)} className={editCatalog?"border-primary/60 bg-primary/20":""}>
          {editCatalog ? "Ocultar catálogo" : "Editar catálogo"}
        </Btn>
        <Btn onClick={startNew} className="border-primary/60 bg-primary/20">Nuevo rol</Btn>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Lista de roles */}
        <section className="rounded-xl border border-neutral-800 p-4 space-y-2">
          {err && <div className="text-sm text-rose-500">{err}</div>}
          {(roles || []).map(r => (
            <button key={r._id} onClick={()=>setSel(r)}
              className="w-full text-left p-3 rounded-lg border border-neutral-800 hover:border-neutral-600">
              <div className="font-medium">{r.name}</div>
              <div className="text-xs opacity-70">{r.description || "—"}</div>
            </button>
          ))}
          {(!roles || !roles.length) && <div className="text-sm opacity-60">Sin roles.</div>}
        </section>

        {/* Editor de rol */}
        <section className="rounded-xl border border-neutral-800 p-4 space-y-3">
          <h3 className="font-medium">Detalle</h3>
          {!sel ? (
            <div className="text-sm opacity-70">Selecciona o crea un rol…</div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-3">
                <input className="rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
                  placeholder="Nombre" value={sel.name||""} onChange={e=>setSel({...sel, name:e.target.value})}/>
                <input className="rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
                  placeholder="Descripción" value={sel.description||""} onChange={e=>setSel({...sel, description:e.target.value})}/>
              </div>

              <div className="space-y-3">
                {catalog.map(g => (
                  <div key={g.group} className="border border-neutral-800 rounded-lg p-2">
                    <div className="text-sm font-medium mb-1">{g.group}</div>
                    <div className="flex flex-wrap gap-2">
                      {g.items.map(it => (
                        <Pill key={it.key} active={(sel.permissions||[]).includes(it.key)} onClick={()=>togglePermInSel(it.key)}>
                          {it.label}
                        </Pill>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Btn onClick={saveRole} className="border-primary/60 bg-primary/20">Guardar</Btn>
                {sel._id && <Btn onClick={()=>removeRole(sel._id)} className="border-rose-600 text-rose-400">Eliminar</Btn>}
                <Btn onClick={()=>setSel(null)}>Cancelar</Btn>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Editor de catálogo + Auditoría */}
      {editCatalog && <CatalogEditor onChanged={load} catalog={catalog} audit={audit} />}
    </div>
  );
}

function CatalogEditor({ catalog, onChanged, audit }) {
  const [form, setForm] = useState({ key:"", label:"", group:"" });
  const [busy, setBusy] = useState(false);
  const [dirtyGroups, setDirtyGroups] = useState({}); // group -> reordered list of ids
  const allGroups = (catalog || []).map(g => g.group);

  async function create() {
    if (!form.key.trim() || !form.label.trim() || !form.group.trim()) return;
    setBusy(true);
    try { await iamApi.createPermission({ ...form }); setForm({ key:"", label:"", group: form.group }); await onChanged(); }
    finally { setBusy(false); }
  }

  const [rename, setRename] = useState({ from:"", to:"" });
  async function doRenameGroup() {
    if (!rename.from || !rename.to) return;
    setBusy(true);
    try { await iamApi.renameGroup(rename.from, rename.to); setRename({ from:"", to:"" }); await onChanged(); }
    finally { setBusy(false); }
  }

  async function delGroup(name) {
    if (!confirm(`Eliminar grupo "${name}" y todos sus permisos?`)) return;
    setBusy(true);
    try { await iamApi.deleteGroup(name, true); await onChanged(); }
    finally { setBusy(false); }
  }

  async function saveOrder(group) {
    const ids = dirtyGroups[group];
    if (!ids || !ids.length) return;
    setBusy(true);
    try { await iamApi.reorderPermissions(group, ids); setDirtyGroups(s => ({ ...s, [group]: undefined })); await onChanged(); }
    finally { setBusy(false); }
  }

  // DnD handlers por grupo
  function handleDragStart(group, id) {
    return (e) => {
      e.dataTransfer.setData("text/plain", id);
      e.dataTransfer.effectAllowed = "move";
      const ghost = document.createElement("div");
      ghost.style.opacity = "0";
      e.dataTransfer.setDragImage(ghost, 0, 0);
    };
  }
  function handleDragOver(e) { e.preventDefault(); }
  function handleDrop(group, targetId) {
    return (e) => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData("text/plain");
      if (!draggedId || draggedId === targetId) return;

      const g = catalog.find(x => x.group === group);
      const currentIds = (dirtyGroups[group] && dirtyGroups[group].length ? dirtyGroups[group] : g.items.map(it => String(it._id)));

      const next = currentIds.filter(x => x !== draggedId);
      const idx = next.indexOf(String(targetId));
      next.splice(idx < 0 ? next.length : idx, 0, draggedId);

      setDirtyGroups(s => ({ ...s, [group]: next }));
    };
  }

  function renderPermList(g) {
    const list = dirtyGroups[g.group] && dirtyGroups[g.group].length
      ? dirtyGroups[g.group].map(id => g.items.find(it => String(it._id) === String(id))).filter(Boolean)
      : g.items;

    return (
      <div className="space-y-2">
        {list.map(it => (
          <div
            key={it._id}
            draggable
            onDragStart={handleDragStart(g.group, String(it._id))}
            onDragOver={handleDragOver}
            onDrop={handleDrop(g.group, String(it._id))}
            className="grid md:grid-cols-4 gap-2 items-center rounded-md border border-neutral-800 p-2"
            title="Arrastra para reordenar"
          >
            <div className="text-xl select-none cursor-move" aria-hidden>☰</div>
            <input className="rounded-md bg-neutral-900 border border-neutral-700 px-3 py-1.5 text-sm"
              defaultValue={it.key}
              onBlur={async (e)=>{ const v = e.target.value.trim(); if (v !== it.key) { await iamApi.updatePermission(it._id, { key: v }); await onChanged(); }}}/>
            <input className="rounded-md bg-neutral-900 border border-neutral-700 px-3 py-1.5 text-sm"
              defaultValue={it.label}
              onBlur={async (e)=>{ const v = e.target.value; if (v !== it.label) { await iamApi.updatePermission(it._id, { label: v }); await onChanged(); }}}/>
            <div className="flex gap-2">
              <input className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-1.5 text-sm"
                list={`groups-${g.group}`} placeholder={g.group}
                onBlur={async (e)=>{ const v = e.target.value.trim(); if (v) { await iamApi.updatePermission(it._id, { group: v }); await onChanged(); }}}
              />
              <Btn onClick={async ()=>{ if (confirm(`Eliminar permiso "${it.key}"?`)) { await iamApi.deletePermission(it._id, true); await onChanged(); } }} className="border-rose-600 text-rose-400">Eliminar</Btn>
            </div>
            <datalist id={`groups-${g.group}`}>{(catalog||[]).map(x => <option key={x.group} value={x.group} />)}</datalist>
          </div>
        ))}
        {dirtyGroups[g.group]?.length ? (
          <div className="flex justify-end">
            <Btn onClick={()=>saveOrder(g.group)} className="border-primary/60 bg-primary/20">Guardar orden</Btn>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-neutral-800 p-4 space-y-4">
      <h3 className="font-medium">Catálogo de permisos</h3>

      {/* Crear permiso */}
      <div className="grid md:grid-cols-3 gap-2 items-end">
        <div>
          <label className="text-xs opacity-70">Key</label>
          <input className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
            placeholder="accesos.read" value={form.key} onChange={e=>setForm({...form, key:e.target.value.trim()})}/>
        </div>
        <div>
          <label className="text-xs opacity-70">Etiqueta</label>
          <input className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
            placeholder="Ver accesos" value={form.label} onChange={e=>setForm({...form, label:e.target.value})}/>
        </div>
        <div className="flex gap-2">
          <input className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
            list="perm-groups" placeholder="Grupo (nuevo o existente)"
            value={form.group} onChange={e=>setForm({...form, group:e.target.value})}/>
          <datalist id="perm-groups">
            {allGroups.map(g => <option key={g} value={g} />)}
          </datalist>
          <Btn onClick={create} disabled={busy} className="border-primary/60 bg-primary/20">Agregar</Btn>
        </div>
      </div>

      {/* Renombrar / Eliminar grupo */}
      <div className="grid md:grid-cols-3 gap-2 items-end">
        <div>
          <label className="text-xs opacity-70">Renombrar grupo: desde</label>
          <input className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
            list="perm-groups" value={rename.from} onChange={e=>setRename({...rename, from:e.target.value})}/>
        </div>
        <div>
          <label className="text-xs opacity-70">a</label>
          <input className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
            placeholder="Nuevo nombre" value={rename.to} onChange={e=>setRename({...rename, to:e.target.value})}/>
        </div>
        <div className="flex gap-2">
          <Btn onClick={doRenameGroup} disabled={busy || !rename.from || !rename.to}>Renombrar</Btn>
          {!!rename.from && <Btn onClick={()=>delGroup(rename.from)} className="border-rose-600 text-rose-400" disabled={busy}>Eliminar grupo</Btn>}
        </div>
      </div>

      {/* Lista DnD por grupo */}
      <div className="space-y-3">
        {catalog.map(g => (
          <div key={g.group} className="border border-neutral-800 rounded-lg p-3">
            <div className="text-sm font-medium mb-2">{g.group} <span className="text-xs opacity-60">(arrastra ☰ para reordenar)</span></div>
            {renderPermList(g)}
          </div>
        ))}
      </div>

      {/* Auditoría (últimos 50) */}
      <div className="border-t border-neutral-800 pt-3">
        <div className="flex items-center gap-2">
          <h4 className="font-medium">Auditoría (últimos 50)</h4>
          <Btn onClick={onChanged}>Refrescar</Btn>
        </div>
        {!audit?.length ? (
          <div className="text-sm opacity-60">Sin registros.</div>
        ) : (
          <div className="mt-2 space-y-1 text-sm">
            {audit.map(a => (
              <div key={a._id} className="px-3 py-2 rounded border border-neutral-800">
                <div className="flex flex-wrap gap-2 justify-between">
                  <div>
                    <span className="font-medium">{a.action}</span>
                    <span className="opacity-60"> · {a.entity} {a.entityId ? `(${a.entityId})` : ""}</span>
                  </div>
                  <div className="opacity-70">{new Date(a.createdAt).toLocaleString()}</div>
                </div>
                <div className="text-xs opacity-80">
                  {a.actorEmail || a.actorId ? `Por ${a.actorEmail || a.actorId}` : "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
