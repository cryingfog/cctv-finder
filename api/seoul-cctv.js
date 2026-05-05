export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { lat, lng, delta = '0.12' } = req.query;
  const key = process.env.SEOUL_API_KEY;

  if (!key) return res.status(500).json({ error: 'SEOUL_API_KEY not set' });
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required' });

  const d = parseFloat(delta);
  const minX = parseFloat(lng) - d;
  const maxX = parseFloat(lng) + d;
  const minY = parseFloat(lat) - d;
  const maxY = parseFloat(lat) + d;

  try {
    const url = `http://openapi.seoul.go.kr:8088/${key}/json/GetCCTVInfo/1/1000/`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!response.ok) throw new Error(`Seoul API ${response.status}`);

    const data = await response.json();

    // DEBUG: return raw response structure
    const topKeys = Object.keys(data);
    const rawSample = JSON.stringify(data).slice(0, 500);
    res.json({ debug: true, topKeys, rawSample, keyUsed: key.slice(0, 4) + '...' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
