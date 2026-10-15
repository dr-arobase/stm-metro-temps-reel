# STM Métro — Application temps réel

Application React + Leaflet.js qui affiche :
- Le tracé des 4 lignes du métro de Montréal (GeoJSON)
- Les stations avec info-bulle
- Les rames de métro en mouvement via GTFS-Realtime (polling toutes les 8s)
- Un volet latéral avec alertes de service en temps réel

## Architecture

```
metro-app/
├── index.html
├── vite.config.js
├── package.json
├── .env.example          ← copier en .env et remplir la clé API
│
├── server/
│   └── index.js          ← proxy Express : /api/vehicles + /api/alerts
│
├── public/
│   └── data/
│       ├── lines.geojson     ← tracés des 4 lignes
│       └── stations.geojson  ← toutes les stations STM
│
└── src/
    ├── App.jsx / App.module.css
    ├── index.css
    ├── main.jsx
    ├── components/
    │   ├── Sidebar.jsx / Sidebar.module.css
    │   ├── VehicleLayer.jsx
    │   ├── LinesLayer.jsx
    │   └── StationsLayer.jsx
    ├── hooks/
    │   ├── useVehicles.js
    │   └── useAlerts.js
    └── utils/
        └── lines.js
```

## Prérequis

- Node.js ≥ 18
- Une clé API STM (gratuite) : https://portail.developpeurs.stm.info

## Installation

```bash
cd metro-app
npm install
```

Copier le fichier `.env.example` en `.env` et remplir votre clé :

```bash
cp .env.example .env
# puis modifier .env :
# STM_API_KEY=VOTRE_CLÉ_ICI
```

## Lancer en développement

```bash
npm run dev
```

- Frontend React : http://localhost:5173
- Proxy Express  : http://localhost:3001

Vite proxifie automatiquement `/api/*` vers Express — un seul onglet à ouvrir.

## Build production

```bash
npm run build
# les fichiers sont dans dist/
# lancer le proxy séparément avec : node server/index.js
```

## Format JSON attendu par l'application (depuis le proxy)

**Véhicules** (`GET /api/vehicles`) :
```json
[
  { "id": "v1", "routeId": "1", "lat": 45.508, "lon": -73.587,
    "label": "rame-21", "bearing": 90, "speed": 14.5, "timestamp": 1712345678 }
]
```

**Alertes** (`GET /api/alerts`) :
```json
[
  { "id": "a1", "headerText": "Délai Ligne Verte",
    "description": "Suite à un incident technique…",
    "effect": "SIGNIFICANT_DELAYS", "routes": ["1"] }
]
```

## Personnalisation

| Paramètre | Fichier | Description |
|---|---|---|
| Intervalle véhicules | `src/hooks/useVehicles.js` | `POLL_INTERVAL` (défaut 8000 ms) |
| Intervalle alertes | `src/hooks/useAlerts.js` | `POLL_INTERVAL` (défaut 60 000 ms) |
| Couleurs lignes | `src/utils/lines.js` | `LINE_COLORS` |
| Centre de la carte | `src/App.jsx` | `MTL_CENTER` / `MTL_ZOOM` |
