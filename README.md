# CCTV Finder

카카오 지도와 ITS 국가교통정보센터 Open API를 활용한 위치 기반 도로 CCTV 탐색기.

## 기능

- 장소·주소 검색으로 지도 이동
- 지도 클릭 → 반경 내 가까운 CCTV 자동 조회·거리순 정렬
- 우측 상단 드롭다운으로 표시 개수 선택 (8 / 12 / 16 / 20개, 기본 12)
- 국가도로·지방도·도시부도로 CCTV 통합 검색
- CCTV 카드 클릭 시 지도에서 해당 위치로 이동
- 반응형 레이아웃 (4 → 3 → 2 → 1열)

## API 키 설정

### 1. 카카오 지도 API 키

1. [Kakao Developers](https://developers.kakao.com) 접속 → 앱 생성
2. **플랫폼 > Web** 에 배포할 도메인 등록 (예: `https://your-app.vercel.app`, `http://localhost`)
3. **앱 키 > JavaScript 키** 복사
4. `index.html` 상단의 값 교체:
   ```html
   <script>window.KAKAO_APP_KEY = '여기에_발급받은_키_입력';</script>
   ```

### 2. ITS CCTV API 키

1. [국가교통정보센터 Open API](https://openapi.its.go.kr) 회원가입
2. **API 신청 > 도로 CCTV 정보** 신청 및 승인
3. Vercel 대시보드 > **Settings > Environment Variables** 에 추가:
   - Key: `ITS_API_KEY`
   - Value: 발급받은 키

## 로컬 개발

```bash
# Vercel CLI 설치 (최초 1회)
npm i -g vercel

# 의존성 없음, 바로 실행
vercel dev
```

`.env` 파일을 만들어 ITS_API_KEY를 설정하거나, `vercel dev` 실행 시 입력합니다.

## GitHub → Vercel 배포

```bash
# 1. 로컬 저장소 초기화
cd cctv-finder
git init
git add .
git commit -m "Initial commit: CCTV Finder"

# 2. GitHub 원격 저장소 연결 (GitHub에서 먼저 저장소 생성)
git remote add origin https://github.com/<사용자명>/cctv-finder.git
git branch -M main
git push -u origin main
```

GitHub에 push하면 Vercel 자동 배포가 트리거됩니다.  
Vercel 대시보드에서 `ITS_API_KEY` 환경변수 설정 후 **Redeploy** 하면 완료.

## 기술 스택

| 항목 | 내용 |
|------|------|
| 프론트엔드 | 순수 HTML / CSS / JavaScript (의존성 없음) |
| 지도 | [Kakao Map JavaScript SDK](https://apis.map.kakao.com) |
| CCTV 데이터 | [ITS Korea Open API](https://openapi.its.go.kr) |
| 백엔드 | Vercel Serverless Function (Node 20) |
| 배포 | Vercel (GitHub 연동 자동 배포) |

## 라이선스

MIT
