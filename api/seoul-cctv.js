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

    const result = data?.GetCCTVInfo?.RESULT;
    if (result && result.CODE !== 'INFO-000') {
      throw new Error(result.MESSAGE || 'Seoul API error');
    }

    const rows = data?.GetCCTVInfo?.row || [];

    const filtered = rows
      .map(item => ({
        cctvname: item.CCTV_NM || item.CCTV_NAME || item.cctvNm || item.cctvname || '',
        cctvurl:  item.CCTV_URL || item.cctvurl || item.STREAM_URL || item.streamUrl || '',
        coordx:   String(item.X_COORD || item.LON || item.x_coord || item.lon || ''),
        coordy:   String(item.Y_COORD || item.LAT || item.y_coord || item.lat || ''),
        cctvtype: '4',
        source:   'seoul',
      }))
      .filter(c => {
        const x = parseFloat(c.coordx);
        const y = parseFloat(c.coordy);
        return !isNaN(x) && !isNaN(y) && x >= minX && x <= maxX && y >= minY && y <= maxY;
      });

    const rawKeys = rows[0] ? Object.keys(rows[0]) : [];
    res.json({ data: filtered, total: rows.length, rawKeys, keyUsed: key.slice(0, 4) + '...' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
