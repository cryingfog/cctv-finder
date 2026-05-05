export default async function handler(req, res) {
  const apiKey = process.env.ITS_API_KEY;
  if (!apiKey) return res.json({ error: 'ITS_API_KEY 없음' });

  const params = `apiKey=${apiKey}&type=json&cctvType=1&minX=126.98&maxX=127.03&minY=37.51&maxY=37.54&getType=json`;

  const endpoints = [
    `https://openapi.its.go.kr:9443/cctvInfo?${params}`,
    `http://openapi.its.go.kr:8080/api/NCCTVInfo?${params}`,
    `https://openapi.its.go.kr/cctvInfo?${params}`,
    `http://openapi.its.go.kr/api/NCCTVInfo?${params}`,
  ];

  const results = {};
  for (const url of endpoints) {
    const label = url.replace(`apiKey=${apiKey}`, 'apiKey=***');
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const text = await r.text();
      results[label] = { status: r.status, body: text.slice(0, 200) };
    } catch (e) {
      results[label] = { error: e.message };
    }
  }

  return res.json(results);
}
