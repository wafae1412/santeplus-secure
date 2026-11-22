import { useEffect, useState } from "react";
import { Button, SafeAreaView, Text, TextInput, View } from "react-native";
import * as Linking from "expo-linking";
import { login, logout, authFetch } from "./src/services/auth";
import * as storage from "./src/services/storage";
import { isUuid } from "./src/utils/validators";
import ArticleScreen from "./src/screens/ArticleScreen";
import OrdonnancesScreen from "./src/screens/OrdonnancesScreen";

type Rdv = { id: string; medecin: string; date: string };

const input = { borderWidth: 1, marginVertical: 8, padding: 8 } as const;

export default function App() {
  const [screen, setScreen] = useState("login");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState("");
  const [rdv, setRdv] = useState<Rdv | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function openRdv(id: string) {
    try {
      const res = await authFetch(`/rdv/${id}`);
      if (!res.ok) {
        setError("Rendez-vous introuvable");
        setScreen("home");
        return;
      }
      setRdv(await res.json());
      setScreen("rdv");
    } catch {
      setScreen("login");
    }
  }

  // Validation du lien profond : route attendue, UUID valide, session obligatoire.
  async function handleUrl(url: string | null) {
    if (!url) return;
    const parsed = Linking.parse(url);
    const id = parsed.queryParams?.id;
    const isRdvRoute = parsed.hostname === "rdv" || parsed.path === "rdv";
    if (!isRdvRoute || !isUuid(id)) return;
    if (!(await storage.getAccess())) {
      setPending(id);
      setScreen("login");
      return;
    }
    await openRdv(id);
  }

  useEffect(() => {
    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener("url", (e) => handleUrl(e.url));
    return () => sub.remove();
  }, []);

  async function onLogin() {
    try {
      setError("");
      await login(email, pwd);
      setPwd("");
      if (pending) {
        const id = pending;
        setPending(null);
        await openRdv(id);
      } else {
        setScreen("home");
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function onLogout() {
    await logout();
    setScreen("login");
  }

  if (screen === "articles") {
    return (
      <SafeAreaView style={{ flex: 1, marginTop: 40 }}>
        <ArticleScreen onClose={() => setScreen("home")} />
      </SafeAreaView>
    );
  }
  if (screen === "ordo") {
    return (
      <SafeAreaView style={{ flex: 1, marginTop: 40 }}>
        <OrdonnancesScreen />
        <Button title="Retour" onPress={() => setScreen("home")} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 24, marginTop: 40 }}>
      <Text style={{ fontSize: 24, fontWeight: "bold" }}>SantéPlus</Text>
      {screen === "login" && (
        <View>
          <TextInput placeholder="E-mail" autoCapitalize="none" keyboardType="email-address"
            value={email} onChangeText={setEmail} style={input} />
          <TextInput placeholder="Mot de passe" secureTextEntry value={pwd}
            onChangeText={setPwd} style={input} />
          <Button title="Connexion" onPress={onLogin} />
        </View>
      )}
      {screen === "home" && (
        <View style={{ gap: 12, marginTop: 16 }}>
          <Button title="Mes ordonnances" onPress={() => setScreen("ordo")} />
          <Button title="Articles santé" onPress={() => setScreen("articles")} />
          <Button title="Déconnexion" onPress={onLogout} />
        </View>
      )}
      {screen === "rdv" && rdv && (
        <View style={{ marginTop: 16 }}>
          <Text>{rdv.medecin} le {rdv.date}</Text>
          <Button title="Retour" onPress={() => setScreen("home")} />
        </View>
      )}
      {!!error && <Text style={{ color: "red" }}>{error}</Text>}
    </SafeAreaView>
  );
}
