/**
 * Vercel Serverless Function — ITS CCTV API 프록시
 * 환경변수: ITS_API_KEY (Vercel 대시보드 > Settings > Environment Variables)
 */
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const { minX, maxX, minY, maxY } = req.query;

  if (!minX || !maxX || !minY || !maxY) {
    return res.status(400).json({ error: '좌표 파라미터(minX, maxX, minY, maxY)가 필요합니다.' });
  }

  const apiKey = process.env.ITS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ITS_API_KEY 환경변수가 설정되지 않았습니다. Vercel 대시보드에서 설정해 주세요.',
    });
  }

  const BASE = 'https://openapi.its.go.kr:9443/cctvInfo';
  const commonParams = `apiKey=${apiKey}&type=json&minX=${minX}&maxX=${maxX}&minY=${minY}&maxY=${maxY}&getType=json`;

  // 세 가지 도로 유형 병렬 조회 (1=국가도로, 2=지방도, 3=도시부도로)
  const results = await Promise.allSettled(
    [1, 2, 3].map(cctvType =>
      fetch(`${BASE}?${commonParams}&cctvType=${cctvType}`, {
        signal: AbortSignal.timeout(8000),
      }).then(r => {
        if (!r.ok) throw new Error(`ITS API ${r.status}`);
        return r.json();
      })
    )
  );

  const allData = results.flatMap(r =>
    r.status === 'fulfilled' ? (r.value?.response?.data ?? r.value?.data ?? []) : []
  );

  // 캐시 60초
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  return res.json({ response: { data: allData } });
}
