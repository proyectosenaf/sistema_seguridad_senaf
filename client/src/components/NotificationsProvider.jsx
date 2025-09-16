import React from 'react';
import { getSocket } from '../lib/notifications';
import axios from 'axios';

export const NotificationsContext = React.createContext(null);

export default function NotificationsProvider({ children }) {
  const [counts, setCounts] = React.useState({ email: 0, message: 0, appointment: 0, total: 0 });

  const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL });

  React.useEffect(() => {
    let active = true;

    // carga inicial
    api.get('/notifications/counts').then(({data}) => { if (active) setCounts(data); });

    const s = getSocket();
    const update = () => api.get('/notifications/counts').then(({data}) => { if (active) setCounts(data); });

    s.on('notifications:count-updated', setCounts);
    s.on('email:new', update);
    s.on('message:new', update);
    s.on('appointment:new', update);

    return () => {
      active = false;
      s.off('notifications:count-updated', setCounts);
      s.off('email:new', update);
      s.off('message:new', update);
      s.off('appointment:new', update);
    };
  }, []);

  const clear = async () => {
    const { data } = await api.post('/notifications/clear');
    setCounts(data);
  };

  return (
    <NotificationsContext.Provider value={{ counts, clear }}>
      {children}
    </NotificationsContext.Provider>
  );
}
