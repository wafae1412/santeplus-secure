// URL de l'API. HTTPS obligatoire hors développement.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://api.santeplus.ma";

if (!__DEV__ && !API_URL.startsWith("https://")) {
  throw new Error("HTTPS obligatoire en production");
}
