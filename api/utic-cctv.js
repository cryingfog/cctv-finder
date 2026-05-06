// 경찰청 UTIC 도시교통정보센터 CCTV API 프록시
// endpoint: http://www.utic.go.kr/guide/cctvOpenData.do
// param: key= (not apiKey=)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { lat, lng, delta = '0.12' } = req.query;
  const key = process.env.UTIC_API_KEY;
  const endpoint = process.env.UTIC_API_ENDPOINT;

  if (!key) return res.status(500).json({ error: 'UTIC_API_KEY not set' });
  if (!endpoint) return res.status(500).json({ error: 'UTIC_API_ENDPOINT not set' });
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required' });

  const d = parseFloat(delta);
  const minX = parseFloat(lng) - d;
  const maxX = parseFloat(lng) + d;
  const minY = parseFloat(lat) - d;
  const maxY = parseFloat(lat) + d;

  try {
    const url = `${endpoint}?key=${key}&getType=json`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!response.ok) throw new Error(`UTIC API ${response.status}`);

    const data = await response.json();
    // DEBUG
    return res.json({ _debug: true, type: typeof data, isArray: Array.isArray(data), keys: Array.isArray(data) ? null : Object.keys(data), sample: Array.isArray(data) ? data.slice(0, 2) : data });

    // UTIC returns array or object with items; normalize to array
    const raw = Array.isArray(data) ? data : (data?.data ?? data?.response?.data ?? []);

    // Filter to valid CCTVs with stream URL, then apply bounding box
    const result = raw
      .filter(c => {
        const x = parseFloat(c.coordx);
        const y = parseFloat(c.coordy);
        return c.cctvurl && !isNaN(x) && !isNaN(y) && x >= minX && x <= maxX && y >= minY && y <= maxY;
      })
      .map(c => ({
        cctvname: c.cctvname,
        coordx: c.coordx,
        coordy: c.coordy,
        cctvurl: c.cctvurl,
        cctvtype: 'utic',
        source: 'utic',
      }));

    res.json({ data: result, total: result.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
