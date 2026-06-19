const LoreLoop = {
    currentEra: "TOMBEAU_RESSUSCITE",
    
    // Fonction qui force le rollback narratif
    rollback: function(chapterTarget) {
        console.log("Distorsion temporelle activée : Rollback vers " + chapterTarget);
        this.renderNarrative(chapterTarget);
    },

    // Le Tome IV : Le Moteur qui mélange tout
    mergeLore: function() {
        const globalLore = [
            ...content_vierge_celeste,
            ...journal_tresher,
            ...source_nodes
        ];
        // Mélange les événements pour créer une nouvelle réalité narrative
        return globalLore.sort(() => Math.random() - 0.5);
    }
};