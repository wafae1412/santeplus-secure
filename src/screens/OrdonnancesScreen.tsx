import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import * as LocalAuth from "expo-local-authentication";
import { authFetch } from "../services/auth";

export default function OrdonnancesScreen() {
  const [items, setItems] = useState<{ id: number; texte: string }[] | null>(null);
  const [msg, setMsg] = useState("Authentification en cours...");

  useEffect(() => {
    (async () => {
      // Aucun verrouillage configuré sur l'appareil : accès refusé.
      const level = await LocalAuth.getEnrolledLevelAsync();
      if (level === LocalAuth.SecurityLevel.NONE) {
        setMsg("Configurez un verrouillage d'écran (empreinte, visage ou code) pour voir vos ordonnances.");
        return;
      }
      // Biométrie si disponible, sinon code de l'appareil (repli).
      const result = await LocalAuth.authenticateAsync({
        promptMessage: "Confirmez votre identité",
        fallbackLabel: "Utiliser le code",
      });
      if (!result.success) {
        setMsg("Authentification refusée.");
        return;
      }
      try {
        const res = await authFetch("/ordonnances");
        setItems(await res.json());
      } catch {
        setMsg("Impossible de charger les ordonnances.");
      }
    })();
  }, []);

  if (!items) {
    return <View style={{ padding: 24 }}><Text>{msg}</Text></View>;
  }
  return (
    <View style={{ padding: 24 }}>
      {items.map((o) => <Text key={o.id}>{o.texte}</Text>)}
    </View>
  );
}
