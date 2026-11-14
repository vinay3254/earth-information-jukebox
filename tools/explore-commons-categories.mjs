async function getCategoryMembers(cat) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&list=categorymembers&cmtitle=${encodeURIComponent(cat)}&cmtype=file&format=json`;
  const res = await fetch(url, { headers: { 'User-Agent': 'HEARTH-Audio/1.0 (kishore1035@github)' } });
  const data = await res.json();
  return data?.query?.categorymembers || [];
}

async function main() {
  const cats = [
    'Category:Audio files of waterfalls',
    'Category:Audio files of rivers and streams',
    'Category:Audio files of bells in Italy',
    'Category:Sounds of rain',
    'Category:Sounds of the sea'
  ];

  for (const cat of cats) {
    console.log(`\n=== ${cat} ===`);
    const files = await getCategoryMembers(cat);
    files.slice(0, 8).forEach(f => console.log('  ' + f.title));
    await new Promise(r => setTimeout(r, 800));
  }
}

main().catch(console.error);
