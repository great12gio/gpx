/**
 * Cloudflare Worker: GPX Analyzer Pro v9.0
 * - Feature: Added Satellite Map Mode (Esri World Imagery).
 * - UI: Added Map Style Toggle Button (Standard / Satellite).
 * - Core: Based on v8.0 (Interactive Chart, Stable Rendering).
 */

const BANNER_POOL = [
  {
    link: 'https://link.coupang.com/a/dCrdiR', 
    text: '⌚️ 페이스/고도 측정의 필수품',
    sub: '가민(Garmin) GPS 워치 최저가 확인하기'
  },
  {
    link: 'https://link.coupang.com/a/dyj430', 
    text: '⚡️ 장거리 산행/러닝 에너지 보급',
    sub: '에너지젤 로켓배송'
  },
  {
    link: 'https://link.coupang.com/a/dCreW3', 
    text: '🦵 하산할 때 무릎이 걱정된다면?',
    sub: '잠스트 무릎 보호대'
  },
  {
    link: 'https://link.coupang.com/a/dCrhi0', 
    text: '🎒 트레일러닝 조끼/배낭 모음',
    sub: '살로몬/카멜백 베스트셀러 구경하기'
  }
];

export default {
  async fetch(request) {
    const requestUrl = new URL(request.url);
    const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
    const randomBanner = BANNER_POOL[Math.floor(Math.random() * BANNER_POOL.length)];

    const html = `
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>GPX 코스 분석기 | GIOS</title>
        <meta name="description" content="오르막은 빨강, 내리막은 파랑! GPX 경로를 경사도에 따라 색상별로 분석하고 3D 지도로 확인하세요.">
        <link rel="canonical" href="${baseUrl}">
        
        <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
        <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <script src="https://html2canvas.hertzen.com/dist/html2canvas.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/@turf/turf@6/turf.min.js"></script>

        <style>
          :root { --primary: #059669; --bg: #f0fdf4; --text: #064e3b; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 20px; }
          .container { max-width: 1000px; margin: 0 auto; }
          
          header { text-align: center; margin-bottom: 30px; }
          h1 { margin: 0; font-size: 1.8rem; color: #166534; }
          .subtitle { color: #15803d; font-size: 0.9rem; margin-top: 5px; }

          /* Upload Box */
          .upload-label { 
            display: block; 
            background: white; 
            padding: 40px; 
            border-radius: 16px; 
            border: 2px dashed #34d399; 
            text-align: center; 
            cursor: pointer; 
            transition: all 0.2s; 
            margin-bottom: 20px; 
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); 
          }
          .upload-label:hover { background: #ecfdf5; border-color: var(--primary); transform: translateY(-2px); }
          
          .upload-icon { font-size: 3.5rem; margin-bottom: 15px; }
          .upload-text { display: inline-block; background: var(--primary); color: white; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 1rem; }
          .upload-sub { color: #64748b; font-size: 0.9rem; margin-top: 15px; }

          .dashboard { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px; display: none; }
          .stat-card { background: white; padding: 15px; border-radius: 12px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
          .stat-label { font-size: 0.75rem; color: #64748b; display: block; margin-bottom: 4px; font-weight: 600; text-transform: uppercase; }
          .stat-value { font-size: 1.3rem; font-weight: 800; color: #0f172a; }
          .stat-unit { font-size: 0.8rem; font-weight: normal; color: #94a3b8; margin-left: 2px; }
          
          .badge { padding: 4px 8px; border-radius: 6px; font-size: 0.9rem; font-weight: bold; display: inline-block; width: 100%; box-sizing: border-box; }
          .diff-easy { background: #dcfce7; color: #166534; }
          .diff-mid { background: #fef9c3; color: #854d0e; }
          .diff-hard { background: #fee2e2; color: #991b1b; }

          /* Map Container */
          #map { height: 500px; width: 100%; border-radius: 16px; margin-bottom: 20px; display: none; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 4px solid white; background-color: #e2e8f0; position: relative; }
          
          /* [추가] 지도 스타일 전환 버튼 */
          .map-style-control {
            position: absolute; top: 15px; left: 15px; z-index: 10;
            background: white; padding: 4px; border-radius: 8px;
            display: flex; gap: 4px; box-shadow: 0 2px 6px rgba(0,0,0,0.15);
            display: none; /* 초기엔 숨김 */
          }
          .style-btn {
            padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: bold; color: #64748b; transition: all 0.2s;
          }
          .style-btn:hover { background: #f1f5f9; }
          .style-btn.active { background: #059669; color: white; }

          .chart-container { background: white; padding: 20px; border-radius: 16px; height: 300px; display: none; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }

          .map-legend { position: absolute; bottom: 30px; left: 15px; background: rgba(255,255,255,0.9); padding: 10px; border-radius: 8px; font-size: 0.8rem; display: none; z-index: 10; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
          .legend-item { display: flex; align-items: center; margin-bottom: 4px; }
          .color-box { width: 12px; height: 12px; border-radius: 3px; margin-right: 6px; }

          #shareCard { 
            background: linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%); 
            padding: 30px; border-radius: 20px; width: 450px; 
            position: absolute; top: -9999px; left: -9999px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1); font-family: sans-serif; text-align: center;
          }
          .share-title { font-size: 1.4rem; font-weight: 900; margin-bottom: 20px; color: #064e3b; letter-spacing: -0.5px; }
          .share-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
          .share-item { background: white; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0; text-align: center; }
          .share-val { font-size: 1.3rem; font-weight: 800; color: #059669; }
          .share-lbl { font-size: 0.65rem; color: #64748b; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 2px; }
          .share-footer { font-size: 0.75rem; color: #cbd5e1; margin-top: 15px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-weight: 600; display:flex; justify-content: space-between; }

          .btn-group { display: flex; gap: 10px; justify-content: center; display: none; flex-wrap: wrap; }
          .action-btn { background: #3b82f6; color: white; padding: 12px 24px; border-radius: 30px; font-weight: bold; cursor: pointer; border: none; font-size: 0.95rem; transition: transform 0.1s; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.2); }
          .action-btn:active { transform: scale(0.98); }
          .action-btn.share { background: #8b5cf6; box-shadow: 0 4px 6px rgba(139, 92, 246, 0.2); }
          .action-btn.reset { background: #64748b; box-shadow: none; }

          .ad-banner { display: block; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; text-decoration: none; padding: 15px; border-radius: 12px; text-align: center; margin-bottom: 20px; transition: transform 0.2s; }
          .ad-banner:hover { transform: translateY(-2px); }

          .map-overlay { font-size: 0.8rem; background: rgba(255,255,255,0.9); padding: 6px 12px; border-radius: 20px; position: absolute; z-index: 10; display:none; font-weight:600; box-shadow: 0 2px 4px rgba(0,0,0,0.1); color:#333; }

          .footer-disclaimer { margin-top: 40px; margin-bottom: 20px; text-align: center; font-size: 0.8rem; color: #94a3b8; }
        </style>
      </head>
      <body>

        <div class="container">
          <header>
            <h1>⛰️ GPX 코스 분석기</h1>
            <p class="subtitle">오르막(빨강)과 내리막(파랑)을 3D 지도로 한눈에</p>
          </header>

          <a href="${randomBanner.link}" target="_blank" class="ad-banner">
            ${randomBanner.text}<br>
            <span style="font-size:0.85rem; opacity:0.8;">${randomBanner.sub}</span>
          </a>

          <label class="upload-label" id="uploadBox">
            <div class="upload-icon">📂</div>
            <div class="upload-text">GPX 파일 선택하기</div>
            <p class="upload-sub">러닝, 등산, 라이딩 로그 파일 (.gpx)</p>
            <input type="file" id="gpxInput" accept=".gpx" style="display:none" onchange="handleFile(this.files[0])">
          </label>

          <div class="dashboard" id="dashboard">
            <div class="stat-card">
              <span class="stat-label">총 거리</span>
              <span class="stat-value" id="valDist">-</span><span class="stat-unit">km</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">이동 시간</span>
              <span class="stat-value" id="valTime">-</span><span class="stat-unit"></span>
            </div>
            <div class="stat-card">
              <span class="stat-label">평균 페이스</span>
              <span class="stat-value" id="valPace">-</span><span class="stat-unit">/km</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">최고 페이스</span>
              <span class="stat-value" id="valBestPace">-</span><span class="stat-unit">/km</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">획득 고도</span>
              <span class="stat-value" id="valGain">-</span><span class="stat-unit">m</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">최고 높이</span>
              <span class="stat-value" id="valMax">-</span><span class="stat-unit">m</span>
            </div>
          </div>
          
          <div id="diffBadgeArea" style="display:none; text-align:center; margin-bottom:20px;">
             <span id="valBadge" style="width:auto; padding:5px 20px;"></span>
          </div>

          <div style="position:relative;">
             <div id="map"></div>
             <div id="mapStyleBox" class="map-style-control">
                <div class="style-btn active" id="btnStandard" onclick="setMapStyle('standard')">일반</div>
                <div class="style-btn" id="btnSatellite" onclick="setMapStyle('satellite')">위성</div>
             </div>
             
             <div id="mapMsg" class="map-overlay" style="top:15px; right:15px;">🖱️ 차트 위에 마우스를 올려보세요!</div>
             <div id="mapLegend" class="map-legend">
                <div class="legend-item"><div class="color-box" style="background:#ef4444;"></div>오르막 (Uphill)</div>
                <div class="legend-item"><div class="color-box" style="background:#22c55e;"></div>평지 (Flat)</div>
                <div class="legend-item"><div class="color-box" style="background:#3b82f6;"></div>내리막 (Downhill)</div>
             </div>
          </div>
          
          <div class="chart-container" id="chartBox">
            <canvas id="elevationChart"></canvas>
          </div>

          <div class="btn-group" id="btnGroup">
            <button class="action-btn share" onclick="downloadImage()">📸 이미지 저장</button>
            <button class="action-btn reset" onclick="location.reload()">🔄 다른 파일 분석</button>
          </div>

          <footer class="footer-disclaimer">
            이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
          </footer>
        </div>

        <div id="shareCard">
          <div class="share-title">🏁 COURSE PROFILE</div>
          <div class="share-grid">
            <div class="share-item">
              <div class="share-lbl">총 거리</div>
              <div class="share-val" id="shareDist">0km</div>
            </div>
            <div class="share-item">
              <div class="share-lbl">이동시간</div>
              <div class="share-val" id="shareTime">00:00</div>
            </div>
            <div class="share-item">
              <div class="share-lbl">평균 페이스</div>
              <div class="share-val" id="sharePace">0'00"</div>
            </div>
            <div class="share-item">
              <div class="share-lbl">최고 페이스</div>
              <div class="share-val" id="shareBestPace">0'00"</div>
            </div>
            <div class="share-item">
              <div class="share-lbl">획득고도</div>
              <div class="share-val" id="shareGain">0m</div>
            </div>
            <div class="share-item">
              <div class="share-lbl">최고높이</div>
              <div class="share-val" id="shareMax">0m</div>
            </div>
          </div>
          <div style="text-align:center; margin-bottom:15px;">
            <span id="shareBadge" style="font-size:1.2rem; font-weight:bold; display:inline-block; width:100%;"></span>
          </div>
          <div style="height:140px; width:100%; margin-bottom:5px;">
             <canvas id="shareChart"></canvas>
          </div>
          <div class="share-footer">
            <span>나의 운동 기록</span>
            <span>gpx.gios.blog</span>
          </div>
        </div>

        <script>
          let map = null;
          let chart = null;
          let isAnalyzing = false;

          window.addEventListener("dragover", e => e.preventDefault());
          window.addEventListener("drop", e => e.preventDefault());

          function handleFile(file) {
            if (!file || isAnalyzing) return;
            isAnalyzing = true;

            const reader = new FileReader();
            reader.onload = function(e) { 
              try {
                parseGPX(e.target.result); 
              } catch(err) {
                alert('파일 분석 중 오류가 발생했습니다.');
                console.error(err);
                isAnalyzing = false;
              }
            };
            reader.readAsText(file);
          }

          function parseGPX(xmlStr) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlStr, "text/xml");
            const trkpts = xmlDoc.getElementsByTagName("trkpt");

            let points = [];
            let totalDist = 0;
            let gain = 0;
            let maxEle = -9999;
            let minEle = 9999;
            let startTime = null, endTime = null;
            let movingTimeSec = 0;

            if (trkpts.length === 0) { 
                alert('유효한 경로 데이터가 없습니다.'); 
                isAnalyzing = false;
                return; 
            }

            for (let i = 0; i < trkpts.length; i++) {
              const lat = parseFloat(trkpts[i].getAttribute("lat"));
              const lon = parseFloat(trkpts[i].getAttribute("lon"));
              const eleStr = trkpts[i].getElementsByTagName("ele")[0]?.textContent;
              const ele = eleStr ? parseFloat(eleStr) : 0;
              const timeStr = trkpts[i].getElementsByTagName("time")[0]?.textContent;
              const time = timeStr ? new Date(timeStr).getTime() : null;

              if (i === 0) startTime = time;
              endTime = time;
              if (ele > maxEle) maxEle = ele;
              if (ele < minEle) minEle = ele;

              let dist = 0;
              let speedKmh = 0;

              if (i > 0 && points.length > 0) {
                const prev = points[points.length - 1]; 
                
                const from = turf.point([prev.lon, prev.lat]);
                const to = turf.point([lon, lat]);
                dist = turf.distance(from, to, {units: 'kilometers'}); 
                
                if (dist > 0.001) {
                    totalDist += dist;
                    const eleDiff = ele - prev.ele;
                    if (eleDiff > 0) gain += eleDiff;

                    if (time && prev.time) {
                      const timeDiffSec = (time - prev.time) / 1000;
                      if (timeDiffSec > 0) {
                         speedKmh = (dist / (timeDiffSec / 3600));
                         if (speedKmh > 1.0 && timeDiffSec < 300) movingTimeSec += timeDiffSec;
                      }
                    }
                    points.push({ lat, lon, ele, time, cumDist: totalDist, speed: speedKmh });
                }
              } else {
                  points.push({ lat, lon, ele, time, cumDist: 0, speed: 0 });
              }
            }

            const distKm = totalDist.toFixed(2);
            const gainM = Math.round(gain);
            const maxM = Math.round(maxEle);
            
            let finalTimeSec = movingTimeSec > 0 ? movingTimeSec : (endTime && startTime ? (endTime - startTime)/1000 : 0);
            const hours = Math.floor(finalTimeSec / 3600);
            const mins = Math.floor((finalTimeSec % 3600) / 60);
            const timeStr = \`\${hours > 0 ? hours + 'h ' : ''}\${mins}m\`;
            
            let avgPaceSec = 0;
            if (totalDist > 0) avgPaceSec = finalTimeSec / totalDist;
            const avgPaceStr = formatPace(avgPaceSec);

            const validSpeeds = points.filter(p => p.speed > 0 && p.speed < 45); 
            let bestPaceStr = "-";
            if (validSpeeds.length > 5) {
               validSpeeds.sort((a,b) => b.speed - a.speed);
               const bestSpeed = validSpeeds[Math.floor(validSpeeds.length * 0.05)].speed; 
               if(bestSpeed > 0) bestPaceStr = formatPace(3600 / bestSpeed);
            }

            document.getElementById('uploadBox').style.display = 'none';
            document.getElementById('dashboard').style.display = 'grid';
            
            const mapEl = document.getElementById('map');
            mapEl.style.display = 'block'; 
            void mapEl.offsetWidth; 

            document.getElementById('mapStyleBox').style.display = 'flex'; // 버튼 보이기
            document.getElementById('mapLegend').style.display = 'block';
            document.getElementById('mapMsg').style.display = 'block';
            document.getElementById('chartBox').style.display = 'block';
            document.getElementById('btnGroup').style.display = 'flex';
            document.getElementById('diffBadgeArea').style.display = 'block';

            document.getElementById('valDist').innerText = distKm;
            document.getElementById('valGain').innerText = gainM;
            document.getElementById('valMax').innerText = maxM;
            document.getElementById('valTime').innerText = timeStr;
            document.getElementById('valPace').innerText = avgPaceStr;
            document.getElementById('valBestPace').innerText = bestPaceStr;

            let diffClass = ''; let diffText = '';
            const ratio = gainM / totalDist;
            if (ratio < 15) { diffClass = 'diff-easy'; diffText = 'EASY (Flat)'; }
            else if (ratio < 40) { diffClass = 'diff-mid'; diffText = 'MODERATE'; }
            else { diffClass = 'diff-hard'; diffText = 'HARD (Hilly)'; }
            document.getElementById('valBadge').innerHTML = \`<span class="badge \${diffClass}">\${diffText}</span>\`;

            document.getElementById('shareDist').innerText = distKm + 'km';
            document.getElementById('shareTime').innerText = timeStr;
            document.getElementById('sharePace').innerText = avgPaceStr;
            document.getElementById('shareBestPace').innerText = bestPaceStr;
            document.getElementById('shareGain').innerText = gainM + 'm';
            document.getElementById('shareMax').innerText = maxM + 'm';
            const sBadge = document.getElementById('shareBadge');
            sBadge.innerText = diffText;
            sBadge.className = diffClass;
            sBadge.style.padding = "5px 10px";
            sBadge.style.borderRadius = "8px";

            setTimeout(() => {
                createAndRenderMap(points);
            }, 100);

            drawChart(points, 'elevationChart', false, maxEle, minEle);
            drawChart(points, 'shareChart', true, maxEle, minEle);
          }

          function formatPace(secondsPerKm) {
            if (!secondsPerKm || secondsPerKm === Infinity || isNaN(secondsPerKm)) return "-";
            const pMin = Math.floor(secondsPerKm / 60);
            const pSec = Math.floor(secondsPerKm % 60);
            return \`\${pMin}'\${pSec.toString().padStart(2, '0')}"\`;
          }

          function createAndRenderMap(points) {
            if (map) { map.remove(); map = null; }

            const center = [points[Math.floor(points.length / 2)].lon, points[Math.floor(points.length / 2)].lat];
            
            const features = [];
            if (points.length > 1) {
                let currentCoords = [[points[0].lon, points[0].lat]];
                let currentColor = '#22c55e'; 

                for(let i=1; i<points.length; i++) {
                    const prev = points[i-1];
                    const curr = points[i];
                    
                    const dist = turf.distance([prev.lon, prev.lat], [curr.lon, curr.lat], {units:'kilometers'}) * 1000;
                    if (dist <= 0) continue;

                    const eleDiff = curr.ele - prev.ele;
                    const slope = (eleDiff / dist) * 100;

                    let newColor = '#22c55e'; 
                    if (slope > 3.5) newColor = '#ef4444'; 
                    else if (slope < -3.5) newColor = '#3b82f6'; 

                    if (newColor === currentColor) {
                        currentCoords.push([curr.lon, curr.lat]);
                    } else {
                        if (currentCoords.length > 1) {
                            features.push({
                                'type': 'Feature',
                                'properties': { 'color': currentColor },
                                'geometry': { 'type': 'LineString', 'coordinates': [...currentCoords] }
                            });
                        }
                        currentCoords = [[prev.lon, prev.lat], [curr.lon, curr.lat]];
                        currentColor = newColor;
                    }
                }
                if (currentCoords.length > 1) {
                    features.push({
                        'type': 'Feature',
                        'properties': { 'color': currentColor },
                        'geometry': { 'type': 'LineString', 'coordinates': currentCoords }
                    });
                }
            }

            map = new maplibregl.Map({
                container: 'map',
                style: {
                    version: 8,
                    sources: {
                        'osm': {
                            type: 'raster',
                            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                            tileSize: 256,
                            attribution: '&copy; OpenStreetMap'
                        },
                        'satellite': {
                            type: 'raster',
                            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                            tileSize: 256,
                            attribution: '&copy; Esri'
                        }
                    },
                    layers: [
                        // [핵심] 두 개의 레이어를 미리 다 깔아둠 (하나는 숨김 처리)
                        { id: 'osm-layer', type: 'raster', source: 'osm', layout: { visibility: 'visible' } },
                        { id: 'satellite-layer', type: 'raster', source: 'satellite', layout: { visibility: 'none' } }
                    ]
                },
                center: center,
                zoom: 13,
                pitch: 50,
                bearing: 0
            });

            map.on('load', () => {
              map.resize();

              map.addSource('route', {
                'type': 'geojson',
                'data': {
                    'type': 'FeatureCollection',
                    'features': features
                },
                'tolerance': 0, 
                'buffer': 512
              });

              map.addLayer({
                'id': 'route',
                'type': 'line',
                'source': 'route',
                'layout': { 
                    'line-join': 'round', 
                    'line-cap': 'round' 
                },
                'paint': {
                  'line-color': ['get', 'color'], 
                  'line-width': [
                    'interpolate', ['linear'], ['zoom'],
                    5, 3,  
                    15, 6
                  ],
                  'line-opacity': 1.0
                }
              });

              map.addSource('hover-marker', {
                  type: 'geojson',
                  data: { type: 'FeatureCollection', features: [] }
              });
              map.addLayer({
                  id: 'hover-marker-point',
                  type: 'circle',
                  source: 'hover-marker',
                  paint: {
                      'circle-radius': 8,
                      'circle-color': '#FFD700',
                      'circle-stroke-width': 2,
                      'circle-stroke-color': '#FFFFFF'
                  }
              });

              const bounds = new maplibregl.LngLatBounds();
              points.forEach(p => bounds.extend([p.lon, p.lat]));
              map.fitBounds(bounds, { padding: 60, pitch: 50 });
            });
            map.addControl(new maplibregl.NavigationControl());
          }

          // [추가] 지도 스타일 전환 함수
          function setMapStyle(style) {
              if(!map) return;
              
              if(style === 'standard') {
                  map.setLayoutProperty('osm-layer', 'visibility', 'visible');
                  map.setLayoutProperty('satellite-layer', 'visibility', 'none');
                  document.getElementById('btnStandard').classList.add('active');
                  document.getElementById('btnSatellite').classList.remove('active');
              } else {
                  map.setLayoutProperty('osm-layer', 'visibility', 'none');
                  map.setLayoutProperty('satellite-layer', 'visibility', 'visible');
                  document.getElementById('btnStandard').classList.remove('active');
                  document.getElementById('btnSatellite').classList.add('active');
              }
          }

          function drawChart(points, canvasId, isSimple = false, maxEle, minEle) {
            const ctx = document.getElementById(canvasId).getContext('2d');
            const step = Math.ceil(points.length / 400);
            const chartData = points.filter((_, i) => i % step === 0);
            const labels = chartData.map(p => p.cumDist.toFixed(1));
            const data = chartData.map(p => p.ele);

            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, 'rgba(5, 150, 105, 0.8)');
            gradient.addColorStop(1, 'rgba(5, 150, 105, 0.1)');

            if (canvasId === 'elevationChart' && chart) chart.destroy();

            const config = {
              type: 'line',
              data: {
                labels: labels,
                datasets: [{
                  label: '고도 (m)',
                  data: data,
                  borderColor: '#047857',
                  backgroundColor: gradient,
                  borderWidth: isSimple ? 2 : 2,
                  fill: true,
                  pointRadius: 0,
                  tension: 0.3
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false }, 
                    tooltip: { enabled: !isSimple, intersect: false, mode: 'index' } 
                },
                onHover: (e, activeElements) => {
                    if (!isSimple && map && map.getSource('hover-marker')) {
                        if (activeElements && activeElements.length > 0) {
                            const index = activeElements[0].index;
                            const originalIndex = index * step;
                            const pt = points[originalIndex];
                            
                            if (pt) {
                                map.getSource('hover-marker').setData({
                                    type: 'Feature',
                                    geometry: {
                                        type: 'Point',
                                        coordinates: [pt.lon, pt.lat]
                                    }
                                });
                            }
                        } else {
                            map.getSource('hover-marker').setData({
                                type: 'FeatureCollection', features: []
                            });
                        }
                    }
                },
                scales: {
                  x: { display: !isSimple, grid: {display:false} },
                  y: { display: !isSimple, min: Math.floor(minEle * 0.9), grid: { color: '#f1f5f9' } }
                },
                animation: false,
                interaction: {
                  mode: 'nearest',
                  axis: 'x',
                  intersect: false
                }
              }
            };

            const newChart = new Chart(ctx, config);
            if (canvasId === 'elevationChart') chart = newChart;
          }

          function downloadImage() {
            const shareCard = document.getElementById('shareCard');
            html2canvas(shareCard, { scale: 2, useCORS: true }).then(canvas => {
              const link = document.createElement('a');
              link.download = 'gios-gpx-analysis.png';
              link.href = canvas.toDataURL();
              link.click();
            });
          }
        </script>
      </body>
      </html>
    `;

    return new Response(html, {
      headers: { 'content-type': 'text/html;charset=UTF-8' },
    });
  },
};
