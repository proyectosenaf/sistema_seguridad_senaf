import axios from "axios";

function normalizeDomain(d) {
  return String(d || "")
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/g, "")
    .trim();
}

let _token = null;
let _exp = 0;

export async function getAuth0MgmtToken() {
  const domain = normalizeDomain(process.env.AUTH0_MGMT_DOMAIN);
  const client_id = String(process.env.AUTH0_MGMT_CLIENT_ID || "").trim();
  const client_secret = String(process.env.AUTH0_MGMT_CLIENT_SECRET || "").trim();

  if (!domain || !client_id || !client_secret) return null;

  const now = Date.now();
  if (_token && now < _exp - 30_000) return _token;

  const url = `https://${domain}/oauth/token`;

  const r = await axios.post(
    url,
    {
      grant_type: "client_credentials",
      client_id,
      client_secret,
      audience: `https://${domain}/api/v2/`,
    },
    { timeout: 8000 }
  );

  const token = r?.data?.access_token || null;
  const expiresIn = Number(r?.data?.expires_in || 3600);

  if (!token) return null;

  _token = token;
  _exp = now + expiresIn * 1000;
  return token;
}

export async function auth0CreateDbUser({ email, password, name, appMetadata }) {
  const domain = normalizeDomain(process.env.AUTH0_MGMT_DOMAIN);
  const token = await getAuth0MgmtToken();
  if (!domain || !token) throw new Error("AUTH0_MGMT env/token missing");

  const connection = String(process.env.AUTH0_DB_CONNECTION || "").trim();
  if (!connection) throw new Error("AUTH0_DB_CONNECTION missing");

  const url = `https://${domain}/api/v2/users`;

  const r = await axios.post(
    url,
    {
      connection,
      email,
      password,
      name: name || undefined,
      email_verified: false,
      verify_email: true, // opcional: manda verificación
      app_metadata: appMetadata || {},
    },
    { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 }
  );

  return r.data; // incluye user_id
}

export async function auth0CreatePasswordChangeTicket({ user_id, result_url }) {
  const domain = normalizeDomain(process.env.AUTH0_MGMT_DOMAIN);
  const token = await getAuth0MgmtToken();
  if (!domain || !token) throw new Error("AUTH0_MGMT env/token missing");

  const url = `https://${domain}/api/v2/tickets/password-change`;

  const r = await axios.post(
    url,
    {
      user_id,
      result_url: result_url || undefined, // a dónde volver después de cambiar
      mark_email_as_verified: false,
      includeEmailInRedirect: false,
      ttl_sec: 900,
    },
    { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 }
  );

  return r.data; // { ticket: "https://..." }
}