// 경찰청 UTIC 도시교통정보센터 CCTV API 프록시
// - 서울 교차로 중심 도심 CCTV 커버
// - UTIC_API_KEY: Vercel 환경변수에 설정
// - UTIC_API_ENDPOINT: Vercel 환경변수에 설정 (승인 이메일에 포함된 엔드포인트)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { lat, lng, delta = '0.12' } = req.query;
  const key = process.env.UTIC_API_KEY;
  const endpoint = process.env.UTIC_API_ENDPOINT;

  if (!key) {
    const uticVars = Object.keys(process.env).filter(k => k.includes('UTIC') || k.includes('utic'));
    return res.status(500).json({ error: 'UTIC_API_KEY not set', hint: uticVars });
  }
  if (!endpoint) return res.status(500).json({ error: 'UTIC_API_ENDPOINT not set' });
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required' });

  const d = parseFloat(delta);
  const minX = (parseFloat(lng) - d).toFixed(6);
  const maxX = (parseFloat(lng) + d).toFixed(6);
  const minY = (parseFloat(lat) - d).toFixed(6);
  const maxY = (parseFloat(lat) + d).toFixed(6);

  try {
    const url = `${endpoint}?apiKey=${key}&minX=${minX}&maxX=${maxX}&minY=${minY}&maxY=${maxY}&getType=json`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!response.ok) throw new Error(`UTIC API ${response.status}`);

    const data = await response.json();
    const list = data?.response?.data ?? data?.data ?? [];

    const result = list
      .filter(c => c.coordx && c.coordy && c.cctvurl)
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
