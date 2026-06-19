const LORE_DB = {
    "reims": { 
        title: "La Colonie de Reims", 
        text: "Jeanne a replanté les fleurs de Lys. Le feu nucléaire semble lointain ici.",
        vector: [49.258, 4.031] 
    },
    "void": { 
        title: "Le Vide Primordial", 
        text: "La nature de l'univers a changé. Les lois de la physique sont réécrites.",
        vector: [0, 0] 
    }
};

// Fonction pour mettre à jour la carte et afficher le livre
function navigateLore(nodeId) {
    const data = LORE_DB[nodeId];
    // 1. Mouvement de la carte Leaflet
    map.setView(data.vector, 6);
    // 2. Affichage du texte dans ton interface
    document.getElementById('storySegment').innerText = data.text;
    // 3. Rendu vectoriel dynamique (via Canvas ou SVG)
}