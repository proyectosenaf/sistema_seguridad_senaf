const BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000") + "/api/rondas/v1";

async function req(path,{ method="GET", body, token, headers={} }={}) {
  const res = await fetch(BASE+path,{
    method,
    headers:{
      "Content-Type":"application/json",
      ...(token ? { Authorization:`Bearer ${token}` } : {}),
      ...(token ? {} : { "x-user-id":"guard-demo-1", "x-roles":"admin,guard" }),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  if(!res.ok) throw new Error((await res.text()) || res.statusText);
  const ct = res.headers.get("content-type")||"";
  return ct.includes("application/json") ? res.json() : res.text();
}

export const RondasApi = {
  listZones: (t)=>req("/zones",{ token:t }),
  createZone: (p,t)=>req("/zones",{ method:"POST", body:p, token:t }),
  zoneCheckpoints: (id,t)=>req(`/zones/${id}/checkpoints`,{ token:t }),
  getCheckpointQR: (id,format="png",t)=>req(`/checkpoints/${id}/qr?format=${format}`,{ token:t }),
  startShift: (zoneId,t)=>req("/shifts/start",{ method:"POST", body:{ zoneId }, token:t }),
  endShift: (id,t)=>req(`/shifts/${id}/end`,{ method:"POST", token:t }),
  registerScan: (p,t)=>req("/scans",{ method:"POST", body:p, token:t }),
};
