import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { api, setAuthToken } from '../../lib/api.js';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { motion, animate } from 'framer-motion';

// Formateo de fecha y hora (24h)
const fmtDateTime = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('es-HN', { dateStyle: 'medium', timeStyle: 'short', hour12: false });
};

// Contador animado para KPI
const Counter = ({ value, duration = 0.6 }) => {
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    const controls = animate(0, Number(value || 0), { duration, onUpdate: v => setN(Math.round(v)) });
    return () => controls.stop();
  }, [value, duration]);
  return <span>{n}</span>;
};

// Fila de tabla animada
const rowVariants = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

// Skeleton para carga
const SkeletonTable = () => (
  <div className="animate-pulse">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="h-10 border-b border-neutral-200/60 dark:border-neutral-800/60">
        <div className="h-4 mt-3 w-1/2 bg-neutral-200 dark:bg-neutral-800 rounded" />
      </div>
    ))}
  </div>
);

export default function IncidentesList() {
  const { getAccessTokenSilently } = useAuth0();
  const [items, setItems] = React.useState([]);
  const [q, setQ] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [authReady, setAuthReady] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE, scope: 'openid profile email' },
      });
      setAuthToken(() =>
        getAccessTokenSilently({
          authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE, scope: 'openid profile email' },
        })
      );
      if (mounted) setAuthReady(true);
    })().catch((e) => console.error('No se pudo obtener token inicial:', e));
    return () => { mounted = false; };
  }, [getAccessTokenSilently]);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/incidentes', { params: { q } });
      const list = Array.isArray(res.data) ? res.data : (res.data.items || res.data.results || []);
      setItems(list);
    } catch (e) {
      console.error('Error cargando incidentes:', e?.response?.status, e?.response?.data || e?.message);
    } finally {
      setLoading(false);
    }
  }, [q]);

  React.useEffect(() => { if (authReady) fetchData(); }, [authReady, fetchData]);

  const chartData = items.slice(0, 12).map((it, i) => ({
    name: new Date(it.createdAt || it.fechaHora || it.fecha || Date.now()).toLocaleDateString('es-HN'),
    value: i + 1,
  }));

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { label: 'Incidentes', value: items.length },
          { label: 'Abiertos', value: items.filter(i => i.estado !== 'cerrado').length },
          { label: 'Alta prioridad', value: items.filter(i => i.prioridad === 'alta').length },
        ].map((k) => (
          <motion.div
            key={k.label}
            className="card"
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            whileHover={{ y: -2, scale: 1.01 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
          >
            <div className="text-sm opacity-70">{k.label}</div>
            <div className="text-2xl font-bold"><Counter value={k.value} /></div>
          </motion.div>
        ))}
      </div>

      {/* Gráfico */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.35 }}
      >
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold">Tendencia</h2>
        </div>
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0.2" />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line
                dataKey="value"
                stroke="url(#lineGrad)"
                strokeWidth={2}
                dot={false}
                isAnimationActive
                animationDuration={700}
                animationEasing="ease-in-out"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Lista */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.35 }}
      >
        <div className="flex justify-between items-center mb-3 gap-2">
          <motion.input
            whileFocus={{ scale: 1.01 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar…"
            className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 w-full md:w-64"
          />
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Link to="/incidentes/nuevo" className="px-3 py-2 rounded-lg bg-blue-600 text-white inline-block">
              Nuevo incidente
            </Link>
          </motion.div>
        </div>

        {loading ? (
          <SkeletonTable />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-neutral-200 dark:border-neutral-800">
                  <th className="py-2 pr-2">Título</th>
                  <th className="py-2 pr-2">Tipo</th>
                  <th className="py-2 pr-2">Prioridad</th>
                  <th className="py-2 pr-2">Estado</th>
                  <th className="py-2 pr-2">Fecha y hora</th>
                </tr>
              </thead>
              <motion.tbody initial="hidden" animate="show" transition={{ staggerChildren: 0.04 }}>
                {items.map(it => (
                  <motion.tr key={it._id} variants={rowVariants}
                    className="border-b border-neutral-200/60 dark:border-neutral-800/60">
                    <td className="py-2 pr-2">{it.titulo}</td>
                    <td className="py-2 pr-2">{it.tipo}</td>
                    <td className="py-2 pr-2">{it.prioridad}</td>
                    <td className="py-2 pr-2">{it.estado}</td>
                    <td className="py-2 pr-2 whitespace-nowrap" title={fmtDateTime(it.fechaHora || it.createdAt || it.fecha)}>
                      {fmtDateTime(it.fechaHora || it.createdAt || it.fecha)}
                    </td>
                  </motion.tr>
                ))}
                {!items.length && (
                  <tr><td colSpan={5} className="py-6 text-center opacity-70">Aún no hay incidentes.</td></tr>
                )}
              </motion.tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
