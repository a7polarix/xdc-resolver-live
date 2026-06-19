// Le Moteur de Destin d'Arcadia - Géré par Toshiro
const MESH_CONFIG_ROOTS = {
    "france.depin": { type: "STORY", color: "#00ffc8", danger: "Epic" },
    "arcadia.depin": { type: "NEXUS", color: "#00ffd0", danger: "Safe" },
    // ... Les 407 domaines racines
};

async function resolveNode(domainName) {
    console.log(`[Toshiro] Branchement du câble sur : ${domainName}`);
    
    // 1. Vérification si le domaine est une racine connue
    if (MESH_CONFIG_ROOTS[domainName]) {
        return renderStaticNode(domainName, MESH_CONFIG_ROOTS[domainName]);
    }
    
    // 2. Si non listé (Un des 6000 sous-domaines), génération procédurale via le Ledger
    return await generateProceduralGhostNode(domainName);
}

async function generateProceduralGhostNode(subDomain) {
    // On génère un hash unique à partir du nom du sous-domaine
    const hash = btoa(subDomain).substring(0, 8); 
    const charCodeSum = [...hash].reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    // Détermination de la faction du nœud fantôme (Bleu ou Rouge)
    const alignment = charCodeSum % 2 === 0 ? "ROUGE_CHAOS" : "BLEU_ORDRE";
    const dangerLevel = (charCodeSum % 10) + 1; // Danger de 1 à 10
    
    // Calcul de l'impact de la Peur (Loi d'entropie)
    const hpDrain = dangerLevel * 1.5;

    // Structure renvoyée dynamiquement à l'interface vectorielle
    return {
        node_type: "GHOST_LABYRINTH",
        lore: `Vous avez glissé dans les failles d'Arcadia. Ce lieu porte la signature spectrale : [${hash}].`,
        mechanics: `Infection par la Peur élevée. Perte de ${hpDrain} HP par bloc. Résolvez l'énigme pour fuir.`,
        next_nodes: ['arcadia.depin', 'deathnote.depin'], // Portes de sortie standards
        vector_layout: {
            color: alignment === "ROUGE_CHAOS" ? "#ff0055" : "#0055ff",
            layer: "sub_catacombs",
            effect: "noise_vibration_distortion",
            mesh_density: charCodeSum % 100
        },
        enigma: {
            question: `Convertissez le fragment simeon [${hash}] sous la grammaire unicode.depin pour annuler la Peur.`,
            difficulty: charCodeSum % 20
        }
    };
}

// Fonction d'affichage dans le canvas de master.html
function renderStaticNode(name, config) {
    // Rendu de la carte officielle stable
    return {
        node_type: "ROOT_TERRITORY",
        lore: `Vous êtes en territoire souverain : ${name}.`,
        vector_layout: { color: config.color, layer: "surface_empire", effect: "stable_glow" }
    };
}