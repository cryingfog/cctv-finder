'use strict';

// ── State ──────────────────────────────────────────────────────────────────
let map = null;
let clickMarker = null;
let cctvOverlays = [];
let currentCount = 12;
let lastLatLng = null;
let isSearching = false;

// ── Kakao Map 동적 로드 ────────────────────────────────────────────────────
(function loadKakaoSDK() {
  if (!window.KAKAO_APP_KEY || window.KAKAO_APP_KEY === 'YOUR_KAKAO_APP_KEY_HERE') {
    showMapError('카카오 지도 API 키가 설정되지 않았습니다.<br>index.html의 KAKAO_APP_KEY 값을 교체해 주세요.');
    return;
  }
  const s = document.createElement('script');
  s.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${window.KAKAO_APP_KEY}&libraries=services&autoload=false`;
  s.onload = () => kakao.maps.load(initMap);
  s.onerror = () => showMapError('카카오 지도 SDK를 불러오지 못했습니다. API 키를 확인해 주세요.');
  document.head.appendChild(s);
})();

function showMapError(msg) {
  const overlay = document.getElementById('mapOverlay');
  if (overlay) {
    overlay.innerHTML = `<div class="map-overlay-content" style="color:#f87171;text-align:center;padding:20px;line-height:1.7">${msg}</div>`;
  }
}

// ── 지도 초기화 ────────────────────────────────────────────────────────────
function initMap() {
  const container = document.getElementById('map');
  map = new kakao.maps.Map(container, {
    center: new kakao.maps.LatLng(37.5665, 126.9780),
    level: 7,
  });

  // 지도 로드 완료 → 오버레이 제거
  document.getElementById('mapOverlay').classList.add('hidden');

  // 지도 클릭 이벤트
  kakao.maps.event.addListener(map, 'click', function (e) {
    const latlng = e.latLng;
    placeClickMarker(latlng);
    lastLatLng = latlng;
    fetchCCTVs(latlng.getLat(), latlng.getLng());
  });
}

// ── 클릭 마커 ─────────────────────────────────────────────────────────────
function placeClickMarker(latlng) {
  if (clickMarker) clickMarker.setMap(null);

  const imgSrc = 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png';
  const imgSize = new kakao.maps.Size(24, 35);
  const markerImage = new kakao.maps.MarkerImage(imgSrc, imgSize);

  clickMarker = new kakao.maps.Marker({
    position: latlng,
    image: markerImage,
    map,
    zIndex: 10,
  });
}

// ── 주소 검색 ─────────────────────────────────────────────────────────────
function searchLocation() {
  const keyword = document.getElementById('searchInput').value.trim();
  if (!keyword || !map) return;

  const btn = document.getElementById('searchBtn');
  btn.textContent = '검색 중...';
  btn.disabled = true;

  const geocoder = new kakao.maps.services.Geocoder();
  geocoder.addressSearch(keyword, function (result, status) {
    if (status === kakao.maps.services.Status.OK) {
      moveTo(result[0].y, result[0].x, 6);
      resetBtn();
    } else {
      const ps = new kakao.maps.services.Places();
      ps.keywordSearch(keyword, function (data, status2) {
        resetBtn();
        if (status2 === kakao.maps.services.Status.OK) {
          moveTo(data[0].y, data[0].x, 6);
        } else {
          alert(`"${keyword}" 검색 결과를 찾을 수 없습니다.`);
        }
      });
    }
  });

  function resetBtn() {
    btn.textContent = '검색';
    btn.disabled = false;
  }
}

function moveTo(lat, lng, level) {
  const coords = new kakao.maps.LatLng(lat, lng);
  map.setCenter(coords);
  map.setLevel(level);
}

// ── 엔터키 검색 ───────────────────────────────────────────────────────────
document.getElementById('searchInput').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') searchLocation();
});

// ── CCTV 개수 변경 ────────────────────────────────────────────────────────
document.getElementById('cctvCount').addEventListener('change', function () {
  currentCount = parseInt(this.value, 10);
  if (lastLatLng) {
    fetchCCTVs(lastLatLng.getLat(), lastLatLng.getLng());
  }
});

// ── CCTV 데이터 조회 ──────────────────────────────────────────────────────
async function fetchCCTVs(lat, lng) {
  if (isSearching) return;
  isSearching = true;

  const delta = 0.12; // 약 12~13km 반경
  const minX = (lng - delta).toFixed(6);
  const maxX = (lng + delta).toFixed(6);
  const minY = (lat - delta).toFixed(6);
  const maxY = (lat + delta).toFixed(6);

  setUIState('loading');

  try {
    const res = await fetch(
      `/api/cctv?minX=${minX}&maxX=${maxX}&minY=${minY}&maxY=${maxY}`
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `서버 오류 (${res.status})`);
    }

    const data = await res.json();
    const list = data?.response?.data || data?.data || [];

    // 거리 계산 후 정렬
    const sorted = list
      .filter(c => c.coordx && c.coordy)
      .map(c => ({
        ...c,
        distance: haversine(lat, lng, parseFloat(c.coordy), parseFloat(c.coordx)),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, currentCount);

    renderCCTVs(sorted, lat, lng);
    renderMapMarkers(sorted);
    updateSectionHeader(sorted.length, lat, lng);
    setUIState('results');

    // 결과 영역으로 부드럽게 스크롤
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

// ── 섹션 헤더 업데이트 ────────────────────────────────────────────────────
function updateSectionHeader(count, lat, lng) {
  document.getElementById('cctvCountBadge').textContent = `${count}개`;

  const geocoder = new kakao.maps.services.Geocoder();
  geocoder.coord2Address(lng, lat, function (result, status) {
    const label = document.getElementById('locationLabel');
    if (status === kakao.maps.services.Status.OK && result[0]) {
      const addr = result[0].road_address?.address_name || result[0].address?.address_name || '';
      label.textContent = addr ? `📍 ${addr}` : '';
    } else {
      label.textContent = `📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  });
}

