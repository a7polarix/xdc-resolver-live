import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Méthode non autorisée. Utilisez POST.' });
    }

    const { player, difficulty = 10, targetQuest = 'global' } = req.body;

    if (!player) {
        return res.status(400).json({ error: 'Paramètre [player] manquant.' });
    }

    // 1. Génération d'un nombre hautement aléatoire entre 1 et 20 via CSPRNG
    const buffer = crypto.randomBytes(4);
    const uint32 = buffer.readUInt32BE(0);
    const d20Roll = (uint32 % 20) + 1;

    // 2. Calcul du résultat sémantique
    const isCriticalSuccess = d20Roll === 20;
    const isCriticalFailure = d20Roll === 1;
    const isSuccess = isCriticalSuccess ? true : (isCriticalFailure ? false : d20Roll >= difficulty);

    // 3. Génération de l'empreinte unique du lancer (pour journal.depin)
    const rollId = crypto.createHash('sha256')
        .update(`${player}-${targetQuest}-${d20Roll}-${Date.now()}`)
        .digest('hex');

    // 4. Payload sémantique retourné à l'interface Fleurs de Lys
    const responsePayload = {
        object: "depin.diceroll.event",
        id: `roll_${rollId.substring(0, 16)}`,
        timestamp: new Date().toISOString(),
        metadata: {
            player: player,
            quest: targetQuest,
            difficulty_class: difficulty
        },
        dice: {
            type: "d20",
            raw_value: d20Roll,
            modifier: 0 // Évolutif selon les attributs du joueur plus tard
        },
        resolution: {
            success: isSuccess,
            critical_success: isCriticalSuccess,
            critical_failure: isCriticalFailure,
            summary: isCriticalSuccess ? "CRITICAL_SUCCESS" : (isCriticalFailure ? "CRITICAL_FAILURE" : (isSuccess ? "SUCCESS" : "FAILURE"))
        }
    };

    return res.status(200).json(responsePayload);
}