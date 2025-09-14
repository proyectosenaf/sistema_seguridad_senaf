import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';


const Card = ({ title, value, children }) => (
<div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
<div className="text-sm opacity-70">{title}</div>
<div className="text-2xl font-semibold">{value}</div>
{children}
</div>
);


export default function Dashboard() {
const { user } = useAuth0();


return (
<div className="space-y-6">
<div>
<h1 className="text-2xl font-bold">Dashboard</h1>
<p className="opacity-70 text-sm">Bienvenido{user?.name ? `, ${user.name}` : ''}.</p>
</div>
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
<Card title="Incidentes abiertos" value="—" />
<Card title="Visitas hoy" value="—" />
<Card title="Rondas activas" value="—" />
<Card title="Alertas" value="—" />
</div>
</div>
);
}