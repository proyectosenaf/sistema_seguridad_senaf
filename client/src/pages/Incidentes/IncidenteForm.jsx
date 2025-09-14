import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { api, setAuthToken } from '../../lib/api.js';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';

export default function IncidenteForm() {
  const { getAccessTokenSilently } = useAuth0();
  const nav = useNavigate();
  React.useEffect(() => {
    setAuthToken(() => getAccessTokenSilently({
      authorizationParams: {
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        scope: "openid profile email",
      }
    }));
  }, [getAccessTokenSilently]);

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm({ defaultValues: { prioridad: 'media', estado: 'abierto' } });

  const onSubmit = async (data) => {
    await api.post('/incidentes', data);
    nav('/incidentes');
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card card-rich max-w-3xl space-y-4">
      <h2 className="section-title text-2xl">Nuevo incidente</h2>

      {/* Título */}
      <div>
        <label className="block text-sm opacity-80 mb-1">Título</label>
        <input
          {...register('titulo', { required: 'Requerido', minLength: { value: 3, message: 'Min 3' } })}
          className="input-fx"
          placeholder="Escribe un título breve"
        />
        {errors.titulo && <p className='text-rose-500 text-sm mt-1'>{errors.titulo.message}</p>}
      </div>

      {/* Tipo */}
      <div>
        <label className="block text-sm opacity-80 mb-1">Tipo</label>
        <select {...register('tipo', { required: 'Requerido' })} className="input-fx">
          <option value='robo'>Robo</option>
          <option value='acceso_no_autorizado'>Acceso no autorizado</option>
          <option value='falla_tecnica'>Falla técnica</option>
          <option value='otro'>Otro</option>
        </select>
      </div>

      {/* Descripción */}
      <div>
        <label className="block text-sm opacity-80 mb-1">Descripción</label>
        <textarea
          rows={5}
          {...register('descripcion', { required: 'Requerido' })}
          className="input-fx"
          placeholder="Describe el incidente con detalle…"
        />
        {errors.descripcion && <p className='text-rose-500 text-sm mt-1'>{errors.descripcion.message}</p>}
      </div>

      {/* Prioridad / Estado */}
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <div>
          <label className="block text-sm opacity-80 mb-1">Prioridad</label>
          <select {...register('prioridad')} className="input-fx">
            <option value='baja'>Baja</option>
            <option value='media'>Media</option>
            <option value='alta'>Alta</option>
          </select>
        </div>
        <div>
          <label className="block text-sm opacity-80 mb-1">Estado</label>
          <select {...register('estado')} className="input-fx">
            <option value='abierto'>Abierto</option>
            <option value='en_proceso'>En proceso</option>
            <option value='cerrado'>Cerrado</option>
          </select>
        </div>
      </div>

      {/* Fecha y ubicación */}
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <div>
          <label className="block text-sm opacity-80 mb-1">Fecha y hora</label>
          <input type="datetime-local" {...register('fechaHora')} className="input-fx" />
        </div>
        <div>
          <label className="block text-sm opacity-80 mb-1">Ubicación</label>
          <input {...register('ubicacion')} className="input-fx" placeholder='Acceso principal, bodega, etc.' />
        </div>
      </div>

      <div className="pt-2">
        <button disabled={isSubmitting} className="btn-neon">
          {isSubmitting ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
// Paletas de colores disponibles
