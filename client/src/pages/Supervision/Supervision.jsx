// client/src/pages/Supervision/Supervision.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./Supervision.css";
import { rondasqrApi } from "../../modules/rondasqr/api/rondasqrApi";
import { iamApi } from "../../iam/api/iamApi.js";

/* =======================
   DATOS MOCK (otras secciones)
   ======================= */

const asistenciaMock = [
  {
    id: 1,
    guardia: "Juan Pérez",
    fecha: "2025-11-15",
    horaEntrada: "05:50",
    horaSalida: "",
    metodo: "QR",
    estado: "A tiempo",
  },
  {
    id: 2,
    guardia: "María López",
    fecha: "2025-11-15",
    horaEntrada: "14:10",
    horaSalida: "",
    metodo: "NFC",
    estado: "Retardo",
  },
  {
    id: 3,
    guardia: "Carlos Sánchez",
    fecha: "2025-11-14",
    horaEntrada: "",
    horaSalida: "",
    metodo: "Geo-checkin",
    estado: "Ausencia",
  },
];

const alertasMock = [
  {
    id: 1,
    tipo: "Turno por iniciar",
    detalle:
      "El turno de Juan Pérez en Planta Norte inicia en 10 minutos y aún no registra check-in.",
    criticidad: "alta",
  },
  {
    id: 2,
    tipo: "Retardos repetidos",
    detalle:
      "María López acumula 3 retardos en los últimos 7 días en el sitio Edificio Administrativo.",
    criticidad: "media",
  },
  {
    id: 3,
    tipo: "Ausencias repetidas",
    detalle:
      "Carlos Sánchez registra 2 ausencias en el último mes en el sitio Almacén Central.",
    criticidad: "alta",
  },
];

const rondasMock = [
  {
    id: 1,
    guardia: "Carlos Sánchez",
    ronda: "Ronda nocturna – Almacén Central",
    estado: "En curso",
    inicioProgramado: "22:00",
    inicioReal: "22:05",
    ultimoPunto: "Punto 3 – Patio de carga",
    proximoPunto: "Punto 4 – Bodega externa",
    etaProximo: "5 min",
    proximaVentana: "22:30 - 22:40",
    motivo: "",
  },
  {
    id: 2,
    guardia: "Juan Pérez",
    ronda: "Ronda perimetral – Planta Norte",
    estado: "Programada",
    inicioProgramado: "12:30",
    inicioReal: "",
    ultimoPunto: "—",
    proximoPunto: "Punto 1 – Portón principal",
    etaProximo: "En 20 min",
    proximaVentana: "12:30 - 12:45",
    motivo: "",
  },
  {
    id: 3,
    guardia: "María López",
    ronda: "Ronda vespertina – Edificio Administrativo",
    estado: "Cancelada",
    inicioProgramado: "17:00",
    inicioReal: "",
    ultimoPunto: "—",
    proximoPunto: "—",
    etaProximo: "—",
    proximaVentana: "—",
    motivo: "Lluvia intensa / acceso restringido",
  },
  {
    id: 4,
    guardia: "Turno especial",
    ronda: "Ronda interna – Estacionamiento",
    estado: "Omisión",
    inicioProgramado: "09:00",
    inicioReal: "",
    ultimoPunto: "Punto 1 – Entrada estacionamiento",
    proximoPunto: "Punto 2 – Zona visitas",
    etaProximo: "—",
    proximaVentana: "09:00 - 09:15",
    motivo: "Otra prioridad (incidente en portón principal)",
  },
];

/* =======================
   COMPONENTE PRINCIPAL
   ======================= */

