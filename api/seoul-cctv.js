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
    // Fetch all ~4652 records in parallel pages of 1000
    const pageSize = 1000;
    const pageCount = 5;

    const pages = Array.from({ length: pageCount }, (_, i) => {
      const start = i * pageSize + 1;
      const end = (i + 1) * pageSize;
      const url = `http://openapi.seoul.go.kr:8088/${key}/json/TbOpendataFixedcctv/${start}/${end}/`;
      return fetch(url, { signal: AbortSignal.timeout(8000) })
        .then(r => r.json())
        .catch(() => null);
    });

    const results = await Promise.all(pages);

    const allRows = results.flatMap(data => data?.TbOpendataFixedcctv?.row || []);

    const filtered = allRows
      .filter(row => {
        const x = parseFloat(row.LOT);
        const y = parseFloat(row.LAT);
        return !isNaN(x) && !isNaN(y) && x >= minX && x <= maxX && y >= minY && y <= maxY;
      })
      .map(row => ({
        cctvname: row.CRDN_BRNCH_NM || row.FIX_CCTV_ADDR,
        coordx: row.LOT,
        coordy: row.LAT,
        cctvurl: '',
        cctvtype: '4',
        source: 'seoul',
        addr: `${row.FIX_CCTV_ADDR} [${row.GRNDS_SE || '단속'}]`,
      }));

    res.json({ data: filtered, total: filtered.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
