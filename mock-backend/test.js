const BASE = process.env.API_URL || "http://localhost:3000";
const RDV_PATIENT = "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b";
const RDV_AUTRE = "8d1c7a20-6b3e-4f21-a5c4-9e8d7c6b5a40";

let failures = 0;
async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}
function check(name, got, expected) {
  const ok = got === expected;
  if (!ok) failures++;
  console.log(`${ok ? "OK    " : "ECHEC "} ${name} (attendu ${expected}, obtenu ${got})`);
}

(async () => {
  const login = (email, password) => call("POST", "/auth/login", { body: { email, password } });

  check("Ordonnances sans jeton", (await call("GET", "/ordonnances")).status, 401);
  check("Connexion avec un mauvais mot de passe", (await login("patient@test.ma", "faux")).status, 401);

  const p = await login("patient@test.ma", "Test1234!");
  check("Connexion du patient", p.status, 200);
  check("Patient : ordonnances", (await call("GET", "/ordonnances", { token: p.data.accessToken })).status, 200);
  check("Patient : route admin", (await call("GET", "/admin/users", { token: p.data.accessToken })).status, 403);
  check("Patient : son rendez-vous", (await call("GET", `/rdv/${RDV_PATIENT}`, { token: p.data.accessToken })).status, 200);
  check("Patient : rendez-vous d'un autre", (await call("GET", `/rdv/${RDV_AUTRE}`, { token: p.data.accessToken })).status, 404);

  const a = await login("admin@test.ma", "Admin1234!");
  check("Admin : route admin", (await call("GET", "/admin/users", { token: a.data.accessToken })).status, 200);

  const r1 = await call("POST", "/auth/refresh", { body: { refreshToken: p.data.refreshToken } });
  check("Renouvellement avec un jeton valide", r1.status, 200);
  check("Renouvellement rejoue (meme jeton)", (await call("POST", "/auth/refresh", { body: { refreshToken: p.data.refreshToken } })).status, 401);

  await call("POST", "/auth/logout", { token: r1.data.accessToken });
  check("Ancien jeton apres deconnexion", (await call("GET", "/ordonnances", { token: r1.data.accessToken })).status, 401);

  let last = 0;
  for (let i = 0; i < 6; i++) last = (await call("GET", "/map/geocode?q=tanger", { token: a.data.accessToken })).status;
  check("Proxy carte : 6e appel en une minute", last, 429);

  console.log(failures === 0 ? "\nTous les tests passent." : `\n${failures} test(s) en echec.`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error("Serveur injoignable :", e.message); process.exit(1); });