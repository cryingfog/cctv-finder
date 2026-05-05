export default async function handler(req, res) {
  const apiKey = process.env.ITS_API_KEY;

  if (!apiKey) {
    return res.json({ error: 'ITS_API_KEY 없음' });
  }

  // 한남대교 근처 좌표 고정 테스트
  const url = `https://openapi.its.go.kr:9443/cctvInfo?apiKey=${apiKey}&type=json&cctvType=1&minX=126.98&maxX=127.03&minY=37.51&maxY=37.54&getType=json`;

  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const text = await r.text();
    return res.json({
      status: r.status,
      ok: r.ok,
      keyUsed: apiKey.slice(0, 6) + '...',
      body: text.slice(0, 500),
    });
  } catch (e) {
    return res.json({ error: e.message, type: e.constructor.name });
  }
}
