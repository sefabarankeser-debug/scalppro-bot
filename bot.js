<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>L/S Pro Radar & Likidasyon Terminali</title>
  
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="theme-color" content="#0c0f17">
  
  <!-- TradingView Hafif Grafik Kütüphanesi -->
  <script src="https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js"></script>
  
  <style>
    :root {
      --bg: #0c0f17;
      --card-bg: #141923;
      --border: #1f2637;
      --green: #26a69a;
      --red: #ef5350;
      --yellow: #f0b90b;
      --blue: #2962ff;
      --purple: #ab47bc;
      --muted: #788292;
      --text: #d1d4dc;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      height: 100vh;
      height: 100dvh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      padding-top: env(safe-area-inset-top, 0px);
    }

    /* Üst Bar */
    header {
      background: #11151f;
      padding: 6px 10px;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .logo { font-size: 13px; font-weight: bold; color: var(--yellow); white-space: nowrap; }
    .search-input {
      flex: 1;
      background: #181f2c;
      border: 1px solid var(--border);
      color: #fff;
      padding: 5px 9px;
      border-radius: 6px;
      font-size: 12px;
      outline: none;
    }
    .search-input:focus { border-color: var(--yellow); }
    .price-box {
      font-size: 11px;
      font-weight: bold;
      color: var(--green);
      background: #090c12;
      padding: 4px 7px;
      border-radius: 4px;
      border: 1px solid var(--border);
      white-space: nowrap;
    }

    /* Grafik Kontrolleri */
    .chart-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 10px;
      background: #0f131c;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .active-coin-tag { font-size: 12px; font-weight: bold; color: var(--yellow); }
    .tf-buttons { display: flex; gap: 4px; }
    .tf-btn {
      background: #161b26;
      border: 1px solid var(--border);
      color: var(--muted);
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: bold;
      cursor: pointer;
    }
    .tf-btn.active { background: var(--blue); color: #fff; border-color: var(--blue); }

    /* Grafikler */
    #main-chart { width: 100%; height: 185px; background: var(--bg); flex-shrink: 0; }
    #osc-chart { width: 100%; height: 75px; background: #080a0f; border-top: 1px solid #161b26; flex-shrink: 0; }

    /* 6'lı Bilgi ve Likidasyon Şeridi */
    .indicator-strip {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 3px;
      padding: 4px 6px;
      background: #0f131c;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
      font-size: 9px;
    }
    .stat-box { background: var(--card-bg); padding: 3px 4px; border-radius: 4px; border: 1px solid var(--border); text-align: center; }
    .stat-lbl { color: var(--muted); font-size: 8px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .stat-val { font-weight: bold; margin-top: 1px; color: #fff; font-size: 10px; }

    /* L/S Listesi ve Sıralama */
    .scanner-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #090c12;
    }
    .scanner-tabs {
      display: flex;
      background: #11151f;
      border-bottom: 1px solid var(--border);
      overflow-x: auto;
      scrollbar-width: none;
      flex-shrink: 0;
    }
    .scanner-tabs::-webkit-scrollbar { display: none; }
    .tab-btn {
      flex: 0 0 auto;
      padding: 7px 11px;
      border: none;
      background: transparent;
      color: var(--muted);
      font-weight: bold;
      font-size: 11px;
      cursor: pointer;
      white-space: nowrap;
    }
    .tab-btn.active { color: var(--yellow); border-bottom: 2px solid var(--yellow); background: rgba(240, 185, 11, 0.08); }

    .scanner-sub {
      padding: 4px 8px;
      background: #0b0e14;
      font-size: 10px;
      color: var(--muted);
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .sort-group { display: flex; gap: 4px; }
    .sort-btn {
      background: #181f2c;
      color: var(--muted);
      border: 1px solid var(--border);
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 9px;
      cursor: pointer;
      font-weight: bold;
    }
    .sort-btn.active { background: var(--yellow); color: #000; border-color: var(--yellow); }

    .scanner-list {
      flex: 1;
      overflow-y: auto;
      padding: 6px;
      padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));
      display: flex;
      flex-direction: column;
      gap: 5px;
      -webkit-overflow-scrolling: touch;
    }

    /* Coin Kartı */
    .coin-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 7px 9px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      transition: background 0.1s;
    }
    .coin-card:active { background: #1c2331; }
    .coin-card.active-card { border-color: var(--yellow); background: #18202d; }

    .coin-left { display: flex; flex-direction: column; gap: 2px; min-width: 115px; }
    .coin-sym { font-size: 13px; font-weight: bold; color: #fff; display: flex; align-items: center; gap: 4px; }
    .coin-price-row { font-size: 10px; font-weight: 500; display: flex; align-items: center; gap: 4px; }
    .badge-pnl-up { color: var(--green); }
    .badge-pnl-down { color: var(--red); }
    .tag-row { display: flex; gap: 3px; align-items: center; margin-top: 1px; flex-wrap: wrap; }
    .tag-fund { font-size: 8px; padding: 1px 3px; border-radius: 2px; background: #1a202c; color: var(--muted); }
    .tag-oi { font-size: 8px; padding: 1px 3px; border-radius: 2px; background: #1c2838; color: #64b5f6; }
    .tag-liq-dst { font-size: 8px; padding: 1px 3px; border-radius: 2px; background: rgba(171, 71, 188, 0.2); color: #ce93d8; border: 1px solid #ba68c8; font-weight: bold; }
    .tag-squeeze { font-size: 8px; padding: 1px 3px; border-radius: 2px; font-weight: bold; animation: pulse 1.2s infinite; }
    .squeeze-l { background: rgba(239, 83, 80, 0.25); color: #ff8a80; border: 1px solid var(--red); }
    .squeeze-s { background: rgba(38, 166, 154, 0.25); color: #b9f6ca; border: 1px solid var(--green); }

    @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }

    .coin-center { flex: 1; margin: 0 10px; display: flex; flex-direction: column; gap: 3px; }
    .ratio-labels { display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; }
    .l-txt { color: var(--green); }
    .s-txt { color: var(--red); }
    .bar-bg { height: 6px; background: var(--red); border-radius: 3px; overflow: hidden; display: flex; }
    .bar-fill { background: var(--green); height: 100%; transition: width 0.3s; }

    .coin-right { display: flex; align-items: center; gap: 6px; }
    .ratio-badge { font-size: 12px; font-weight: bold; min-width: 44px; text-align: right; }
    .trade-btn {
      background: rgba(240, 185, 11, 0.12);
      color: var(--yellow);
      border: 1px solid var(--yellow);
      padding: 4px 6px;
      border-radius: 4px;
      font-size: 10px;
      text-decoration: none;
      font-weight: bold;
    }

    .loading-txt { text-align: center; color: var(--muted); padding: 20px; font-size: 11px; }
  </style>
</head>
<body>

  <header>
    <div class="logo">⚖️ L/S Pro & Liq</div>
    <input type="text" id="searchInput" class="search-input" placeholder="🔍 Coin ara (BTC, SOL, DYM)..." oninput="handleSearch(this.value)">
    <div class="price-box" id="btc-price">BTC: $--.--</div>
  </header>

  <div class="chart-controls">
    <span class="active-coin-tag" id="chartSymbol">BTCUSDT</span>
    <div class="tf-buttons">
      <button class="tf-btn" onclick="setTimeframe('15m', this)">15d</button>
      <button class="tf-btn active" onclick="setTimeframe('1h', this)">1s</button>
      <button class="tf-btn" onclick="setTimeframe('4h', this)">4s</button>
      <button class="tf-btn" onclick="setTimeframe('1d', this)">1G</button>
    </div>
  </div>

  <div id="main-chart"></div>
  <div id="osc-chart"></div>

  <!-- 6'lı Bilgi Şeridi: Fiyat, Supertrend, Kanal ve Canlı Likidasyon Seviyeleri -->
  <div class="indicator-strip">
    <div class="stat-box">
      <div class="stat-lbl">FİYAT</div>
      <div class="stat-val" id="pDisplay">--</div>
    </div>
    <div class="stat-box">
      <div class="stat-lbl">SUPERTREND</div>
      <div class="stat-val" id="sBadge" style="color:var(--green);">--</div>
    </div>
    <div class="stat-box">
      <div class="stat-lbl">KANAL DİRENÇ</div>
      <div class="stat-val" id="uRes" style="color:var(--red);">--</div>
    </div>
    <div class="stat-box">
      <div class="stat-lbl">KANAL DESTEK</div>
      <div class="stat-val" id="lSup" style="color:var(--green);">--</div>
    </div>
    <div class="stat-box">
      <div class="stat-lbl">🎯 LONG LİQ (25x)</div>
      <div class="stat-val" id="liqLong" style="color:#ff8a80;">--</div>
    </div>
    <div class="stat-box">
      <div class="stat-lbl">🎯 SHORT LİQ (25x)</div>
      <div class="stat-val" id="liqShort" style="color:#80d8ff;">--</div>
    </div>
  </div>

  <div class="scanner-section">
    <div class="scanner-tabs">
      <button class="tab-btn active" onclick="selectCategory('ALL', this)">Tümü (54)</button>
      <button class="tab-btn" onclick="selectCategory('Bitcoin & Lider', this)">Bitcoin (1)</button>
      <button class="tab-btn" onclick="selectCategory('Katman 1 & Ekosistem', this)">Katman 1 (15)</button>
      <button class="tab-btn" onclick="selectCategory('Yapay Zeka (AI) & Veri', this)">AI (6)</button>
      <button class="tab-btn" onclick="selectCategory('Meme Tokenlar', this)">Meme (7)</button>
      <button class="tab-btn" onclick="selectCategory('DeFi & Oracle', this)">DeFi (12)</button>
      <button class="tab-btn" onclick="selectCategory('Oyun & Metaverse', this)">Oyun (4)</button>
      <button class="tab-btn" onclick="selectCategory('Diğer Popüler Altcoinler', this)">Diğer (9)</button>
    </div>

    <div class="scanner-sub">
      <div class="sort-group">
        <button class="sort-btn active" id="sort-default" onclick="changeSort('default', this)">Varsayılan</button>
        <button class="sort-btn" id="sort-long" onclick="changeSort('long', this)">🔥 En Çok Long</button>
        <button class="sort-btn" id="sort-short" onclick="changeSort('short', this)">🧊 En Çok Short</button>
      </div>
      <span id="update-timer" style="color:var(--yellow);">Yenileniyor...</span>
    </div>

    <div class="scanner-list" id="coin-list">
      <div class="loading-txt">Piyasa verileri alınıyor...</div>
    </div>
  </div>

  <script>
    const COIN_GROUPS = {
      "Bitcoin & Lider": ["BTC"],
      "Katman 1 & Ekosistem": ["SOL", "AVAX", "NEAR", "SUI", "APT", "SEI", "TIA", "STRK", "ARB", "OP", "FTM", "ALGO", "ATOM", "ETC", "LTC", "BCH"],
      "Yapay Zeka (AI) & Veri": ["TAO", "FET", "RENDER", "ARKM", "AR", "FIL"],
      "Meme Tokenlar": ["DOGE", "1000PEPE", "1000SHIB", "WIF", "1000FLOKI", "1000BONK", "NEIRO"],
      "DeFi & Oracle": ["LINK", "PYTH", "AAVE", "UNI", "CRV", "PENDLE", "GMX", "DYDX", "LDO", "ENA", "JUP", "JTO", "RUNE"],
      "Oyun & Metaverse": ["GALA", "SAND", "MANA", "THETA"],
      "Diğer Popüler Altcoinler": ["INJ", "STX", "ORDI", "WLD", "CFX", "NOT", "DYM", "ZRO", "W"]
    };

    let activeSymbol = 'BTCUSDT';
    let activeInterval = '1h';
    let currentCategory = 'ALL';
    let currentSort = 'default';
    let searchQuery = '';
    
    let ratioCache = {};
    let tickerCache = {};
    let fundingCache = {};
    let oiCache = {};

    let mChart, oChart, cSeries, stGreenSeries, stRedSeries, uSeries, lSeries, kSeries, dSeries;
    let liqLongSeries, liqShortSeries; // Grafik üzerindeki Liq seviye çizgileri

    function initCharts() {
      const chartOptions = {
        layout: { background: { color: '#0c0f17' }, textColor: '#848e9c', fontSize: 10 },
        grid: { vertLines: { color: '#141822' }, horzLines: { color: '#141822' } },
        crosshair: { mode: 1 },
        timeScale: { visible: false }
      };

      mChart = LightweightCharts.createChart(document.getElementById('main-chart'), chartOptions);

      cSeries = mChart.addCandlestickSeries({
        upColor: '#26a69a', downColor: '#ef5350', borderVisible: false,
        wickUpColor: '#26a69a', wickDownColor: '#ef5350'
      });

      stGreenSeries = mChart.addLineSeries({ color: '#26a69a', lineWidth: 2, lineType: 2 });
      stRedSeries = mChart.addLineSeries({ color: '#ef5350', lineWidth: 2, lineType: 2 });
      uSeries = mChart.addLineSeries({ color: '#f0b90b', lineWidth: 1.5 });
      lSeries = mChart.addLineSeries({ color: '#f0b90b', lineWidth: 1.5 });

      // Dinamik Likidasyon Çizgileri (Grafik üzerinde kesik çizgiler)
      liqLongSeries = mChart.addLineSeries({ color: '#ff5252', lineWidth: 1, lineStyle: 2 }); // Long Liq hedefi
      liqShortSeries = mChart.addLineSeries({ color: '#40c4ff', lineWidth: 1, lineStyle: 2 }); // Short Liq hedefi

      oChart = LightweightCharts.createChart(document.getElementById('osc-chart'), {
        layout: { background: { color: '#080a0f' }, textColor: '#6b7485', fontSize: 9 },
        grid: { vertLines: { color: '#10141d' }, horzLines: { color: '#10141d' } },
        priceScale: { autoScale: false, scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { borderColor: '#1f2535', timeVisible: true }
      });

      // Stoch RSI Kılavuz Çizgileri (80 ve 20)
      oChart.addLineSeries({ color: 'rgba(239, 83, 80, 0.4)', lineWidth: 1, lineStyle: 2 }).setData([
        { time: 0, value: 80 }, { time: 9999999999, value: 80 }
      ]);
      oChart.addLineSeries({ color: 'rgba(38, 166, 154, 0.4)', lineWidth: 1, lineStyle: 2 }).setData([
        { time: 0, value: 20 }, { time: 9999999999, value: 20 }
      ]);

      kSeries = oChart.addLineSeries({ color: '#2962ff', lineWidth: 1.5 });
      dSeries = oChart.addLineSeries({ color: '#ff6d00', lineWidth: 1.5 });

      mChart.timeScale().subscribeVisibleLogicalRangeChange(r => {
        if (r && oChart) oChart.timeScale().setVisibleLogicalRange(r);
      });
      oChart.timeScale().subscribeVisibleLogicalRangeChange(r => {
        if (r && mChart) mChart.timeScale().setVisibleLogicalRange(r);
      });

      window.addEventListener('resize', () => {
        if (mChart) mChart.applyOptions({ width: document.getElementById('main-chart').clientWidth });
        if (oChart) oChart.applyOptions({ width: document.getElementById('osc-chart').clientWidth });
      });
    }

    function computeSuperTrend(candles, period = 10, mult = 3.0) {
      let atr = [], upperBand = [], lowerBand = [];
      for (let i = 0; i < candles.length; i++) {
        if (i === 0) {
          atr.push(candles[i].high - candles[i].low);
        } else {
          let tr = Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i-1].close), Math.abs(candles[i].low - candles[i-1].close));
          atr.push((atr[i-1] * (period - 1) + tr) / period);
        }
        let hl2 = (candles[i].high + candles[i].low) / 2;
        upperBand.push(hl2 + mult * atr[i]);
        lowerBand.push(hl2 - mult * atr[i]);
      }

      let inUpTrend = true;
      let finalUpper = [...upperBand], finalLower = [...lowerBand];
      let greenData = [], redData = [], markers = [];

      for (let i = 1; i < candles.length; i++) {
        if (lowerBand[i] > finalLower[i-1] || candles[i-1].close < finalLower[i-1]) finalLower[i] = lowerBand[i];
        else finalLower[i] = finalLower[i-1];

        if (upperBand[i] < finalUpper[i-1] || candles[i-1].close > finalUpper[i-1]) finalUpper[i] = upperBand[i];
        else finalUpper[i] = finalUpper[i-1];

        let prevTrend = inUpTrend;
        if (inUpTrend && candles[i].close < finalLower[i]) inUpTrend = false;
        else if (!inUpTrend && candles[i].close > finalUpper[i]) inUpTrend = true;

        if (inUpTrend) {
          greenData.push({ time: candles[i].time, value: finalLower[i] });
          if (!prevTrend) markers.push({ time: candles[i].time, position: 'belowBar', color: '#26a69a', shape: 'arrowUp', text: 'AL' });
        } else {
          redData.push({ time: candles[i].time, value: finalUpper[i] });
          if (prevTrend) markers.push({ time: candles[i].time, position: 'aboveBar', color: '#ef5350', shape: 'arrowDown', text: 'SAT' });
        }
      }
      return { greenData, redData, inUpTrend, markers };
    }

    function computeDynamicChannel(candles) {
      const n = candles.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      for (let i = 0; i < n; i++) {
        const p = candles[i].close;
        sumX += i; sumY += p; sumXY += i * p; sumXX += i * i;
      }
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      let maxAbove = 0, maxBelow = 0;
      for (let i = 0; i < n; i++) {
        const reg = intercept + slope * i;
        maxAbove = Math.max(maxAbove, candles[i].high - reg);
        maxBelow = Math.max(maxBelow, reg - candles[i].low);
      }

      let uL = [], lL = [];
      for (let i = 0; i < n; i++) {
        const t = candles[i].time;
        const reg = intercept + slope * i;
        uL.push({ time: t, value: reg + maxAbove });
        lL.push({ time: t, value: reg - maxBelow });
      }
      return { uL, lL };
    }

    function computeStochRSI(candles) {
      let rsiLen = 14, kArr = [], dArr = [];
      for (let i = rsiLen; i < candles.length; i++) {
        let slice = candles.slice(i - rsiLen, i + 1).map(c => c.close);
        let max = Math.max(...slice), min = Math.min(...slice);
        let stoch = max === min ? 50 : Math.min(100, Math.max(0, ((candles[i].close - min) / (max - min)) * 100));
        kArr.push({ time: candles[i].time, value: stoch });
      }
      for (let i = 2; i < kArr.length; i++) {
        let avg = (kArr[i].value + kArr[i-1].value + kArr[i-2].value) / 3;
        dArr.push({ time: kArr[i].time, value: avg });
      }
      return { kArr, dArr };
    }

    async function loadChartData() {
      try {
        document.getElementById('chartSymbol').innerText = activeSymbol;
        const res = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${activeSymbol}&interval=${activeInterval}&limit=90`);
        const data = await res.json();
        const candles = data.map(d => ({ time: d[0]/1000, open: +d[1], high: +d[2], low: +d[3], close: +d[4] }));
        
        const last = candles[candles.length - 1];
        const dec = last.close < 0.05 ? 5 : (last.close < 1 ? 4 : 2);

        cSeries.applyOptions({ priceFormat: { type: 'price', precision: dec, minMove: 1 / Math.pow(10, dec) } });
        cSeries.setData(candles);

        document.getElementById('pDisplay').innerText = '$' + last.close.toFixed(dec);

        // Supertrend
        const st = computeSuperTrend(candles);
        stGreenSeries.setData(st.greenData);
        stRedSeries.setData(st.redData);
        cSeries.setMarkers(st.markers);
        
        const sb = document.getElementById('sBadge');
        sb.innerText = st.inUpTrend ? '🟢 AL' : '🔴 SAT';
        sb.style.color = st.inUpTrend ? 'var(--green)' : 'var(--red)';

        // Kanal
        const ch = computeDynamicChannel(candles);
        uSeries.setData(ch.uL);
        lSeries.setData(ch.lL);
        document.getElementById('uRes').innerText = '$' + ch.uL[ch.uL.length - 1].value.toFixed(dec);
        document.getElementById('lSup').innerText = '$' + ch.lL[ch.lL.length - 1].value.toFixed(dec);

        // Likidasyon Seviyeleri Modeli (25x ortalama kaldıraç varsayımı: ~%3.85 marj mesafesi)
        const curPrice = last.close;
        const lLiqVal = curPrice * (1 - 0.0385);
        const sLiqVal = curPrice * (1 + 0.0385);

        document.getElementById('liqLong').innerText = '$' + lLiqVal.toFixed(dec);
        document.getElementById('liqShort').innerText = '$' + sLiqVal.toFixed(dec);

        // Son 20 mum boyunca yatay seviye çizgisi çiz
        const recentCandles = candles.slice(-20);
        liqLongSeries.setData(recentCandles.map(c => ({ time: c.time, value: lLiqVal })));
        liqShortSeries.setData(recentCandles.map(c => ({ time: c.time, value: sLiqVal })));

        // Stoch RSI
        const { kArr, dArr } = computeStochRSI(candles);
        kSeries.setData(kArr);
        dSeries.setData(dArr);

        mChart.timeScale().fitContent();
        oChart.timeScale().fitContent();
      } catch (e) {
        console.error("Grafik yükleme hatası:", e);
      }
    }

    function setCoin(sym) {
      activeSymbol = sym.endsWith('USDT') ? sym : sym + 'USDT';
      document.getElementById('searchInput').value = '';
      searchQuery = '';
      loadChartData();
      renderList();
    }

    function setTimeframe(tf, btn) {
      activeInterval = tf;
      document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadChartData();
    }

    function selectCategory(cat, btn) {
      currentCategory = cat;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderList();
    }

    function changeSort(sort, btn) {
      currentSort = sort;
      document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderList();
    }

    function handleSearch(val) {
      searchQuery = val.trim().toUpperCase();
      renderList();
    }

    async function initBtcPrice() {
      try {
        const res = await fetch('https://fapi.binance.com/fapi/v1/ticker/price?symbol=BTCUSDT');
        const d = await res.json();
        if (d && d.price) {
          document.getElementById('btc-price').innerText = `BTC: $${parseFloat(d.price).toFixed(1)}`;
        }
      } catch(e) {}

      try {
        const btcWs = new WebSocket('wss://fstream.binance.com/ws/btcusdt@ticker');
        btcWs.onmessage = (event) => {
          const data = JSON.parse(event.data);
          document.getElementById('btc-price').innerText = `BTC: $${parseFloat(data.c).toFixed(1)}`;
        };
      } catch(e) {}
    }

    async function fetchLSRatio(symbol) {
      try {
        const res = await fetch(`https://fapi.binance.com/futures/data/topLongShortAccountRatio?symbol=${symbol}&period=5m&limit=1`);
        const data = await res.json();
        if (data && data.length > 0) {
          const longPct = Math.round(parseFloat(data[0].longAccount) * 100);
          const shortPct = Math.round(parseFloat(data[0].shortAccount) * 100);
          const ratio = parseFloat(data[0].longShortRatio).toFixed(2);
          return { longPct, shortPct, ratio };
        }
      } catch (e) {}
      return { longPct: 50, shortPct: 50, ratio: "1.00" };
    }

    async function fetchOpenInterest(symbol) {
      try {
        const res = await fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`);
        const data = await res.json();
        if (data && data.openInterest) {
          return parseFloat(data.openInterest);
        }
      } catch (e) {}
      return 0;
    }

    function getAllCoinsFlat() {
      let list = [];
      for (const [category, coins] of Object.entries(COIN_GROUPS)) {
        coins.forEach(coin => list.push({ coin, category }));
      }
      return list;
    }

    async function refreshData() {
      document.getElementById('update-timer').innerText = "Veriler çekiliyor...";
      
      // 1. Ticker Verileri
      try {
        const tRes = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr');
        const tData = await tRes.json();
        tData.forEach(item => {
          tickerCache[item.symbol] = {
            price: parseFloat(item.lastPrice),
            change24h: parseFloat(item.priceChangePercent)
          };
        });
      } catch (e) {}

      // 2. Fonlama Oranları
      try {
        const fRes = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex');
        const fData = await fRes.json();
        fData.forEach(item => {
          fundingCache[item.symbol] = (parseFloat(item.lastFundingRate) * 100).toFixed(3);
        });
      } catch(e) {}

      // 3. Long/Short ve OI
      const coins = getAllCoinsFlat();
      const chunkSize = 8;
      for (let i = 0; i < coins.length; i += chunkSize) {
        const chunk = coins.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async item => {
          const binanceSymbol = item.coin + "USDT";
          const [ls, oi] = await Promise.all([
            fetchLSRatio(binanceSymbol),
            fetchOpenInterest(binanceSymbol)
          ]);
          ratioCache[item.coin] = ls;
          oiCache[item.coin] = oi;
        }));
      }

      document.getElementById('update-timer').innerText = `Son Güncelleme: ${new Date().toLocaleTimeString('tr-TR')}`;
      renderList();
    }

    function renderList() {
      const listEl = document.getElementById('coin-list');
      listEl.innerHTML = '';

      let coins = getAllCoinsFlat();

      if (currentCategory !== 'ALL') {
        coins = coins.filter(c => c.category === currentCategory);
      }

      if (searchQuery) {
        coins = coins.filter(c => c.coin.toUpperCase().includes(searchQuery));
      }

      if (currentSort === 'long') {
        coins.sort((a, b) => {
          const rA = ratioCache[a.coin] ? ratioCache[a.coin].longPct : 50;
          const rB = ratioCache[b.coin] ? ratioCache[b.coin].longPct : 50;
          return rB - rA;
        });
      } else if (currentSort === 'short') {
        coins.sort((a, b) => {
          const rA = ratioCache[a.coin] ? ratioCache[a.coin].shortPct : 50;
          const rB = ratioCache[b.coin] ? ratioCache[b.coin].shortPct : 50;
          return rB - rA;
        });
      }

      if (coins.length === 0) {
        listEl.innerHTML = `<div class="loading-txt">Eşleşen coin bulunamadı.</div>`;
        return;
      }

      coins.forEach(item => {
        const data = ratioCache[item.coin] || { longPct: 50, shortPct: 50, ratio: "1.00" };
        const fullSymbol = item.coin + "USDT";
        const ticker = tickerCache[fullSymbol] || { price: 0, change24h: 0 };
        const funding = fundingCache[fullSymbol] || "0.000";
        const rawOI = oiCache[item.coin] || 0;

        const isCurrent = activeSymbol === fullSymbol;
        const ratioColor = parseFloat(data.ratio) >= 1 ? 'var(--green)' : 'var(--red)';

        // Fiyat Formatı
        const priceDec = ticker.price < 0.05 ? 5 : (ticker.price < 1 ? 4 : 2);
        const priceStr = ticker.price === 0 ? '--' : '$' + ticker.price.toFixed(priceDec);
        const changeStr = ticker.change24h >= 0 ? `+${ticker.change24h.toFixed(1)}%` : `${ticker.change24h.toFixed(1)}%`;
        const changeClass = ticker.change24h >= 0 ? 'badge-pnl-up' : 'badge-pnl-down';

        // Açık Faiz
        const oiValUSD = rawOI * ticker.price;
        let oiStr = '--';
        if (oiValUSD >= 1000000) oiStr = `$${(oiValUSD / 1000000).toFixed(1)}M`;
        else if (oiValUSD > 0) oiStr = `$${(oiValUSD / 1000).toFixed(0)}K`;

        // En Yakın Liq Mesafesi Hesaplayıcı
        // Eğer Long %65+ ise piyasa Long patlatmaya meyillidir (aşağı Liq mesafesi)
        // Değilse yukarı Liq mesafesi hedeflenir
        const isLongHeavy = data.longPct >= 50;
        const targetLiqDst = isLongHeavy ? "-%3.8" : "+%3.8";

        // Squeeze Riski
        let riskBadge = '';
        if (data.longPct >= 72) riskBadge = `<span class="tag-squeeze squeeze-l">⚠️ L-Squeeze</span>`;
        else if (data.shortPct >= 72) riskBadge = `<span class="tag-squeeze squeeze-s">⚠️ S-Squeeze</span>`;

        const card = document.createElement('div');
        card.className = `coin-card ${isCurrent ? 'active-card' : ''}`;
        card.onclick = () => setCoin(item.coin);

        card.innerHTML = `
          <div class="coin-left">
            <div class="coin-sym">${item.coin}</div>
            <div class="coin-price-row">
              <span>${priceStr}</span>
              <span class="${changeClass}">(${changeStr})</span>
            </div>
            <div class="tag-row">
              <span class="tag-fund">F: ${funding}%</span>
              <span class="tag-oi">OI: ${oiStr}</span>
              <span class="tag-liq-dst">Liq: ${targetLiqDst}</span>
              ${riskBadge}
            </div>
          </div>

          <div class="coin-center">
            <div class="ratio-labels">
              <span class="l-txt">Long %${data.longPct}</span>
              <span class="s-txt">Short %${data.shortPct}</span>
            </div>
            <div class="bar-bg">
              <div class="bar-fill" style="width: ${data.longPct}%;"></div>
            </div>
          </div>

          <div class="coin-right">
            <span class="ratio-badge" style="color: ${ratioColor};">${data.ratio}x</span>
            <a href="https://www.binance.com/tr/futures/${item.coin}USDT" target="_blank" class="trade-btn" onclick="event.stopPropagation()">Al/Sat 🔗</a>
          </div>
        `;

        listEl.appendChild(card);
      });
    }

    document.getElementById('searchInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const val = e.target.value.trim().toUpperCase();
        if (val) setCoin(val);
      }
    });

    window.onload = () => {
      initCharts();
      loadChartData();
      initBtcPrice();
      refreshData();
      setInterval(refreshData, 30000);
      setInterval(initBtcPrice, 10000);
    };
  </script>
</body>
</html>
