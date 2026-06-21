// api/domains.js
// ============================================================
// EVA-01 — Domaines XDC classifiés par catégorie
// ============================================================

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let classifiedDomains = null;

function loadDomains() {
  if (classifiedDomains) return classifiedDomains;
  try {
    const raw = readFileSync(join(__dirname, '..', 'modules', 'web3-domains', 'xdc_domains_classified.json'), 'utf8');
    classifiedDomains = JSON.parse(raw);
  } catch (e) {
    console.error('[DOMAINS] Failed to load classified domains:', e.message);
    classifiedDomains = {};
  }
  return classifiedDomains;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  const { category, limit = 100, offset = 0 } = req.query;

  const domains = loadDomains();

  if (category) {
    const cat = domains[category];
    if (!cat) {
      return res.status(404).json({ error: `Unknown category: ${category}`, available: Object.keys(domains) });
    }
    const allDomains = cat.domains || [];
    const sliced = allDomains.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    return res.status(200).json({
      category,
      label: cat.label,
      count: cat.count,
      total: allDomains.length,
      offset: parseInt(offset),
      limit: parseInt(limit),
      domains: sliced,
    });
  }

  // Return all categories summary
  const summary = Object.entries(domains).map(([key, val]) => ({
    category: key,
    label: val.label,
    count: val.count,
  }));

  return res.status(200).json({
    totalCategories: summary.length,
    categories: summary,
  });
}
