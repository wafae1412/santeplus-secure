# SantéPlus Secure

 l'application mobile SantéPlus (prise de rendez-vous médicaux), réalisée avec React Native et Expo dans le cadre du module M116 – Sécurité du développement mobile (FST Tanger).

Toutes les données utilisées sont fictives.

## Contenu du dépôt

```
santeplus-secure/
├── App.tsx                      Navigation, connexion, traitement du lien profond
├── src/
│   ├── config.ts                URL de l'API, HTTPS exigé hors développement
│   ├── services/
│   │   ├── storage.ts           Jetons dans SecureStore
│   │   └── auth.ts              login, refresh, requêtes avec Bearer, logout
│   ├── screens/
│   │   ├── ArticleScreen.tsx    WebView restreinte
│   │   └── OrdonnancesScreen.tsx  Biométrie avant affichage
│   └── utils/validators.ts      Validation UUID et URL
├── mock-backend/                API Express simulée
│   └── server.js
├── .env.example
└── README.md
```

## Prérequis

- Node.js (version LTS) et Git
- Expo Go sur un téléphone Android, ou un émulateur Android (Android Studio)

## Installation

```bash
npm install
cd mock-backend
npm install
cd ..
```

Copier le fichier d'exemple puis l'adapter :

```bash
cp .env.example .env
```

(sous PowerShell : `Copy-Item .env.example .env`)

Dans `.env`, renseigner l'adresse du backend :

| Environnement | Valeur de `EXPO_PUBLIC_API_URL` |
|---|---|
| Émulateur Android | `http://10.0.2.2:3000` |
| Téléphone réel (même Wi-Fi que le PC) | `http://<IP_DU_PC>:3000` (voir `ipconfig`) |

Le fichier `.env` n'est pas versionné.

## Lancement

Terminal 1, backend :

```bash
cd mock-backend
npm start
```

Terminal 2, application :

```bash
npx expo start -c
```

Scanner le QR code avec Expo Go, ou appuyer sur `a` pour l'émulateur.

Comptes de test :

| E-mail | Mot de passe | Rôle |
|---|---|---|
| patient@test.ma | Test1234! | patient |
| autre@test.ma | Test1234! | patient |
| admin@test.ma | Admin1234! | admin |

## Corrections de sécurité

| # | Correction | Fichiers | Menace couverte |
|---|---|---|---|
| 1 | Jeton dans SecureStore (Keystore / Keychain), mot de passe supprimé, jeton de rafraîchissement | `src/services/storage.ts`, `src/services/auth.ts` | Lecture du stockage local par une autre application ou une personne ayant le téléphone |
| 2 | Connexion en POST, identifiants dans le corps JSON, jeton dans `Authorization: Bearer`, aucun log sensible, HTTPS exigé en production | `src/services/auth.ts`, `src/config.ts` | Interception sur Wi-Fi public, fuite dans les journaux et les URL |
| 3 | Contrôle du rôle côté serveur uniquement | `mock-backend/server.js` | Contournement d'un contrôle `isAdmin()` côté client |
| 4 | Lien profond : UUID validé, session exigée, rendez-vous filtré par utilisateur | `App.tsx`, `src/utils/validators.ts`, `mock-backend/server.js` | Lien forgé par une autre application, accès au rendez-vous d'autrui |
| 5 | WebView limitée à `https://santeplus.ma`, `eval` supprimé, liste blanche d'actions | `src/screens/ArticleScreen.tsx` | Injection de contenu tiers, exécution de code arbitraire |
| 6 | Biométrie avant les ordonnances, repli sur le code de l'appareil, refus si aucun verrouillage | `src/screens/OrdonnancesScreen.tsx` | Accès aux données de santé avec un téléphone déverrouillé |
| Bonus | Proxy de cartographie : clé côté serveur, quota par utilisateur | `mock-backend/server.js` (`/map/geocode`) | Extraction de la clé payante depuis l'APK |

### Détails

**Stockage.** SecureStore chiffre les valeurs avec le Keystore Android ou le Keychain iOS. AsyncStorage écrit en clair. Le mot de passe n'est plus conservé : la session est renouvelée avec un jeton de rafraîchissement qui change à chaque usage.

**Authentification.** Le jeton d'accès expire au bout de 15 minutes et le jeton de rafraîchissement au bout de 7 jours. Si le renouvellement échoue, le stockage est vidé et l'utilisateur doit se reconnecter. La déconnexion invalide les jetons côté serveur.

**Autorisation.** Un contrôle fait dans l'application peut être modifié par un attaquant (application décompilée, appareil rooté). Le serveur détermine lui-même le rôle de l'utilisateur à partir du jeton et refuse (403) les routes interdites. Un patient qui demande le rendez-vous d'un autre reçoit un 404.

**Lien profond.** Un schéma personnalisé (`santeplus://`) peut être revendiqué par n'importe quelle application installée. Le paramètre `id` doit être un UUID valide et une session est nécessaire avant l'affichage. Les App Links (Android) et Universal Links (iOS) sont liés à un domaine dont la propriété est vérifiée (`assetlinks.json`, `apple-app-site-association`), ce qui empêche une autre application de les intercepter.

**WebView.** Seules les navigations vers `https://santeplus.ma` sont acceptées. Les messages venant de la page sont analysés comme du JSON et limités à une liste d'actions (`close`, `share`).

**Biométrie.** L'application reçoit uniquement un résultat (réussi ou non) et ne voit jamais les données biométriques. Si l'appareil n'a pas de biométrie mais possède un code, celui-ci sert de repli. Sans aucun verrouillage, l'accès est refusé.

**Bonus.** L'application appelle `/map/geocode` avec son jeton. Le serveur lit `MAP_KEY` dans son environnement, applique un quota (5 requêtes par minute et par utilisateur) puis interroge le fournisseur. En production, la clé du fournisseur serait aussi restreinte à l'empreinte de l'application.

## Tests

Tests exécutés sur le backend avec `curl` :

| Cas | Résultat attendu | Résultat obtenu |
|---|---|---|
| Ordonnances sans jeton | 401 | 401 |
| Connexion avec mauvais mot de passe | 401 | 401 |
| Patient connecté : ordonnances | 200 | 200 |
| Patient sur la route admin | 403 | 403 |
| Patient sur son rendez-vous | 200 | 200 |
| Patient sur le rendez-vous d'un autre | 404 | 404 |
| Admin sur la route admin | 200 | 200 |
| Renouvellement avec jeton valide | 200 | 200 |
| Renouvellement avec le même jeton rejoué | 401 | 401 |
| 6 appels rapides au proxy cartographie | 429 au 6e | 429 au 6e |

Le code TypeScript de l'application compile sans erreur (`npx tsc --noEmit`).

Tests manuels à réaliser sur l'appareil (non automatisés) : connexion, ordonnances avec biométrie, déconnexion, lien profond.

Lien profond en test dans Expo Go :

```
exp://<IP_DU_PC>:8081/--/rdv?id=3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b
```

Le schéma `santeplus://` fonctionne uniquement dans un build de développement ou de production.

## Limites

- Le backend est une simulation : mots de passe en clair, jetons en mémoire, pas de base de données, HTTP en local.
- Le certificate pinning n'est pas implémenté.
- La détection de root et de jailbreak n'est pas incluse.
- Les App Links nécessitent un vrai domaine et ne sont pas configurés ici.
- L'URL de la WebView pointe vers `https://santeplus.ma`, domaine utilisé pour le sujet.
