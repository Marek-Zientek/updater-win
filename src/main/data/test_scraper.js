const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', (err) => reject(err));
  });
}

async function test() {
  const query = encodeURIComponent("Intel Core i5-14400F socket TDP lithography");
  const url = `https://html.duckduckgo.com/html/?q=${query}`;
  console.log('Fetching:', url);
  try {
    const html = await fetchUrl(url);
    // Find snippets: <a class="result__snippet" ...> ... </a>
    const snippetRegex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    const snippets = [];
    while ((match = snippetRegex.exec(html)) !== null) {
      const cleanSnippet = match[1].replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").trim();
      snippets.push(cleanSnippet);
    }
    
    console.log(`Found ${snippets.length} snippets.`);
    snippets.forEach((s, i) => console.log(`Snippet ${i+1}: ${s}`));

    // Run heuristics over snippets to extract specs
    let socket = null;
    let tdp = null;
    let lithography = null;
    let codename = null;
    let releaseDate = null;

    const fullText = snippets.join(' | ');

    // Socket regex
    const socketMatch = fullText.match(/\b(LGA\s*\d+|AM\d+|AM5|AM4|FCLGA\d+|BGA\s*\d+)\b/i);
    if (socketMatch) socket = socketMatch[1];

    // TDP regex
    const tdpMatch = fullText.match(/\b(\d+)\s*(W|Watts)\b/i);
    if (tdpMatch) tdp = tdpMatch[0];

    // Lithography regex
    const lithoMatch = fullText.match(/\b(\d+)\s*nm\b/i);
    if (lithoMatch) lithography = lithoMatch[0];

    // Codename list lookup
    const CODENAMES = ['Raptor Lake', 'Alder Lake', 'Meteor Lake', 'Arrow Lake', 'Zen 4', 'Zen 3', 'Zen 5', 'Vermeer', 'Raphael', 'Phoenix'];
    for (const name of CODENAMES) {
      if (new RegExp('\\b' + name + '\\b', 'i').test(fullText)) {
        codename = name;
        break;
      }
    }

    // Release Date regex
    const releaseMatch = fullText.match(/\b(Q[1-4]\s*20\d{2}|20\d{2})\b/i);
    if (releaseMatch) releaseDate = releaseMatch[1];

    console.log('\n--- Extracted Heuristic Specs ---');
    console.log('Socket:', socket || 'Not found');
    console.log('TDP:', tdp || 'Not found');
    console.log('Lithography:', lithography || 'Not found');
    console.log('Codename:', codename || 'Not found');
    console.log('Release Date:', releaseDate || 'Not found');

  } catch (err) {
    console.error('Error fetching/parsing:', err);
  }
}

test();
