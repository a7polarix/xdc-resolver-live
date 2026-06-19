const MAP_NODES = {
    "TOMBEAU": { 
        lat: 48.85, lng: 2.35, 
        label: "Tombeau du Ressuscité", 
        color: "#ff0055" 
    },
    "ORPHELINAT": { 
        lat: 49.25, lng: 4.03, // Reims
        label: "Orphelinat de la Providence", 
        color: "#00d4ff" 
    },
    "JERUSALEM": { 
        lat: 31.76, lng: 35.21, 
        label: "La Nouvelle Jérusalem", 
        color: "#ffd700" 
    },
    "SOURCE": { 
        lat: 0.0, lng: 0.0, // Point de distorsion
        label: "La Source (Le Vide)", 
        color: "#ffffff" 
    }
};

// Fonction pour peupler la carte automatiquement au chargement
function initLoreMap() {
    Object.keys(MAP_NODES).forEach(key => {
        const node = MAP_NODES[key];
        const marker = L.circleMarker([node.lat, node.lng], {
            color: node.color,
            radius: 8,
            className: 'pulse-animation'
        }).addTo(map);

        marker.bindPopup(`<b>${node.label}</b>`);
        marker.on('click', () => navigateLore(key));
    });
}