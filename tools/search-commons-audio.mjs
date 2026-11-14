// Search Wikimedia Commons for authentic audio tracks
async function searchAudio(query) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query + ' filetype:audio')}&srnamespace=6&format=json`;
  const res = await fetch(url, { headers: { 'User-Agent': 'HEARTH-Audio/1.0 (kishore1035@github)' } });
  const data = await res.json();
  return (data?.query?.search || []).slice(0, 5).map((item) => ({
    title: item.title,
    snippet: item.snippet ? item.snippet.replace(/<[^>]+>/g, '') : ''
  }));
}

async function main() {
  const queries = [
    'sitar tanpura',
    'sitar music',
    'river water flow',
    'ganges river',
    'desert wind howling',
    'himalaya wind',
    'blizzard arctic wind',
    'waterfall roaring',
    'canyon echo wind',
    'andean flute',
    'coral reef underwater',
    'geiger counter radiation',
    'venice canal gondola',
    'church bells distance',
    'ocean surf breaking',
    'calm gentle beach waves',
    'tropical rain thunder',
    'mountain torrent river',
    'congo rainforest',
    'jungle night frogs'
  ];

  for (const q of queries) {
    const results = await searchAudio(q);
    console.log(`\n=== "${q}" ===`);
    results.forEach((r, i) => console.log(`  ${i + 1}. ${r.title}`));
    await new Promise((r) => setTimeout(r, 600));
  }
}

main();
