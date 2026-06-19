// api/translate.js – Proxy vers DeepLX (public)
export default async function handler(req, res) {
    // Autoriser CORS pour ton frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { text, source_lang = 'FR', target_lang } = req.body;

    if (!text || !target_lang) {
        return res.status(400).json({ error: 'Missing text or target_lang' });
    }

    try {
        // Appel vers l'API DeepLX publique (ou un autre service)
        // Tu peux aussi utiliser ton propre endpoint DeepLX déployé ailleurs
        const response = await fetch('https://api.deeplx.org/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text,
                source_lang: source_lang,
                target_lang: target_lang
            })
        });

        if (!response.ok) throw new Error(`DeepLX error: ${response.status}`);
        const data = await response.json();
        res.status(200).json({ data: data.data });
    } catch (error) {
        console.error('Translation error:', error);
        // Fallback vers MyMemory si DeepLX échoue
        try {
            const fallbackUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=fr|${target_lang.toLowerCase()}`;
            const fallbackRes = await fetch(fallbackUrl);
            const fallbackData = await fallbackRes.json();
            if (fallbackData?.responseData?.translatedText) {
                return res.status(200).json({ data: fallbackData.responseData.translatedText });
            }
        } catch (fbErr) {
            // ignore
        }
        res.status(500).json({ error: 'Translation failed' });
    }
}