export default function Supervision() {
  const [vista, setVista] = useState("turnos"); // turnos | asistencia | alertas | rondas | lugar

  // Turnos (asignaciones de rondas)
  const [turnosRaw, setTurnosRaw] = useState([]);
  const [cargandoTurnos, setCargandoTurnos] = useState(false);
  const [errorTurnos, setErrorTurnos] = useState(null);

  // Catálogo de usuarios (IAM)
  const [usuariosMap, setUsuariosMap] = useState({});
  const [usuariosCargados, setUsuariosCargados] = useState(false);

  const [filtroGuardia, setFiltroGuardia] = useState("");
  const [filtroEstadoRonda, setFiltroEstadoRonda] = useState("Todos");

  const [checkLimpieza, setCheckLimpieza] = useState(false);
  const [checkHerramientas, setCheckHerramientas] = useState(false);
  const [checkVestimenta, setCheckVestimenta] = useState(false);
  const [observacion, setObservacion] = useState("");

  /* =======================
     1) Cargar catálogo de usuarios IAM
     ======================= */
  useEffect(() => {
    let cancel = false;

    const cargarUsuarios = async () => {
      try {
        const res = await iamApi.listUsers("");
        const items = res?.items || [];
        const map = {};

        for (const u of items) {
          const persona = u.persona || {};

          const nombre =
            u.nombreCompleto ||
            u.name ||
            persona.nombreCompleto ||
            [persona.nombres, persona.apellidos].filter(Boolean).join(" ") ||
            "Sin nombre";

          const email =
            u.correoPersona ||
            u.email ||
            persona.correoPersona ||
            persona.correo ||
            persona.email ||
            "";

          // 👇 AQUÍ EL CAMBIO IMPORTANTE:
          // Registramos al usuario bajo TODOS los IDs posibles,
          // incluyendo persona._id, persona.id_persona, etc.
          const posiblesIds = [
            u._id,
            u.id,
            u.userId,
            u.usuarioId,
            u.personaId,
            u.id_persona,
            persona._id,
            persona.id,
            persona.id_persona,
          ]
            .filter(Boolean)
            .map(String);

          if (posiblesIds.length === 0) continue;

          for (const pid of posiblesIds) {
            if (!map[pid]) {
              map[pid] = { nombre, email };
            }
          }
        }

        if (!cancel) {
          setUsuariosMap(map);
          setUsuariosCargados(true);
          console.log("[Supervision] Usuarios IAM cargados (map):", map);
        }
      } catch (e) {
        console.error("[Supervision] Error cargando usuarios IAM:", e);
        if (!cancel) setUsuariosCargados(true); // seguimos aunque falle
      }
    };

    cargarUsuarios();
    return () => {
      cancel = true;
    };
  }, []);

  /* =======================
     2) Cargar asignaciones desde RondasQR
     ======================= */
  useEffect(() => {
    if (!usuariosCargados) return;

    let cancel = false;

    const cargarTurnosDesdeAsignaciones = async () => {
      try {
        setCargandoTurnos(true);
        setErrorTurnos(null);

        const hoy = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const raw = await rondasqrApi.listAssignments(hoy);

        const assignments = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.items)
          ? raw.items
          : [];

        if (!cancel) {
          setTurnosRaw(assignments);
          console.log(
            "[Supervision] Asignaciones crudas:",
            assignments.slice(0, 5)
          );
        }
      } catch (err) {
        console.error("[Supervision] Error cargando asignaciones:", err);
        if (!cancel) {
          setErrorTurnos(
            "No se pudieron cargar las asignaciones de rondas."
          );
        }
      } finally {
        if (!cancel) setCargandoTurnos(false);
      }
    };

    cargarTurnosDesdeAsignaciones();
    return () => {
      cancel = true;
    };
  }, [usuariosCargados]);

  /* =======================
     3) Mapear assignments + usuarios
     ======================= */
  const turnos = useMemo(() => {
    return (turnosRaw || []).map((a) => {
      const userId =
        a.userId ||
        a.guardUserId ||
        a.guardId ||
        a.usuarioId ||
        a.personaId ||
        a.iamUserId ||
        a.ownerId ||
        null;

      const usuario = userId ? usuariosMap[String(userId)] : null;

      let guardDisplay = "Sin datos";
      if (usuario) {
        guardDisplay = usuario.email
          ? `${usuario.nombre} — ${usuario.email}`
          : usuario.nombre;
      } else {
        guardDisplay =
          a.guardLabel ||
          a.guardName ||
          a.guard ||
          a.userLabel ||
          a.userName ||
          a.user?.name ||
          a.user?.nombre ||
          (userId ? `ID: ${userId}` : "Sin datos");
      }

      const creado =
        a.createdAt ||
        a.fechaCreacion ||
        a.fecha ||
        a.date ||
        null;

      return {
        id: a._id || a.id,
        guardia: guardDisplay,
        sitio:
          a.siteName ||
          a.sitioNombre ||
          a.site?.name ||
          a.sitio?.nombre ||
          "—",
        ronda:
          a.roundName ||
          a.rondaNombre ||
          a.round?.name ||
          "—",
        plan: a.planName || a.plan?.name || "—",
        puntos:
          a.pointsCount ??
          (Array.isArray(a.points) ? a.points.length : undefined) ??
          (Array.isArray(a.pointIds) ? a.pointIds.length : undefined) ??
          "—",
        inicio: a.startTime || a.horaInicio || "-",
        fin: a.endTime || a.horaFin || "-",
        estado: a.status || a.estado || "—",
        creadoTexto: creado ? new Date(creado).toLocaleString() : "—",
      };
    });
  }, [turnosRaw, usuariosMap]);

  /* =======================
     Derivados / filtros
     ======================= */

  const guardiasUnicos = Array.from(
    new Set(turnos.map((t) => t.guardia).filter(Boolean))
  );

  const turnosFiltrados = turnos.filter((t) =>
    filtroGuardia ? t.guardia === filtroGuardia : true
  );

  const rondasFiltradas = rondasMock.filter((r) =>
    filtroEstadoRonda === "Todos" ? true : r.estado === filtroEstadoRonda
  );

  /* =======================
     Handlers auxiliares
     ======================= */

  const handleGuardarSupervision = () => {
    const payload = {
      limpiezaAreaTrabajo: checkLimpieza,
      herramientasAMano: checkHerramientas,
      vestimentaAdecuada: checkVestimenta,
      observacion,
      fecha: new Date().toISOString(),
    };
    console.log("Supervisión guardada:", payload);
    alert("Supervisión guardada (ejemplo, datos en consola).");
  };

  const getBadgeClase = (estado) => {
    switch (estado) {
      case "Programada":
        return "badge badge-programada";
      case "En curso":
        return "badge badge-en-curso";
      case "Completada":
        return "badge badge-completada";
      case "Omisión":
        return "badge badge-omision";
      case "Cancelada":
        return "badge badge-cancelada";
      default:
        return "badge";
    }
  };

  const getCriticidadClase = (criticidad) => {
    switch (criticidad) {
      case "alta":
        return "criticidad criticidad-alta";
      case "media":
        return "criticidad criticidad-media";
      default:
        return "criticidad criticidad-baja";
    }
  };

  const navBtnClass = (key) =>
    "sup-nav-btn" + (vista === key ? " sup-active" : "");

  /* =======================
     Render
     ======================= */

  return (
    <div className="supervision-root">
      <div className="supervision-page">
        {/* Breadcrumb */}
        <div className="sup-breadcrumb">
          <span>Panel principal</span>
          <span>›</span>
          <span className="sup-crumb-current">Supervisión</span>
        </div>

        {/* HEADER */}
        <header className="gt-header">
          <div className="gt-header-top">
            <div>
              <h1>Supervisión</h1>
              <p className="gt-header-subtitle">
                Control central de turnos, asistencia, rondas y supervisión del
                puesto de trabajo.
              </p>
            </div>

            <div className="gt-header-filtros">
              <div className="filtro">
                <label>Filtrar por guardia</label>
                <select
                  value={filtroGuardia}
                  onChange={(e) => setFiltroGuardia(e.target.value)}
                >
                  <option value="">Todos</option>
                  {guardiasUnicos.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filtro">
                <label>Estado de ronda</label>
                <select
                  value={filtroEstadoRonda}
                  onChange={(e) => setFiltroEstadoRonda(e.target.value)}
                >
                  <option value="Todos">Todos</option>
                  <option value="Programada">Programada</option>
                  <option value="En curso">En curso</option>
                  <option value="Completada">Completada</option>
                  <option value="Omisión">Omisión</option>
                  <option value="Cancelada">Cancelada</option>
                </select>
              </div>
            </div>
          </div>

          {/* NAV de apartados */}
          <div className="supervision-nav-wrapper">
            <span className="supervision-nav-label">
              Apartados del módulo
            </span>

            <div className="supervision-nav">
              <button
                type="button"
                className={navBtnClass("turnos")}
                onClick={() => setVista("turnos")}
              >
                <span>Gestión de turnos</span>
                <span className="sup-dot" />
              </button>

              <button
                type="button"
                className={navBtnClass("asistencia")}
                onClick={() => setVista("asistencia")}
              >
                <span>Control de asistencia</span>
                <span className="sup-dot" />
              </button>

              <button
                type="button"
                className={navBtnClass("alertas")}
                onClick={() => setVista("alertas")}
              >
                <span>Alertas de incumplimiento</span>
                <span className="sup-dot" />
              </button>

              <button
                type="button"
                className={navBtnClass("rondas")}
                onClick={() => setVista("rondas")}
              >
                <span>Panel de rondas</span>
                <span className="sup-dot" />
              </button>

              <button
                type="button"
                className={navBtnClass("lugar")}
                onClick={() => setVista("lugar")}
              >
                <span>Lugar de trabajo y equipo</span>
                <span className="sup-dot" />
              </button>
            </div>
          </div>
        </header>

        {/* CONTENIDO PRINCIPAL */}
        <main className="sup-main">
          {/* ==== GESTIÓN DE TURNOS ==== */}
          {vista === "turnos" && (
            <section className="sup-section">
              <article className="card">
                <div className="card-header">
                  <h2>Gestión de turnos por guardia</h2>
                  <p>
                    Asignaciones de rondas de vigilancia por guardia, con sitio,
                    ronda, plan y estado de asignación.
                  </p>
                </div>
                <div className="card-body card-body-scroll">
                  {cargandoTurnos && (
                    <p className="texto-vacio">Cargando asignaciones...</p>
                  )}

                  {errorTurnos && !cargandoTurnos && (
                    <p className="texto-vacio">{errorTurnos}</p>
                  )}

                  {!cargandoTurnos && !errorTurnos && (
                    <table className="tabla">
                      <thead>
                        <tr>
                          <th>Guardia</th>
                          <th>Sitio</th>
                          <th>Ronda</th>
                          <th>Plan</th>
                          <th>Puntos</th>
                          <th>Inicio</th>
                          <th>Fin</th>
                          <th>Estado</th>
                          <th>Creado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {turnosFiltrados.map((t) => (
                          <tr key={t.id}>
                            <td>{t.guardia}</td>
                            <td>{t.sitio}</td>
                            <td>{t.ronda}</td>
                            <td>{t.plan}</td>
                            <td>{t.puntos}</td>
                            <td>{t.inicio}</td>
                            <td>{t.fin}</td>
                            <td>{t.estado}</td>
                            <td>{t.creadoTexto}</td>
                          </tr>
                        ))}
                        {!cargandoTurnos &&
                          !errorTurnos &&
                          turnosFiltrados.length === 0 && (
                            <tr>
                              <td colSpan={9} className="texto-vacio">
                                No hay asignaciones para el filtro
                                seleccionado.
                              </td>
                            </tr>
                          )}
                      </tbody>
                    </table>
                  )}
                </div>
              </article>
            </section>
          )}

          {/* ==== ASISTENCIA ==== */}
          {vista === "asistencia" && (
            <section className="sup-section">
              <article className="card">
                <div className="card-header">
                  <h2>Control de asistencia</h2>
                  <p>
                    Registros de entrada y salida por guardia: fichaje,
                    QR/NFC/geo-checkin, ausencias y retardos.
                  </p>
                </div>
                <div className="card-body card-body-scroll">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>Guardia</th>
                        <th>Fecha</th>
                        <th>Entrada</th>
                        <th>Salida</th>
                        <th>Método</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asistenciaMock
                        .filter((a) =>
                          filtroGuardia ? a.guardia === filtroGuardia : true
                        )
                        .map((a) => (
                          <tr key={a.id}>
                            <td>{a.guardia}</td>
                            <td>{a.fecha}</td>
                            <td>{a.horaEntrada || "—"}</td>
                            <td>{a.horaSalida || "—"}</td>
                            <td>{a.metodo}</td>
                            <td>{a.estado}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>
          )}

          {/* ==== ALERTAS ==== */}
          {vista === "alertas" && (
            <section className="sup-section">
              <article className="card">
                <div className="card-header">
                  <h2>Alertas de incumplimiento</h2>
                  <p>
                    Alertas por turnos sin check-in, ausencias y patrones de
                    retardo. Útil para seguimiento disciplinario.
                  </p>
                </div>
                <div className="card-body alertas-lista">
                  {alertasMock.map((a) => (
                    <div key={a.id} className="alerta-item">
                      <div className="alerta-header">
                        <span className="alerta-tipo">{a.tipo}</span>
                        <span className={getCriticidadClase(a.criticidad)}>
                          {a.criticidad.toUpperCase()}
                        </span>
                      </div>
                      <p>{a.detalle}</p>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          )}

          {/* ==== RONDAS EN TIEMPO REAL ==== */}
          {vista === "rondas" && (
            <section className="sup-section">
              <article className="card">
                <div className="card-header">
                  <h2>Panel de rondas en tiempo real</h2>
                  <p>
                    Seguimiento de rondas activas, próximas, omitidas o
                    canceladas; con último punto visitado y ventana horaria.
                  </p>
                </div>
                <div className="card-body card-body-scroll">
                  <table className="tabla tabla-rondas">
                    <thead>
                      <tr>
                        <th>Ronda</th>
                        <th>Guardia</th>
                        <th>Estado</th>
                        <th>Inicio prog.</th>
                        <th>Inicio real</th>
                        <th>Último punto</th>
                        <th>Próximo punto</th>
                        <th>ETA próximo</th>
                        <th>Ventana</th>
                        <th>Motivo omisión/cancelación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rondasFiltradas.map((r) => (
                        <tr key={r.id}>
                          <td>{r.ronda}</td>
                          <td>{r.guardia}</td>
                          <td>
                            <span className={getBadgeClase(r.estado)}>
                              {r.estado}
                            </span>
                          </td>
                          <td>{r.inicioProgramado}</td>
                          <td>{r.inicioReal || "—"}</td>
                          <td>{r.ultimoPunto}</td>
                          <td>{r.proximoPunto}</td>
                          <td>{r.etaProximo}</td>
                          <td>{r.proximaVentana}</td>
                          <td>{r.motivo || "—"}</td>
                        </tr>
                      ))}
                      {rondasFiltradas.length === 0 && (
                        <tr>
                          <td colSpan={10} className="texto-vacio">
                            No hay rondas con el estado seleccionado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>
          )}

          {/* ==== LUGAR DE TRABAJO / CHECKLIST ==== */}
          {vista === "lugar" && (
            <section className="sup-section">
              <article className="card">
                <div className="card-header">
                  <h2>Lugar de trabajo, presentación y herramientas</h2>
                  <p>
                    Checklist rápido del puesto de trabajo: limpieza,
                    herramientas esenciales y presentación del guardia.
                  </p>
                </div>
                <div className="card-body supervision-form">
                  <div className="checkbox-group">
                    <label className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={checkLimpieza}
                        onChange={(e) => setCheckLimpieza(e.target.checked)}
                      />
                      Área de trabajo limpia
                    </label>
                    <span className="checkbox-descripcion">
                      Sin basura, papeles tirados, líquidos derramados o
                      desorden.
                    </span>
                  </div>

                  <div className="checkbox-group">
                    <label className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={checkHerramientas}
                        onChange={(e) =>
                          setCheckHerramientas(e.target.checked)
                        }
                      />
                      Herramientas a mano (linterna, arma, etc.)
                    </label>
                    <span className="checkbox-descripcion">
                      Equipos necesarios funcionando y al alcance inmediato.
                    </span>
                  </div>

                  <div className="checkbox-group">
                    <label className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={checkVestimenta}
                        onChange={(e) =>
                          setCheckVestimenta(e.target.checked)
                        }
                      />
                      Vestimenta adecuada
                    </label>
                    <span className="checkbox-descripcion">
                      Uniforme completo, chaleco, botas, gafete visible y en
                      buen estado.
                    </span>
                  </div>

                  <div className="observacion-group">
                    <label>Observación de la supervisión</label>
                    <textarea
                      value={observacion}
                      onChange={(e) => setObservacion(e.target.value)}
                      placeholder="Ejemplo: Se encontró el área con papeles en el piso; linterna sin batería; se recomendó limpieza y recarga de equipo."
                    />
                  </div>

                  <button
                    type="button"
                    className="btn-guardar"
                    onClick={handleGuardarSupervision}
                  >
                    Guardar supervisión
                  </button>
                </div>
              </article>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
