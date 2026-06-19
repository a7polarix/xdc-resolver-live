// map.js – Carte Leaflet, domaines géographiques RÉELS uniquement,
// lignes pointillées bien visibles, panneau info dynamique (possessions du wallet),
// PAS de barre des catégories, zoom minimum dynamique pour remplir le conteneur.

let mainMap = null;

// ----- GROUPES DE DOMAINES PAR LIEU (réels seulement) -----
const LOCATION_GROUPS = {
  helsinki: ["helsinki.xdc"],
  bordeaux: ["bordeaux.xdc"],
  tequila: ["tequila.rwa", "tequila.depin"],
  jerusalem: ["jerusalem.depin", "jerusalem.rwa"],
  monaco: ["monaco.depin"],
  vatican: ["vatican.depin"],
  latvia: ["latvia.xdc", "latvija.xdc", "latvia.rwa", "latvija.rwa", "latvia.depin", "latvija.depin"],
  russia: ["russia.depin"],
  france: ["france.depin"],
  singapore: ["singapore.depin", "singapore.rwa"],
  thailand: ["thailand.depin", "thailand.rwa"],
  greenland: ["greenland.depin"],
  india: ["india.depin"],
  california: ["california.depin"],
  asia: ["asia.depin"],
  africa: ["africa.depin"],
  northamerica: ["northamerica.depin", "northamerica.rwa"],
  oceania: ["oceania.depin"]
};

// ----- COORDONNÉES DES LIEUX RÉELS -----
const MAP_LOCATIONS = [
  { locationId: "helsinki", lat: 60.1699, lng: 24.9384, category: "city" },
  { locationId: "bordeaux", lat: 44.8378, lng: -0.5792, category: "city" },
  { locationId: "tequila", lat: 20.8820, lng: -103.8370, category: "city" },
  { locationId: "jerusalem", lat: 31.7683, lng: 35.2137, category: "city" },
  { locationId: "monaco", lat: 43.7384, lng: 7.4246, category: "city" },
  { locationId: "vatican", lat: 41.9029, lng: 12.4534, category: "city" },
  { locationId: "latvia", lat: 56.8796, lng: 24.6032, category: "country" },
  { locationId: "russia", lat: 61.5240, lng: 105.3188, category: "country" },
  { locationId: "france", lat: 46.6034, lng: 1.8883, category: "country" },
  { locationId: "singapore", lat: 1.3521, lng: 103.8198, category: "country" },
  { locationId: "thailand", lat: 15.8700, lng: 100.9925, category: "country" },
  { locationId: "greenland", lat: 71.7069, lng: -42.6043, category: "country" },
  { locationId: "india", lat: 20.5937, lng: 78.9629, category: "country" },
  { locationId: "california", lat: 36.7783, lng: -119.4179, category: "region" },
  { locationId: "asia", lat: 34.0479, lng: 100.6197, category: "continent" },
  { locationId: "africa", lat: 8.7832, lng: 34.5085, category: "continent" },
  { locationId: "northamerica", lat: 54.5260, lng: -105.2551, category: "continent" },
  { locationId: "oceania", lat: -22.7359, lng: 140.0188, category: "continent" }
];

// ----- ÉMOJIS POUR LES CATÉGORIES (y compris géo) -----
const CATEGORIES_EMOJI = {
  admin: '⚜️', metals: '🪙', energy: '⚡', transport: '🚢',
  finance: '💰', health: '❤️', education: '🎓', art: '🎨',
  technology: '💻', environment: '🌿', security: '🔒', identity: '🆔',
  governance: '🏛️', other: '❓',
  city: '🏙️', region: '🗺️', country: '🏳️', continent: '🌍'
};

// ----- FONCTIONS -----
function getMarkerColor(category) {
  return category === 'continent' ? '#FF5733' : '#FFD700';
}

// Calcule le zoom minimum pour que la carte remplisse exactement le conteneur
function computeMinZoom() {
  const container = mainMap.getContainer();
  const h = container.clientHeight;
  const w = container.clientWidth;
  // À chaque niveau de zoom, le monde (Mercator, 360° x 170.1022°) fait 256*2^z pixels de large ET de haut.
  const zH = Math.ceil(Math.log2(h / 256));
  const zW = Math.ceil(Math.log2(w / 256));
  return Math.max(zH, zW, 0);
}

