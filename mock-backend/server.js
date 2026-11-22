// Backend simulé pour le devoir. Toutes les données sont FICTIVES.
// En production : mots de passe hachés (argon2/bcrypt), base de données, HTTPS.
const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const users = [
  { id: "u1", email: "patient@test.ma", password: "Test1234!", role: "patient" },
  { id: "u2", email: "autre@test.ma", password: "Test1234!", role: "patient" },
  { id: "u3", email: "admin@test.ma", password: "Admin1234!", role: "admin" },
];

const rdvs = [
  { id: "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b", userId: "u1", medecin: "Dr Alami", date: "2026-12-01" },
  { id: "8d1c7a20-6b3e-4f21-a5c4-9e8d7c6b5a40", userId: "u2", medecin: "Dr Idrissi", date: "2026-12-02" },
];

const ACCESS_TTL = 15 * 60 * 1000;
const REFRESH_TTL = 7 * 24 * 3600 * 1000;
const accessTokens = new Map();
const refreshTokens = new Map();
const newToken = () => crypto.randomBytes(32).toString("hex");

function issueTokens(userId) {
  const accessToken = newToken();
  const refreshToken = newToken();
  accessTokens.set(accessToken, { userId, exp: Date.now() + ACCESS_TTL });
  refreshTokens.set(refreshToken, { userId, exp: Date.now() + REFRESH_TTL });
  return { accessToken, refreshToken };
}

// Authentification : le rôle est lu côté serveur, jamais envoyé par le client.
function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  const session = accessTokens.get(token);
  if (!session || session.exp < Date.now()) {
    return res.status(401).json({ error: "Non authentifié" });
  }
  req.token = token;
  req.user = users.find((u) => u.id === session.userId);
  next();
}

// Autorisation par rôle.
const requireRole = (role) => (req, res, next) =>
  req.user.role === role ? next() : res.status(403).json({ error: "Interdit" });

app.post("/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  const user = users.find((u) => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ error: "Identifiants invalides" });
  res.json(issueTokens(user.id));
});

// Rotation : un jeton de rafraîchissement ne sert qu'une fois.
app.post("/auth/refresh", (req, res) => {
  const { refreshToken } = req.body || {};
  const session = refreshTokens.get(refreshToken);
  if (!session || session.exp < Date.now()) {
    return res.status(401).json({ error: "Session expirée" });
  }
  refreshTokens.delete(refreshToken);
  res.json(issueTokens(session.userId));
});

app.post("/auth/logout", auth, (req, res) => {
  accessTokens.delete(req.token);
  for (const [t, s] of refreshTokens) {
    if (s.userId === req.user.id) refreshTokens.delete(t);
  }
  res.json({ ok: true });
});

// Un patient ne peut lire que ses propres rendez-vous.
app.get("/rdv/:id", auth, (req, res) => {
  const rdv = rdvs.find((r) => r.id === req.params.id);
  if (!rdv || rdv.userId !== req.user.id) {
    return res.status(404).json({ error: "Introuvable" });
  }
  res.json(rdv);
});

app.get("/ordonnances", auth, (req, res) => {
  res.json([{ id: 1, texte: "Paracétamol 1 g (exemple fictif)" }]);
});

// Route réservée aux administrateurs.
app.get("/admin/users", auth, requireRole("admin"), (req, res) => {
  res.json(users.map(({ password, ...u }) => u));
});

// Bonus : proxy cartographie. La clé reste sur le serveur (variable d'environnement)
// et un quota limite l'usage par utilisateur.
const QUOTA_MAX = 5;
const QUOTA_WINDOW = 60 * 1000;
const usage = new Map();

app.get("/map/geocode", auth, (req, res) => {
  const now = Date.now();
  const recent = (usage.get(req.user.id) || []).filter((t) => now - t < QUOTA_WINDOW);
  if (recent.length >= QUOTA_MAX) {
    return res.status(429).json({ error: "Quota dépassé" });
  }
  usage.set(req.user.id, [...recent, now]);
  const mapKey = process.env.MAP_KEY; // jamais renvoyée au client
  // Un appel réel au fournisseur utiliserait mapKey ici. Réponse simulée :
  res.json({ query: req.query.q || "", lat: 35.7595, lng: -5.834, keyConfigured: Boolean(mapKey) });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`Mock backend sur le port ${PORT}`));
