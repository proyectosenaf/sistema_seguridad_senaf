// client/src/pages/RutasAdmin/RouteForm.jsx
import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { routesApi } from "../../lib/apiRoutes";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import CheckpointForm from "./CheckpointForm";

const schema = z.object({
  siteId: z.string().min(24),
  name: z.string().min(3),
  code: z.string().optional(),
  active: z.boolean().default(true),
});

export default function RouteForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const { getAccessTokenSilently } = useAuth0();
  const api = React.useMemo(() => routesApi(getAccessTokenSilently), [getAccessTokenSilently]);

  const { register, handleSubmit, reset, formState:{errors} } = useForm({ resolver: zodResolver(schema) });

  React.useEffect(() => {
    (async () => {
      if (id) {
        const data = await api.get(id);
        reset(data);
      } else {
        reset({ siteId: "", name: "", code: "", active: true, checkpoints: [] });
      }
    })();
  }, [id]);

  async function onSubmit(values) {
    if (id) await api.update(id, values); else await api.create(values);
    nav("/rutas-admin");
  }

  return (
    <div className="p-4 space-y-4">
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 max-w-2xl">
        <label className="grid gap-1">
          <span className="text-xs">SiteId</span>
          <input className="input" {...register("siteId")}/>
          {errors.siteId && <span className="err">{errors.siteId.message}</span>}
        </label>
        <label className="grid gap-1">
          <span className="text-xs">Nombre</span>
          <input className="input" {...register("name")}/>
        </label>
        <label className="grid gap-1">
          <span className="text-xs">Código</span>
          <input className="input" {...register("code")}/>
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" {...register("active")}/> Activa
        </label>
        <div className="flex gap-2">
          <button className="btn" type="submit">Guardar</button>
          <button className="btn-secondary" type="button" onClick={()=>nav("/rutas-admin")}>Cancelar</button>
        </div>
      </form>

      {id && (
        <div className="mt-6">
          <h3 className="font-semibold mb-2">Checkpoints</h3>
          <CheckpointForm routeId={id} />
        </div>
      )}
    </div>
  );
}