// Applique le zoom minimum et centre la carte sur le monde
function applyMinZoom() {
  const minZ = computeMinZoom();
  mainMap.setMinZoom(minZ);
  if (mainMap.getZoom() < minZ) {
    mainMap.setZoom(minZ);
  }
  if (!mainMap._centered) {
    mainMap.setView([0, 0], minZ);
    mainMap._centered = true;
  }
}

// Création de la carte et des marqueurs
function initMainMap() {
  if (mainMap) return;
  mainMap = L.map('mainMapContainer', {
    center: [0, 0],
    zoom: 2,
    zoomControl: false
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(mainMap);

  // Ajout des marqueurs (un par lieu)
  const latLngs = [];
  MAP_LOCATIONS.forEach(loc => {
    latLngs.push([loc.lat, loc.lng]);
    const color = getMarkerColor(loc.category);
    const marker = L.circleMarker([loc.lat, loc.lng], {
      radius: 8,
      color: color,
      fillColor: color,
      fillOpacity: 0.6,
      weight: 2
    }).addTo(mainMap);

    marker.bindPopup(`<b>${loc.locationId}</b><br>${CATEGORIES_EMOJI[loc.category] || '?'} ${loc.category}`);
    marker.on('click', () => {
      updateDomainInfoPanel(loc.locationId);
    });
  });

  // Lignes pointillées bien visibles
  if (latLngs.length > 1) {
    L.polyline(latLngs, {
      color: '#FFD700',
      dashArray: '6, 8',
      weight: 1.8,
      opacity: 0.7
    }).addTo(mainMap);
  }

  // Appliquer le zoom minimum dynamique (remplit le conteneur)
  applyMinZoom();

  window.addEventListener('resize', () => {
    applyMinZoom();
  });

  // Boutons zoom personnalisés
  document.getElementById('zoomInBtn').addEventListener('click', () => mainMap.zoomIn());
  document.getElementById('zoomOutBtn').addEventListener('click', () => mainMap.zoomOut());

  // Pas de barre des catégories
}

// Met à jour le panneau d'information après un clic sur un lieu
async function updateDomainInfoPanel(locationId) {
  const panel = document.getElementById('domainInfoPanel');
  if (!panel) return;

  if (typeof window.checkOwnedDomains !== 'function') {
    panel.innerHTML = '⚠️ Fonction de vérification non disponible. Rechargez la page.';
    return;
  }

  const domains = LOCATION_GROUPS[locationId];
  if (!domains || domains.length === 0) {
    panel.innerHTML = 'Aucun domaine associé à ce lieu.';
    return;
  }

  panel.innerHTML = '🔍 Vérification de la possession...';
  try {
    const owned = await window.checkOwnedDomains(domains);
    if (owned.length === 0) {
      panel.innerHTML = `Aucun domaine possédé pour <b>${locationId}</b>.`;
    } else {
      const lines = owned.map(d => `${d}`);
      panel.innerHTML = `<b>${locationId}</b> :<br>✅ ${lines.join('<br>✅ ')}`;
    }
  } catch (e) {
    panel.innerHTML = `❌ Erreur : ${e.message}`;
  }
}

// Détection IP (appelée au chargement)
async function detectAndShowMainLocation() {
  try {
    const resp = await fetch('https://ipapi.co/json/');
    const data = await resp.json();
    if (data.latitude && data.longitude) {
      mainMap.setView([data.latitude, data.longitude], 10);
      L.marker([data.latitude, data.longitude], {
        icon: L.divIcon({ className: 'user-location-icon', html: '📍', iconSize: [20,20] })
      }).addTo(mainMap).bindPopup('Votre position approximative');
    }
  } catch (e) {
    console.warn('Géolocalisation IP échouée', e);
  }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  initMainMap();
  detectAndShowMainLocation();
});

// Exposition pour les autres modules
window.toggleMapLayer = function(layerName, enable) { /* délégué à toolbar.js */ };
window.updateDomainInfoPanel = updateDomainInfoPanel;
window.CATEGORIES_EMOJI = CATEGORIES_EMOJI;