// ── CCTV 카드 렌더링 ──────────────────────────────────────────────────────
function renderCCTVs(list, clickLat, clickLng) {
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
    card.setAttribute('aria-label', `${cctv.cctvname || '이름 없음'}, ${dist} 거리`);

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
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                 <polygon points="5 3 19 12 5 21 5 3"/>
               </svg>
               스트리밍 보기
             </a>`
          : `<span class="card-btn disabled">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                 <line x1="1" y1="1" x2="23" y2="23"/>
                 <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23"/>
               </svg>
               스트리밍 없음
             </span>`
        }
      </div>`;

    // 카드 클릭 → 지도 해당 위치로 이동
    const clickHandler = () => {
      if (!map) return;
      const pos = new kakao.maps.LatLng(parseFloat(cctv.coordy), parseFloat(cctv.coordx));
      map.setCenter(pos);
      map.setLevel(5);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // 활성 카드 강조
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
  cctvOverlays.forEach(o => o.setMap(null));
  cctvOverlays = [];

  list.forEach((cctv, i) => {
    const lat = parseFloat(cctv.coordy);
    const lng = parseFloat(cctv.coordx);
    if (isNaN(lat) || isNaN(lng)) return;

    const content = `
      <div style="
        background:#2563eb;color:#fff;padding:4px 9px;border-radius:6px;
        font-size:11px;font-weight:700;white-space:nowrap;
        box-shadow:0 2px 8px rgba(0,0,0,0.5);cursor:pointer;
        border:1px solid rgba(255,255,255,0.2);
      ">#${i + 1} 📹</div>`;

    const overlay = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(lat, lng),
      content,
      map,
      yAnchor: 1.3,
      zIndex: 5,
    });

    // 마커 클릭 → 카드 강조
    overlay.getContent().addEventListener?.('click', () => {
      const card = document.querySelector(`.cctv-card[data-index="${i}"]`);
      if (card) {
        document.querySelectorAll('.cctv-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    cctvOverlays.push(overlay);
  });
}

// ── 유틸 ──────────────────────────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(km) {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}
