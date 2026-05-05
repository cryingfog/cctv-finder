'use strict';

// ── State ──────────────────────────────────────────────────────────────────
let map = null;
let clickMarker = null;
let cctvMarkers = [];
let currentCount = 12;
let lastLatLng = null;
let isSearching = false;

// ── 지도 초기화 (Leaflet + OpenStreetMap) ─────────────────────────────────
function initMap() {
  map = L.map('map', {
    center: [37.5665, 126.9780],
    zoom: 12,
    zoomControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);

  map.on('click', function (e) {
    const { lat, lng } = e.latlng;
    placeClickMarker(lat, lng);
    lastLatLng = { lat, lng };
    fetchCCTVs(lat, lng);
  });
}

// ── 클릭 마커 ─────────────────────────────────────────────────────────────
function placeClickMarker(lat, lng) {
  if (clickMarker) map.removeLayer(clickMarker);

  clickMarker = L.marker([lat, lng], {
    icon: L.divIcon({
      className: '',
      html: '<div class="click-marker">📍</div>',
      iconAnchor: [14, 28],
    }),
    zIndexOffset: 1000,
  }).addTo(map);
}

// ── 주소 검색 (Nominatim - 무료, API 키 불필요) ───────────────────────────
async function searchLocation() {
  const keyword = document.getElementById('searchInput').value.trim();
  if (!keyword || !map) return;

  const btn = document.getElementById('searchBtn');
  btn.textContent = '검색 중...';
  btn.disabled = true;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(keyword)}&format=json&limit=1&accept-language=ko&countrycodes=kr`,
      { headers: { 'Accept-Language': 'ko' } }
    );
    const data = await res.json();

    if (data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      map.setView([lat, lng], 14);
    } else {
      alert(`"${keyword}" 검색 결과를 찾을 수 없습니다.`);
    }
  } catch {
    alert('검색 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
  } finally {
    btn.textContent = '검색';
    btn.disabled = false;
  }
}

// ── 엔터키 검색 ───────────────────────────────────────────────────────────
document.getElementById('searchInput').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') searchLocation();
});

// ── CCTV 개수 변경 ────────────────────────────────────────────────────────
document.getElementById('cctvCount').addEventListener('change', function () {
  currentCount = parseInt(this.value, 10);
  if (lastLatLng) fetchCCTVs(lastLatLng.lat, lastLatLng.lng);
});

// ── CCTV 데이터 조회 (브라우저에서 ITS API 직접 호출) ────────────────────
async function fetchCCTVs(lat, lng) {
  if (isSearching) return;
  isSearching = true;

  const delta = 0.12;
  const minX = (lng - delta).toFixed(6);
  const maxX = (lng + delta).toFixed(6);
  const minY = (lat - delta).toFixed(6);
  const maxY = (lat + delta).toFixed(6);

  setUIState('loading');

  try {
    const apiKey = window.ITS_API_KEY || '';
    const base = 'https://openapi.its.go.kr:9443/cctvInfo';
    const params = `apiKey=${apiKey}&type=json&minX=${minX}&maxX=${maxX}&minY=${minY}&maxY=${maxY}&getType=json`;

    // 국가도로(1), 지방도(2), 도시부도로(3) 동시 조회
    const results = await Promise.allSettled(
      [1, 2, 3].map(cctvType =>
        fetch(`${base}?${params}&cctvType=${cctvType}`)
          .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      )
    );

    const list = results.flatMap(r =>
      r.status === 'fulfilled' ? (r.value?.response?.data ?? r.value?.data ?? []) : []
    );

    const sorted = list
      .filter(c => c.coordx && c.coordy)
      .map(c => ({
        ...c,
        distance: haversine(lat, lng, parseFloat(c.coordy), parseFloat(c.coordx)),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, currentCount);

    renderCCTVs(sorted);
    renderMapMarkers(sorted);
    updateSectionHeader(sorted.length, lat, lng);
    setUIState('results');

    document.querySelector('.cctv-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    console.error('[CCTV Fetch]', err);
    showError(err.message || 'CCTV 데이터를 불러오는 데 실패했습니다.');
    setUIState('error');
  } finally {
    isSearching = false;
  }
}

// ── UI 상태 전환 ──────────────────────────────────────────────────────────
function setUIState(state) {
  const loading = document.getElementById('loadingSpinner');
  const grid = document.getElementById('cctvGrid');
  const placeholder = document.getElementById('placeholder');
  const errorMsg = document.getElementById('errorMsg');
  const header = document.getElementById('sectionHeader');

  loading.classList.add('hidden');
  placeholder.classList.add('hidden');
  errorMsg.classList.add('hidden');

  if (state === 'loading') {
    loading.classList.remove('hidden');
    grid.innerHTML = '';
    header.classList.add('hidden');
  } else if (state === 'results') {
    header.classList.remove('hidden');
  } else if (state === 'error') {
    errorMsg.classList.remove('hidden');
    header.classList.add('hidden');
    grid.innerHTML = '';
  }
}

function showError(msg) {
  document.getElementById('errorText').textContent = msg;
}

// ── 섹션 헤더 업데이트 (역지오코딩 - Nominatim) ───────────────────────────
async function updateSectionHeader(count, lat, lng) {
  document.getElementById('cctvCountBadge').textContent = `${count}개`;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ko`
    );
    const data = await res.json();
    const addr = data?.address
      ? [data.address.city || data.address.county, data.address.suburb || data.address.neighbourhood, data.address.road].filter(Boolean).join(' ')
      : '';
    document.getElementById('locationLabel').textContent = addr ? `📍 ${addr}` : `📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    document.getElementById('locationLabel').textContent = `📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

// ── CCTV 카드 렌더링 ──────────────────────────────────────────────────────
function renderCCTVs(list) {
  const grid = document.getElementById('cctvGrid');
  grid.innerHTML = '';

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="no-results">
        이 지역에서 CCTV를 찾을 수 없습니다.<br>
        다른 위치를 클릭하거나 지도를 이동해 보세요.
      </div>`;
    return;
  }

  const typeLabels = { '1': '국가도로', '2': '지방도', '3': '도시부도로' };

  list.forEach((cctv, i) => {
    const dist = formatDist(cctv.distance);
    const typeLabel = typeLabels[cctv.cctvtype] || '기타';
    const hasStream = !!cctv.cctvurl;

    const card = document.createElement('div');
    card.className = 'cctv-card';
    card.dataset.index = i;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    card.innerHTML = `
      <div class="card-preview">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M15 10l4.553-2.069A1 1 0 0121 8.847v6.306a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
        </svg>
        <span class="card-number">#${i + 1}</span>
        ${hasStream ? '<span class="card-stream-badge">LIVE</span>' : ''}
      </div>
      <div class="card-body">
        <div class="card-name" title="${cctv.cctvname || ''}">${cctv.cctvname || '이름 없음'}</div>
        <div class="card-meta">
          <span class="card-distance">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 00-8 8c0 5.4 7 13 8 13s8-7.6 8-13a8 8 0 00-8-8z"/>
            </svg>
            ${dist}
          </span>
          <span class="card-type type-${cctv.cctvtype || '1'}">${typeLabel}</span>
        </div>
        ${hasStream
          ? `<a href="${cctv.cctvurl}" target="_blank" rel="noopener noreferrer" class="card-btn" onclick="event.stopPropagation()">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
               스트리밍 보기
             </a>`
          : `<span class="card-btn disabled">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/></svg>
               스트리밍 없음
             </span>`
        }
      </div>`;

    const clickHandler = () => {
      if (!map) return;
      map.setView([parseFloat(cctv.coordy), parseFloat(cctv.coordx)], 16);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.querySelectorAll('.cctv-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    };
    card.addEventListener('click', clickHandler);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') clickHandler(); });

    grid.appendChild(card);
  });
}

// ── 지도 위 CCTV 마커 ─────────────────────────────────────────────────────
function renderMapMarkers(list) {
  cctvMarkers.forEach(m => map.removeLayer(m));
  cctvMarkers = [];

  list.forEach((cctv, i) => {
    const lat = parseFloat(cctv.coordy);
    const lng = parseFloat(cctv.coordx);
    if (isNaN(lat) || isNaN(lng)) return;

    const icon = L.divIcon({
      className: '',
      html: `<div class="cctv-marker">#${i + 1} 📹</div>`,
      iconAnchor: [24, 36],
    });

    const marker = L.marker([lat, lng], { icon }).addTo(map);

    marker.on('click', () => {
      const card = document.querySelector(`.cctv-card[data-index="${i}"]`);
      if (card) {
        document.querySelectorAll('.cctv-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    cctvMarkers.push(marker);
  });
}

// ── 유틸 ──────────────────────────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(km) {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

// ── 시작 ──────────────────────────────────────────────────────────────────
initMap();
