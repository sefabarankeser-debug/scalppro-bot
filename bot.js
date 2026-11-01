process.on('uncaughtException', (err) => {
    console.error('Kritik Hata Yakalandi:', err.message);
});

process.on('unhandledRejection', (reason) => {
    console.error('Promise Hatasi:', reason);
});

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ==========================================
// 1. RENDER PORT & SABİT TELEGRAM BİLGİLERİ
// ==========================================
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ScalpPro V-Tipi Dip Dönüşlü VIP Ultimate (87 Coins) Active\n');
}).listen(PORT, '0.0.0.0', () => {
    console.log(`Sunucu ${PORT} portunda dinlemede.`);
});

const TELEGRAM_TOKEN = "8930276912:AAE4xogVFRIqIjPuJ97RqHJFuHvFexNxt2k";
const CHAT_ID = "-1004412694884";

const MAX_TOTAL_ACTIVE_TRADES = 15;
const MAX_SAME_SIDE_TRADES = 10;

// ==========================================
// 2. ADAPTİF PROFİLLER VE SEÇİCİ SEPET (87 PARİTE + GENİŞLETİLMİŞ DİP/TEPE EŞİKLERİ)
// ==========================================
const BASE_PROFILES = {
    MAJOR: { category: "💎 Majör / Trend Sadık", stochLong: 32, stochShort: 68, atrMultiplier: 1.4, maxLsRatio: 68 },
    MEME: { category: "🐸 Meme / Ekstrem Volatilite", stochLong: 35, stochShort: 65, atrMultiplier: 2.0, maxLsRatio: 64 },
    VOLATILE_ALT: { category: "⚡ Sığ Tahta / Yüksek Oynaklık", stochLong: 35, stochShort: 65, atrMultiplier: 1.8, maxLsRatio: 62 }
};

const COIN_ASSIGNMENTS = {
    "BTCUSDT": "MAJOR", "ETHUSDT": "MAJOR", "SOLUSDT": "MAJOR", "AVAXUSDT": "MAJOR", 
    "NEARUSDT": "MAJOR", "LINKUSDT": "MAJOR", "UNIUSDT": "MAJOR", "LTCUSDT": "MAJOR", 
    "BCHUSDT": "MAJOR", "ETCUSDT": "MAJOR", "ATOMUSDT": "MAJOR", "FILUSDT": "MAJOR", 
    "ALGOUSDT": "MAJOR", "XRPUSDT": "MAJOR", "ADAUSDT": "MAJOR", "BNBUSDT": "MAJOR", 
    "ICPUSDT": "MAJOR", "TRXUSDT": "MAJOR", "HYPEUSDT": "MAJOR", "ZECUSDT": "MAJOR",
    
    "DOGEUSDT": "MEME", "1000PEPEUSDT": "MEME", "WIFUSDT": "MEME", "1000SHIBUSDT": "MEME",
    "1000FLOKIUSDT": "MEME", "1000BONKUSDT": "MEME", "NEIROUSDT": "MEME", "NOTUSDT": "MEME",
    "POPCATUSDT": "MEME", "BOMEUSDT": "MEME",
    
    "DYMUSDT": "VOLATILE_ALT", "STRKUSDT": "VOLATILE_ALT", "WLDUSDT": "VOLATILE_ALT",
    "SUIUSDT": "VOLATILE_ALT", "APTUSDT": "VOLATILE_ALT", "TAOUSDT": "VOLATILE_ALT",
    "FETUSDT": "VOLATILE_ALT", "SEIUSDT": "VOLATILE_ALT", "ARKMUSDT": "VOLATILE_ALT",
    "RENDERUSDT": "VOLATILE_ALT", "INJUSDT": "VOLATILE_ALT", "ARBUSDT": "VOLATILE_ALT",
    "OPUSDT": "VOLATILE_ALT", "TIAUSDT": "VOLATILE_ALT", "PENDLEUSDT": "VOLATILE_ALT",
    "GALAUSDT": "VOLATILE_ALT", "STXUSDT": "VOLATILE_ALT", "ORDIUSDT": "VOLATILE_ALT",
    "RUNEUSDT": "VOLATILE_ALT", "AAVEUSDT": "VOLATILE_ALT", "LDOUSDT": "VOLATILE_ALT",
    "JUPUSDT": "VOLATILE_ALT", "ENAUSDT": "VOLATILE_ALT", "ARUSDT": "VOLATILE_ALT",
    "CFXUSDT": "VOLATILE_ALT", "JTOUSDT": "VOLATILE_ALT", "CRVUSDT": "VOLATILE_ALT",
    "DYDXUSDT": "VOLATILE_ALT", "GMXUSDT": "VOLATILE_ALT", "FTMUSDT": "VOLATILE_ALT",
    "SANDUSDT": "VOLATILE_ALT", "MANAUSDT": "VOLATILE_ALT", "THETAUSDT": "VOLATILE_ALT",
    "ZROUSDT": "VOLATILE_ALT", "PYTHUSDT": "VOLATILE_ALT", "WUSDT": "VOLATILE_ALT",
    "POLUSDT": "VOLATILE_ALT", "HBARUSDT": "VOLATILE_ALT", "SANTOSUSDT": "VOLATILE_ALT",
    "OMUSDT": "VOLATILE_ALT", "IMXUSDT": "VOLATILE_ALT", "AXSUSDT": "VOLATILE_ALT",
    "CHZUSDT": "VOLATILE_ALT", "GMTUSDT": "VOLATILE_ALT", "KASUSDT": "VOLATILE_ALT",
    "MANTAUSDT": "VOLATILE_ALT", "ALTUSDT": "VOLATILE_ALT", "NTRNUSDT": "VOLATILE_ALT",
    "PORTALUSDT": "VOLATILE_ALT", "SAGAUSDT": "VOLATILE_ALT", "TNSRUSDT": "VOLATILE_ALT",
    "BBUSDT": "VOLATILE_ALT", "IOUSDT": "VOLATILE_ALT", "ZKUSDT": "VOLATILE_ALT", "REZUSDT": "VOLATILE_ALT"
};

const dynamicCoinMemory = new Map();

function getCoinProfile(symbol) {
    if (!dynamicCoinMemory.has(symbol)) {
        const group = COIN_ASSIGNMENTS[symbol] || "VOLATILE_ALT";
        const base = BASE_PROFILES[group];
        dynamicCoinMemory.set(symbol, { ...base, group, consecutiveStops: 0, totalTps: 0, totalStops: 0, quarantineUntil: 0 });
    }
    return dynamicCoinMemory.get(symbol);
}

function handleTradeResult(symbol, resultType) {
    const prof = getCoinProfile(symbol);
    if (resultType === 'STOP') {
        prof.totalStops++;
        prof.consecutiveStops++;
        prof.stochLong = Math.max(10, prof.stochLong - 3);
        prof.stochShort = Math.min(90, prof.stochShort + 3);
        prof.atrMultiplier = parseFloat((prof.atrMultiplier + 0.15).toFixed(2));
        if (prof.consecutiveStops >= 3) {
            prof.quarantineUntil = Date.now() + (24 * 60 * 60 * 1000);
            sendTelegramMessage(`🛡️ <b>${symbol} 24 Saat Karantinaya Alındı!</b>\nPeş peşe 3 stop nedeniyle parametreler sıkılaştırıldı.`);
        }
    } else if (resultType === 'TP' || resultType === 'TP2') {
        prof.totalTps++; 
        prof.consecutiveStops = 0;
    }
}

// ==========================================
// 3. KALICI KASA SİSTEMİ
// ==========================================
const WALLET_FILE = path.join(__dirname, 'kasa_yedek.json');
let lastUpdateId = 0;
const alertedCoins = new Map();
const activeTrades = new Map();
let tradeHistory = [];
let walletStartTime = Date.now();
let lastStatusReportTime = 0;

function loadWalletState() {
    try {
        if (fs.existsSync(WALLET_FILE)) {
            const raw = fs.readFileSync(WALLET_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.tradeHistory)) tradeHistory = parsed.tradeHistory;
            if (parsed.walletStartTime) walletStartTime = parsed.walletStartTime;
        }
    } catch (e) {}
}

function saveWalletState() {
    try {
        fs.writeFileSync(WALLET_FILE, JSON.stringify({ walletStartTime, tradeHistory }), 'utf8');
    } catch (e) {}
}

function recordTradeEvent(type, symbol = '', customMult = null) {
    tradeHistory.push({ type, symbol, customMult, time: Date.now() });
    saveWalletState();
}

function resetPermanentWallet() {
    tradeHistory = [];
    walletStartTime = Date.now();
    saveWalletState();
}

loadWalletState();

const TARGET_COINS = Object.keys(COIN_ASSIGNMENTS);
const FUZZY_MAP = {
    "DMY": "DYM", "PEP": "PEPE", "SHIBA": "SHIB", "DOG": "DOGE", "FLOK": "FLOKI",
    "BON": "BONK", "LNK": "LINK", "AVX": "AVAX", "NOTC": "NOT", "STR": "STRK", "APTOS": "APT", "POL": "POL", "TRX": "TRX", "HYPE": "HYPE", "ZEC": "ZEC"
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getTurkishTimeString() {
    return new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' });
}

function getTurkishDateTimeString(ts) {
    return new Date(ts).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
}

function formatPrice(val, basePrice) {
    if (!val || isNaN(val)) return "0.00";
    const ref = basePrice || val;
    let decimals = ref < 0.001 ? 7 : ref < 0.1 ? 6 : ref < 1 ? 5 : ref < 10 ? 4 : ref < 1000 ? 2 : 1;
    return Number(val).toFixed(decimals);
}

function getWindowCountsText(hours) {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    const filtered = tradeHistory.filter(t => t.time >= cutoff);
    const tp1Count = filtered.filter(t => t.type === 'TP1' || t.type === 'MANUAL_WIN').length;
    const tp2Count = filtered.filter(t => t.type === 'TP2').length;
    const stopCount = filtered.filter(t => t.type === 'STOP' || t.type === 'MANUAL_LOSS').length;
    const total = tp1Count + tp2Count + stopCount;
    if (total === 0) return `• <b>Son ${hours} Saat:</b> Henüz sonuçlanan işlem yok`;
    const winRate = (((tp1Count + tp2Count) / total) * 100).toFixed(1);
    return `• <b>Son ${hours} Saat:</b> ${tp1Count} TP1 | ${tp2Count} TP2 | ${stopCount} Stop (%${winRate} Win Rate)`;
}

function getStatsText() {
    const tp1Count = tradeHistory.filter(t => t.type === 'TP1' || t.type === 'MANUAL_WIN').length;
    const tp2Count = tradeHistory.filter(t => t.type === 'TP2').length;
    const stopCount = tradeHistory.filter(t => t.type === 'STOP' || t.type === 'MANUAL_LOSS').length;
    const totalTrades = tp1Count + tp2Count + stopCount;

    let simBalance = 1000;
    for (const t of tradeHistory) {
        if (t.customMult && !isNaN(t.customMult)) simBalance *= t.customMult;
        else if (t.type === 'TP1') simBalance *= 1.025;
        else if (t.type === 'TP2') simBalance *= 1.050;
        else if (t.type === 'STOP') simBalance *= 0.980;
    }

    const netGainPct = (((simBalance - 1000) / 1000) * 100).toFixed(2);
    const sign = netGainPct >= 0 ? "+" : "";
    const colorIcon = netGainPct >= 0 ? "🟢" : "🔴";
    const totalWinRate = totalTrades > 0 ? (((tp1Count + tp2Count) / totalTrades) * 100).toFixed(1) : "0.0";

    const text1 = getWindowCountsText(1);
    const text12 = getWindowCountsText(12);

    return `📊 <b>Canlı Başarı & Kalıcı Kasa Simülasyonu:</b>\n${text1}\n${text12}\n• <b>Toplam Genel:</b> ${tp1Count} TP1 | ${tp2Count} TP2 | ${stopCount} Stop (%${totalWinRate} Win Rate)\n  ↳ ${colorIcon} <b>Kalıcı Simüle Kasa ($1000):</b> $${simBalance.toFixed(2)} (<b>${sign}%${netGainPct} PNL</b>)`;
}

function getActiveSessionName() {
    const trHour = (new Date().getUTCHours() + 3) % 24;
    return trHour >= 2 && trHour < 10 ? "🌏 Asya Seansı" : trHour >= 10 && trHour < 16 ? "🇪🇺 Londra Seansı" : "🗽 New York Seansı";
}

// ==========================================
// 4. API MOTORLARI & İNDİKATÖRLER
// ==========================================
function fetchJSON(url, customHeaders = {}) {
    return new Promise((resolve, reject) => {
        const headers = Object.assign({ 'User-Agent': 'Mozilla/5.0' }, customHeaders);
        const req = https.get(url, { headers, timeout: 10000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            });
        });
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        req.on('error', reject);
    });
}

function sendTelegramMessage(text, replyToId = null) {
    return new Promise((resolve) => {
        const payloadObj = { chat_id: CHAT_ID, text: text, parse_mode: 'HTML', disable_web_page_preview: true };
        if (replyToId) payloadObj.reply_to_message_id = replyToId;
        const payload = JSON.stringify(payloadObj);
        
        const req = https.request({
            hostname: 'api.telegram.org', port: 443, path: `/bot${TELEGRAM_TOKEN}/sendMessage`, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
            timeout: 8000
        }, (res) => resolve(res.statusCode === 200));
        
        req.on('timeout', () => { req.destroy(); resolve(false); });
        req.on('error', () => resolve(false));
        
        req.write(payload);
        req.end();
    });
}

async function fetchLongShortRatio(symbol) {
    try {
        const url = `https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=${symbol}&period=1h&limit=1`;
        const json = await fetchJSON(url);
        if (json.retCode === 0 && json.result?.list?.length > 0) {
            const item = json.result.list[0];
            const longPct = Math.round(parseFloat(item.buyRatio) * 100);
            const shortPct = Math.round(parseFloat(item.sellRatio) * 100);
            const bar = '█'.repeat(Math.max(0, Math.round((longPct/100)*20))) + '░'.repeat(Math.max(0, 20-Math.round((longPct/100)*20)));
            let sentiment = longPct >= 68 ? "Aşırı Long Baskısı ⚠️" : shortPct >= 68 ? "Aşırı Short Baskısı ⚠️" : "Dengeli Dağılım";
            return { longPct, shortPct, text: `⚖️ <b>Long / Short Dağılımı:</b>\n[${bar}]\n%${longPct} Long | %${shortPct} Short (${sentiment})` };
        }
    } catch (e) {}
    try {
        const bData = await fetchJSON(`https://fapi.binance.com/futures/data/topLongShortAccountRatio?symbol=${symbol}&period=1h&limit=1`);
        if (Array.isArray(bData) && bData.length > 0) {
            const longPct = Math.round(parseFloat(bData[0].longAccount) * 100);
            const shortPct = Math.round(parseFloat(bData[0].shortAccount) * 100);
            const bar = '█'.repeat(Math.round((longPct/100)*20)) + '░'.repeat(20-Math.round((longPct/100)*20));
            return { longPct, shortPct, text: `⚖️ <b>L/S Dağılımı (Binance):</b>\n[${bar}]\n%${longPct} Long | %${shortPct} Short` };
        }
    } catch (e) {}
    return { longPct: 50, shortPct: 50, text: `⚖️ <b>Long / Short Dağılımı:</b>\n[██████████░░░░░░░░░░]\n%50 Long | %50 Short (Dengeli Dağılım)` };
}

async function fetchFundingRate(symbol) {
    try {
        const url = `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`;
        const json = await fetchJSON(url);
        if (json.retCode === 0 && json.result?.list?.length > 0) {
            const rateRaw = parseFloat(json.result.list[0].fundingRate || "0");
            const ratePct = rateRaw * 100;
            const blockLong = ratePct >= 0.06;
            const blockShort = ratePct <= -0.06;
            let status = blockLong ? "⚠️ Aşırı Pozitif (Long Riskli)" : blockShort ? "⚠️ Aşırı Negatif (Short Riskli)" : "Normal / Sağlıklı ✅";
            return { ratePct, blockLong, blockShort, text: `${ratePct >= 0 ? "+" : ""}%${ratePct.toFixed(4)} (${status})` };
        }
    } catch (e) {}
    try {
        const bData = await fetchJSON(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`);
        if (bData && bData.lastFundingRate !== undefined) {
            const ratePct = parseFloat(bData.lastFundingRate) * 100;
            const blockLong = ratePct >= 0.06;
            const blockShort = ratePct <= -0.06;
            let status = blockLong ? "⚠️ Aşırı Pozitif (Long Riskli)" : blockShort ? "⚠️ Aşırı Negatif (Short Riskli)" : "Normal / Sağlıklı ✅";
            return { ratePct, blockLong, blockShort, text: `${ratePct >= 0 ? "+" : ""}%${ratePct.toFixed(4)} (${status})` };
        }
    } catch (e) {}
    return { ratePct: 0.01, blockLong: false, blockShort: false, text: `+%0.0100 (Normal ✅)` };
}

function analyze15MVolume(klines15m) {
    if (!klines15m || klines15m.length < 22) return { isAlive: true, isSpike: false, ratio: 1.0, badge: "Normal Hacim ✅" };
    const volumes = klines15m.map(k => parseFloat(k[5] || 0));
    const prev20 = volumes.slice(-22, -2);
    const avgVol = prev20.reduce((a, b) => a + b, 0) / prev20.length;
    if (avgVol <= 0) return { isAlive: true, isSpike: false, ratio: 1.0, badge: "Normal Hacim ✅" };

    const curVol = volumes[volumes.length - 1];
    const prevClosedVol = volumes[volumes.length - 2];
    const effectiveVol = Math.max(curVol, prevClosedVol);
    const ratio = effectiveVol / avgVol;

    const isAlive = ratio >= 0.60;
    const isSpike = ratio >= 1.20;
    const badge = isSpike ? `🔥 Yüksek Hacim / Balina Girişi (${ratio.toFixed(1)}x)` : isAlive ? `Canlı Hacim ✅ (${ratio.toFixed(1)}x)` : `⚠️ Cılız / Ölü Hacim (${ratio.toFixed(1)}x)`;

    return { isAlive, isSpike, ratio, badge };
}

function evaluateSignalQuality(side, stoch15m, volData, lsData, fundingData, candleData) {
    let score = 0;
    if (volData.ratio >= 1.15) score++;
    if ((side === 'LONG' && stoch15m.k <= 18) || (side === 'SHORT' && stoch15m.k >= 82)) score++;
    if ((side === 'LONG' && lsData.longPct <= 56) || (side === 'SHORT' && lsData.shortPct <= 56)) score++;
    if ((side === 'LONG' && fundingData.ratePct <= 0.005) || (side === 'SHORT' && fundingData.ratePct >= 0.015)) score++;
    if ((side === 'LONG' && candleData.netGain >= 0.3) || (side === 'SHORT' && candleData.netGain <= -0.3)) score++;

    if (score >= 3) {
        return { stars: "🔥⭐⭐⭐⭐⭐", title: "A+ VIP BALİNA SİNYALİ (Yüksek Güven!)", score };
    } else if (score === 2) {
        return { stars: "⭐⭐⭐⭐", title: "GÜÇLÜ MOMENTUM SİNYALİ", score };
    }
    return { stars: "⭐⭐⭐", title: "STANDART ONAYLI SİNYAL", score };
}

function analyze4HCandles(klines4h) {
    if (!klines4h || klines4h.length < 3) return { reportText: "⚠️ 4H Verisi Yetersiz", netGain: 0, isBearDominance: false, isBullDominance: false };
    const last3 = klines4h.slice(-3);
    const labels = ["Mum 1 (8-12s)", "Mum 2 (4-8s) ", "Mum 3 (Son 4s)"];
    const lines = [];
    let netGain = 0;
    for (let i = 0; i < 3; i++) {
        const open = parseFloat(last3[i][1]), high = parseFloat(last3[i][2]), low = parseFloat(last3[i][3]), close = parseFloat(last3[i][4]);
        const changePct = ((close - open) / open) * 100;
        netGain += changePct;
        const rangePct = Math.abs(((high - low) / open) * 100);
        let barFill = Math.min(8, Math.max(1, Math.round(rangePct * 2)));
        lines.push(` ${labels[i]}: ${changePct >= 0 ? "🟢" : "🔴"} [${'█'.repeat(barFill) + '░'.repeat(8 - barFill)}] ${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}% | Genişlik: %${rangePct.toFixed(1)}`);
    }
    const isBullDominance = netGain >= 3.0;
    const isBearDominance = netGain <= -3.0;
    let netTrendText = isBullDominance ? "🟢 Güçlü Boğa Baskısı (4H)" : isBearDominance ? "🔴 Güçlü Ayı Baskısı (4H)" : "⚪ Yatay / Kararsız Seyir";
    return { reportText: `🕯️ <b>4H Makro Mum Yapısı (Bilgilendirme):</b>\n<pre>${lines.join('\n')}\n ↳ 4H Net Yön: ${netTrendText}</pre>`, netGain, isBullDominance, isBearDominance };
}

function analyze1HMomentum(klines1h) {
    if (!klines1h || klines1h.length < 2) return { isWaterfall: false, isRocket: false, curChange: 0, prevChange: 0 };
    const cur = klines1h[klines1h.length - 1];
    const prev = klines1h[klines1h.length - 2];

    const curOpen = parseFloat(cur[1]), curClose = parseFloat(cur[4]);
    const prevOpen = parseFloat(prev[1]), prevClose = parseFloat(prev[4]);

    const curChange = ((curClose - curOpen) / curOpen) * 100;
    const prevChange = ((prevClose - prevOpen) / prevOpen) * 100;

    const isWaterfall = curChange <= -1.10 || (prevChange <= -1.20 && curChange < 0.20);
    const isRocket = curChange >= 1.10 || (prevChange >= 1.20 && curChange > -0.20);

    return { isWaterfall, isRocket, curChange: curChange.toFixed(2), prevChange: prevChange.toFixed(2) };
}

function calculateRSI(closes, period = 14) {
    if (!Array.isArray(closes) || closes.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        const change = closes[i] - closes[i - 1];
        if (change > 0) gains += change; else losses += Math.abs(change);
    }
    let avgGain = gains / period, avgLoss = losses / period;
    for (let i = period + 1; i < closes.length; i++) {
        const change = closes[i] - closes[i - 1];
        avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
        avgLoss = (avgLoss * (period - 1) + (change < 0 ? Math.abs(change) : 0)) / period;
    }
    if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
    return 100 - (100 / (1 + (avgGain / avgLoss)));
}

function calculateStochRSI(closes, period = 14, kSmooth = 3, dSmooth = 3) {
    if (!Array.isArray(closes) || closes.length < period * 2 + 5) {
        return { k: 50, d: 50, prevK: 50, prevD: 50, bullCross: false, bearCross: false };
    }
    
    const rsiValues = [];
    for (let i = period; i < closes.length; i++) {
        const slice = closes.slice(0, i + 1);
        rsiValues.push(calculateRSI(slice, period));
    }

    const stochValues = [];
    for (let i = period - 1; i < rsiValues.length; i++) {
        const rsiSlice = rsiValues.slice(i - period + 1, i + 1);
        const lowestRsi = Math.min(...rsiSlice);
        const highestRsi = Math.max(...rsiSlice);
        const currentRsi = rsiValues[i];
        
        let stoch = highestRsi === lowestRsi ? 50 : ((currentRsi - lowestRsi) / (highestRsi - lowestRsi)) * 100;
        stochValues.push(stoch);
    }

    const kValues = [];
    for (let i = kSmooth - 1; i < stochValues.length; i++) {
        const slice = stochValues.slice(i - kSmooth + 1, i + 1);
        kValues.push(slice.reduce((a, b) => a + b, 0) / kSmooth);
    }

    const dValues = [];
    for (let i = dSmooth - 1; i < kValues.length; i++) {
        const slice = kValues.slice(i - dSmooth + 1, i + 1);
        dValues.push(slice.reduce((a, b) => a + b, 0) / dSmooth);
    }

    const k = Math.round(kValues[kValues.length - 1] ?? 50);
    const d = Math.round(dValues[dValues.length - 1] ?? 50);
    const prevK = Math.round(kValues[kValues.length - 2] ?? 50);
    const prevD = Math.round(dValues[dValues.length - 2] ?? 50);

    const bullCross = (k > d && k > prevK && (prevK <= prevD + 3 || k - d >= 2));
    const bearCross = (k < d && k < prevK && (prevK >= prevD - 3 || d - k >= 2));

    return { k, d, prevK, prevD, bullCross, bearCross };
}

function calculateEMA(closes, period = 50) {
    if (!Array.isArray(closes) || closes.length < period) return null;
    const k = 2 / (period + 1);
    let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < closes.length; i++) ema = (closes[i] * k) + (ema * (1 - k));
    return ema;
}

function calculateATR(highs, lows, closes, period = 14) {
    if (closes.length < period + 1) return null;
    const trs = [];
    for (let i = 1; i < closes.length; i++) {
        trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
    }
    return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

async function fetchUniversalKlines(symbol, interval, limit) {
    try {
        const url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&limit=${limit}`;
        const json = await fetchJSON(url);
        if (json.retCode === 0 && json.result?.list?.length >= 20) return json.result.list.slice().reverse();
    } catch (e) {}
    try {
        const binanceInt = interval === "15" ? "15m" : (interval === "60" ? "1h" : (interval === "240" ? "4h" : interval));
        const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${binanceInt}&limit=${limit}`;
        const data = await fetchJSON(url);
        if (Array.isArray(data) && data.length >= 20) return data.map(k => [k[0], k[1], k[2], k[3], k[4], k[5]]);
    } catch (e) {}
    return null;
}

async function fetchLivePrice(symbol, fallbackPrice) {
    try {
        const k = await fetchUniversalKlines(symbol, "15", 2);
        if (k && k.length > 0) return parseFloat(k[k.length - 1][4]);
    } catch (e) {}
    return fallbackPrice;
}

async function checkBtcCondition() {
    const list = await fetchUniversalKlines("BTCUSDT", "15", 30);
    if (!list || list.length < 3) return { safe: true, btcTrend: "NEUTRAL", change15m: "0.00", shockDump: false, shockPump: false };
    const currentPrice = parseFloat(list[list.length - 1][4]);
    const openCurrent = parseFloat(list[list.length - 1][1]);
    const openPrev = parseFloat(list[list.length - 2][1]);
    
    const changeCur = ((currentPrice - openCurrent) / openCurrent) * 100;
    const changeTwo = ((currentPrice - openPrev) / openPrev) * 100;
    const worstChange = Math.abs(changeCur) > Math.abs(changeTwo) ? changeCur : changeTwo;

    let btcTrend = "NEUTRAL";
    if (changeCur <= -0.35 || changeTwo <= -0.45) btcTrend = "DUMP";
    else if (changeCur >= 0.35 || changeTwo >= 0.45) btcTrend = "PUMP";

    const shockDump = changeCur <= -0.45 || changeTwo <= -0.60;
    const shockPump = changeCur >= 0.45 || changeTwo >= 0.60;

    return { 
        safe: Math.abs(worstChange) < 1.8, 
        btcTrend, 
        change15m: worstChange.toFixed(2),
        shockDump,
        shockPump
    };
}

// ==========================================
// 5. CANLI TELEGRAM KOMUTLARI
// ==========================================
async function sendOpenTradesReport(replyToId = null) {
    if (activeTrades.size === 0) {
        return sendTelegramMessage(`📂 <b>AÇIK İŞLEMLER RAPORU</b>\n\nŞu anda takip edilen açık işlem bulunmuyor. (Kontenjan: 0/${MAX_TOTAL_ACTIVE_TRADES})`, replyToId);
    }
    let longCount = 0, shortCount = 0;
    for (const t of activeTrades.values()) {
        if (t.side === 'LONG') longCount++; else shortCount++;
    }

    let lines = [`📂 <b>AKTİF AÇIK İŞLEMLER (${activeTrades.size}/${MAX_TOTAL_ACTIVE_TRADES})</b>\n↳ 🟢 Long: ${longCount}/${MAX_SAME_SIDE_TRADES} | 🔴 Short: ${shortCount}/${MAX_SAME_SIDE_TRADES}\n`];

    for (const [sym, t] of activeTrades.entries()) {
        const clean = sym.replace('USDT', '');
        const mins = Math.round((Date.now() - t.time) / 60000);
        const livePrice = await fetchLivePrice(sym, t.lastPrice || t.entry);
        t.lastPrice = livePrice;

        const pnlPct = t.side === 'LONG' 
            ? (((livePrice - t.entry) / t.entry) * 100) 
            : (((t.entry - livePrice) / t.entry) * 100);
        const lev10x = (pnlPct * 10).toFixed(1);
        const pnlSign = pnlPct >= 0 ? "+" : "";
        const pnlIcon = pnlPct >= 0 ? "🟢" : "🔴";

        let targetInfo = "";
        if (!t.tp1Hit) {
            const distTp1 = t.side === 'LONG' 
                ? Math.max(0, ((t.tp1 - livePrice) / livePrice) * 100) 
                : Math.max(0, ((livePrice - t.tp1) / livePrice) * 100);
            targetInfo = `🎯 TP1'e Kalan: %${distTp1.toFixed(2)}`;
        } else {
            const distTp2 = t.side === 'LONG' 
                ? Math.max(0, ((t.tp2 - livePrice) / livePrice) * 100) 
                : Math.max(0, ((livePrice - t.tp2) / livePrice) * 100);
            targetInfo = `🚀 TP2'ye Kalan: %${distTp2.toFixed(2)}`;
        }

        const statusBadge = t.trailingHit 
            ? "🔒 TP1 Kârı Kilitli (Stop=TP1)" 
            : t.tp1Hit 
                ? "✅ TP1 Alındı (Stop=Giriş)" 
                : t.shockProtected 
                    ? "⚡ BTC Kalkanı (Stop=Giriş)" 
                    : "⏳ Hedef Bekleniyor";

        lines.push(`• <b>#${clean}</b> (${t.side === 'LONG' ? '🟢 LONG' : '🔴 SHORT'}) | ${t.stars || '⭐⭐⭐'}\n  ↳ Giriş: $${formatPrice(t.entry, t.entry)} ➔ <b>Anlık: $${formatPrice(livePrice, t.entry)}</b>\n  ↳ ${pnlIcon} <b>Anlık PNL: ${pnlSign}%${pnlPct.toFixed(2)}</b> (10x: <b>${pnlSign}%${lev10x}</b>)\n  ↳ 🛑 Stop: $${formatPrice(t.sl, t.entry)} | ${targetInfo}\n  ↳ Durum: ${statusBadge} (${mins} dk)\n`);
    }
    lines.push(`💡 <i>İstediğiniz işlemi kapatmak için <b>/kapat coinadı</b> veya <b>/kapat hepsi</b> yazabilirsiniz.</i>`);
    await sendTelegramMessage(lines.join('\n'), replyToId);
}

async function closeManualTradeCommand(rawTarget, replyToId = null) {
    if (!rawTarget) {
        return sendTelegramMessage(`⚠️ Lütfen kapatmak istediğiniz coini yazın. Örnek: <b>/kapat zro</b> veya <b>/kapat hepsi</b>`, replyToId);
    }
    const cleanArg = rawTarget.toUpperCase().trim();

    if (cleanArg === 'HEPSI' || cleanArg === 'HEPSİ' || cleanArg === 'TUMU' || cleanArg === 'TÜMÜ' || cleanArg === 'ALL') {
        if (activeTrades.size === 0) return sendTelegramMessage(`ℹ️ Kapatılacak açık işlem bulunmuyor.`, replyToId);
        let closedSummary = [];
        for (const [sym, t] of activeTrades.entries()) {
            const livePrice = await fetchLivePrice(sym, t.lastPrice || t.entry);
            const pnlPct = t.side === 'LONG' ? (((livePrice - t.entry) / t.entry) * 100) : (((t.entry - livePrice) / t.entry) * 100);
            if (!t.tp1Hit) {
                const mult = 1 + (pnlPct / 100);
                recordTradeEvent(pnlPct >= 0 ? 'MANUAL_WIN' : 'MANUAL_LOSS', sym, mult);
            }
            closedSummary.push(`• <b>#${sym.replace('USDT', '')}</b> (${t.side}): ${pnlPct >= 0 ? '+' : ''}%${pnlPct.toFixed(2)}`);
            activeTrades.delete(sym);
        }
        return sendTelegramMessage(`🖐️ <b>TÜM AÇIK İŞLEMLER MANUEL KAPATILDI!</b>\n\n${closedSummary.join('\n')}\n\n${getStatsText()}`, replyToId);
    }

    let sym = cleanArg.replace(/[^A-Z0-9]/g, '');
    if (FUZZY_MAP[sym]) sym = FUZZY_MAP[sym];
    if (!sym.endsWith('USDT')) sym += 'USDT';

    if (!activeTrades.has(sym) && activeTrades.has('1000' + sym)) sym = '1000' + sym;
    if (!activeTrades.has(sym)) {
        return sendTelegramMessage(`⚠️ <b>#${cleanArg}</b> adında açık bir işlem bulunamadı. Açık işlemleri görmek için <b>/acik</b> yazabilirsiniz.`, replyToId);
    }

    const t = activeTrades.get(sym);
    const livePrice = await fetchLivePrice(sym, t.lastPrice || t.entry);
    const pnlPct = t.side === 'LONG' ? (((livePrice - t.entry) / t.entry) * 100) : (((t.entry - livePrice) / t.entry) * 100);
    if (!t.tp1Hit) {
        const mult = 1 + (pnlPct / 100);
        recordTradeEvent(pnlPct >= 0 ? 'MANUAL_WIN' : 'MANUAL_LOSS', sym, mult);
    }
    activeTrades.delete(sym);

    const sign = pnlPct >= 0 ? "+" : "";
    await sendTelegramMessage(`🖐️ <b>İŞLEM MANUEL OLARAK KAPATILDI | #${sym.replace('USDT', '')}</b>\n\n🎯 <b>Yön:</b> ${t.side === 'LONG' ? '🟢 LONG' : '🔴 SHORT'}\n💵 <b>Giriş:</b> $${formatPrice(t.entry, t.entry)} ➔ <b>Çıkış:</b> $${formatPrice(livePrice, t.entry)}\n💰 <b>Gerçekleşen PNL:</b> <b>${sign}%${pnlPct.toFixed(2)}</b> (10x: ${sign}%${(pnlPct * 10).toFixed(1)})\n\n${getStatsText()}`, replyToId);
}

async function sendCoinPerformanceReport(replyToId = null) {
    if (tradeHistory.length === 0) {
        return sendTelegramMessage(`🏆 <b>COİN PERFORMANS KARNESİ</b>\n\nHenüz sonuçlanmış işlem verisi bulunmuyor.`, replyToId);
    }
    const stats = new Map();
    for (const item of tradeHistory) {
        if (!item.symbol) continue;
        const clean = item.symbol.replace('USDT', '');
        if (!stats.has(clean)) stats.set(clean, { wins: 0, stops: 0, tp2s: 0 });
        const st = stats.get(clean);
        if (item.type === 'TP1' || item.type === 'MANUAL_WIN') st.wins++;
        else if (item.type === 'TP2') { st.wins++; st.tp2s++; }
        else if (item.type === 'STOP' || item.type === 'MANUAL_LOSS') st.stops++;
    }

    const arr = Array.from(stats.entries()).map(([coin, data]) => ({
        coin, ...data, score: (data.wins * 2) + (data.tp2s * 2) - (data.stops * 3)
    }));

    const best = [...arr].filter(x => x.wins > 0).sort((a, b) => b.score - a.score).slice(0, 6);
    const worst = [...arr].filter(x => x.stops > 0).sort((a, b) => b.stops - a.stops).slice(0, 5);

    let msg = `🏆 <b>COİN PERFORMANS LİDERLİK KARNESİ</b>\n\n`;
    if (best.length > 0) {
        msg += `🌟 <b>En Çok Kazandıran Yıldız Coinler:</b>\n`;
        for (const b of best) msg += `• <b>#${b.coin}:</b> ${b.wins} Kâr (${b.tp2s} TP2) | ${b.stops} Stop\n`;
        msg += `\n`;
    }
    if (worst.length > 0) {
        msg += `⚠️ <b>En Çok Stop Eden Coinler:</b>\n`;
        for (const w of worst) msg += `• <b>#${w.coin}:</b> ${w.stops} Stop | ${w.wins} Kâr\n`;
    }
    await sendTelegramMessage(msg, replyToId);
}

async function sendQuarantineReport(replyToId = null) {
    const quarantined = [];
    const risky = [];
    for (const [sym, prof] of dynamicCoinMemory.entries()) {
        const clean = sym.replace('USDT', '');
        if (prof.quarantineUntil > Date.now()) {
            const remHours = ((prof.quarantineUntil - Date.now()) / (3600 * 1000)).toFixed(1);
            quarantined.push(`• 🚫 <b>#${clean}:</b> Karantinada (${remHours} saat kaldı)`);
        } else if (prof.consecutiveStops > 0) {
            risky.push(`• ⚠️ <b>#${clean}:</b> Peş peşe ${prof.consecutiveStops} Stop (Eşik: ${prof.stochLong}/${prof.stochShort})`);
        }
    }
    let text = `🛡️ <b>KARANTİNA VE RİSK DURUMU</b>\n\n`;
    if (quarantined.length === 0 && risky.length === 0) {
        text += `✅ Şu an karantinada veya ceza sınırında hiçbir parite yok. Tüm 87 parite tam kapasite taranıyor.`;
    } else {
        if (quarantined.length > 0) text += `<b>Karantinadaki Pariteler:</b>\n${quarantined.join('\n')}\n\n`;
        if (risky.length > 0) text += `<b>Sıkılaştırılmış (Dikkat İzlenen) Pariteler:</b>\n${risky.join('\n')}`;
    }
    await sendTelegramMessage(text, replyToId);
}

async function sendWalletReport(replyToId = null) {
    const startStr = getTurkishDateTimeString(walletStartTime);
    const msg = `💰 <b>KALICI SİMÜLE KASA RAPORU</b>\n\n🗓️ <b>Kasa Başlangıç Tarihi:</b> ${startStr}\n📂 <b>Anlık Açık İşlem:</b> ${activeTrades.size} / ${MAX_TOTAL_ACTIVE_TRADES}\n\n${getStatsText()}\n\n💡 <i>Not: Kasa kendi kendine asla sıfırlanmaz. Sıfırlamak için <b>/sifirla</b> yazabilirsiniz.</i>`;
    await sendTelegramMessage(msg, replyToId);
}

async function analyzeSpecificCoin(rawSymbol, replyToId = null) {
    let clean = rawSymbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (FUZZY_MAP[clean]) clean = FUZZY_MAP[clean];
    if (!clean.endsWith('USDT')) clean += 'USDT';

    let symbol = clean;
    let klines15m = await fetchUniversalKlines(symbol, "15", 55);
    if (!klines15m && !symbol.startsWith('1000')) {
        symbol = '1000' + clean;
        klines15m = await fetchUniversalKlines(symbol, "15", 55);
    }
    if (!klines15m || klines15m.length < 35) return sendTelegramMessage(`⚠️ <b>#${clean}</b> için veri bulunamadı.`, replyToId);
    
    const klines1h = await fetchUniversalKlines(symbol, "60", 55);
    const klines4h = await fetchUniversalKlines(symbol, "240", 55);

    const closes15 = klines15m.map(k => parseFloat(k[4]));
    const currentPrice = closes15[closes15.length - 1];
    const stoch15m = calculateStochRSI(closes15);
    const volData = analyze15MVolume(klines15m);
    const fundingData = await fetchFundingRate(symbol);
    
    let rsi1h = "N/A", ema50_1h = null;
    let mom1h = { isWaterfall: false, isRocket: false, curChange: "0.00", prevChange: "0.00" };
    if (klines1h) {
        const closes1h = klines1h.map(k => parseFloat(k[4]));
        rsi1h = Math.round(calculateRSI(closes1h, 14));
        ema50_1h = calculateEMA(closes1h, 50) || calculateEMA(closes1h, 20);
        mom1h = analyze1HMomentum(klines1h);
    }

    const isBull1H = (currentPrice >= ema50_1h * 0.995 && rsi1h >= 42) || rsi1h >= 48;
    const isBear1H = (currentPrice <= ema50_1h * 1.005 && rsi1h <= 58) || rsi1h <= 52;
    let trendText = isBull1H ? "🟢 Yükseliş / V-Dönüş Uygun" : isBear1H ? "🔴 Düşüş Eğilimi (Ayı)" : "⚪ Esnek / Kararsız";
    
    const lsData = await fetchLongShortRatio(symbol);
    const candleData = analyze4HCandles(klines4h);
    const prof = getCoinProfile(symbol);

    let crossText = stoch15m.bullCross ? "🟢 Yukarı Kesişim (%K > %D)" : stoch15m.bearCross ? "🔴 Aşağı Kesişim (%K < %D)" : "⏳ Kesişim Bekleniyor";

    const reportMsg = `👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n🔍 <b>ÖZEL COİN ANALİZİ | #${symbol.replace('USDT', '')}</b>\n\n💵 <b>Anlık Fiyat:</b> $${formatPrice(currentPrice, currentPrice)}\n🧭 <b>1H Ana Trend:</b> ${trendText} (RSI: ${rsi1h})\n⚡ <b>15M Stoch RSI:</b> %K: ${stoch15m.k} | %D: ${stoch15m.d}\n🔀 <b>Kesişim Durumu:</b> ${crossText}\n📊 <b>15M Hacim Durumu:</b> ${volData.badge}\n💸 <b>Fonlama (Funding):</b> ${fundingData.text}\n\n⚙️ <b>Profil:</b> ${prof.category}\n${lsData.text}\n\n${candleData.reportText}\n\n🔗 <a href="https://www.binance.com/tr/futures/${symbol}">Binance Futures'ta Aç</a>\n\n⚠️ <i>"YTD" HEPSİ.</i>`;
    await sendTelegramMessage(reportMsg, replyToId);
}

async function scanExtremes(type, replyToId = null) {
    await sendTelegramMessage(`🔍 <b>${type === 'DIP' ? 'Stoch Dip & Dönüş Bölgesindeki (%K <= 35)' : 'Stoch Tepe & Dönüş Bölgesindeki (%K >= 65)'} Pariteler Taranıyor...</b>`, replyToId);
    
    const valid = [];
    for (const sym of TARGET_COINS.slice(0, 50)) {
        try {
            const k15 = await fetchUniversalKlines(sym, "15", 50);
            await sleep(12);
            if (!k15 || k15.length < 35) continue;
            const closes = k15.map(k => parseFloat(k[4]));
            const stoch = calculateStochRSI(closes);
            const cur = closes[closes.length - 1];
            
            if (type === 'DIP' && stoch.k <= 35) valid.push({ sym: sym.replace('USDT', ''), k: stoch.k, d: stoch.d, cross: stoch.bullCross, price: cur });
            else if (type === 'TEPE' && stoch.k >= 65) valid.push({ sym: sym.replace('USDT', ''), k: stoch.k, d: stoch.d, cross: stoch.bearCross, price: cur });
        } catch (e) {}
    }

    valid.sort((a, b) => type === 'DIP' ? a.k - b.k : b.k - a.k);

    if (valid.length === 0) {
        return sendTelegramMessage(`ℹ️ Şu an ${type === 'DIP' ? 'dipte (%K <= 35)' : 'tepede (%K >= 65)'} parite bulunamadı.`, replyToId);
    }

    let text = `👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n🎯 <b>${type === 'DIP' ? '🟢 STOCH DİPTEKİ PARİTELER' : '🔴 STOCH TEPEDEKİ PARİTELER'}</b>\n\n`;
    for (const r of valid.slice(0, 8)) {
        const crossBadge = r.cross ? "✅ (Kesişim Var!)" : "⏳ (Henüz Kesmedi)";
        text += `• <b>#${r.sym}:</b> %K:${r.k} / %D:${r.d} ${crossBadge} | $${formatPrice(r.price, r.price)}\n`;
    }
    await sendTelegramMessage(text, replyToId);
}

async function pollTelegramUpdates() {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=5`;
        const res = await fetchJSON(url);
        
        if (res && res.ok && Array.isArray(res.result)) {
            for (const upd of res.result) {
                lastUpdateId = upd.update_id;
                const message = upd.message || upd.channel_post;
                if (!message || !message.text) continue;

                let txt = message.text.trim();
                let lowerTxt = txt.toLowerCase();

                if (lowerTxt === 'dip' || lowerTxt === '/dip') { await scanExtremes('DIP', message.message_id); continue; }
                if (lowerTxt === 'tepe' || lowerTxt === '/tepe') { await scanExtremes('TEPE', message.message_id); continue; }
                if (lowerTxt === 'acik' || lowerTxt === '/acik' || lowerTxt === 'açık' || lowerTxt === '/açık') { await sendOpenTradesReport(message.message_id); continue; }
                if (lowerTxt === 'kasa' || lowerTxt === '/kasa') { await sendWalletReport(message.message_id); continue; }
                if (lowerTxt === 'karantina' || lowerTxt === '/karantina') { await sendQuarantineReport(message.message_id); continue; }
                if (lowerTxt === 'karne' || lowerTxt === '/karne') { await sendCoinPerformanceReport(message.message_id); continue; }
                if (lowerTxt.startsWith('/kapat') || lowerTxt.startsWith('kapat ')) {
                    const arg = txt.split(' ')[1];
                    await closeManualTradeCommand(arg, message.message_id);
                    continue;
                }
                if (lowerTxt === 'sifirla' || lowerTxt === '/sifirla' || lowerTxt === 'sıfırla' || lowerTxt === '/sıfırla') {
                    resetPermanentWallet();
                    await sendTelegramMessage(`🔄 <b>SİMÜLE KASA KOMUTUNUZLA SIFIRLANDI!</b>\n\nTüm geçmiş işlem istatistikleri temizlendi ve kalıcı kasa <b>$1000.00</b> olarak yeniden başlatıldı.\n⏱ <b>${getTurkishTimeString()}</b>`, message.message_id);
                    continue;
                }
                if (lowerTxt === 'yardim' || lowerTxt === '/yardim' || lowerTxt === 'komutlar' || lowerTxt === '/komutlar') {
                    await sendTelegramMessage(`🤖 <b>SCALPPRO V-DÖNÜŞLÜ VIP KOMUT LİSTESİ:</b>\n\n• <b>/acik</b> : Açık işlemleri, canlı fiyatları, anlık PNL'i ve hedefe mesafeyi gösterir.\n• <b>/kapat coin</b> : İstediğiniz işlemi anlık fiyattan kapatır (Örn: <code>/kapat zro</code> veya <code>/kapat hepsi</code>).\n• <b>/kasa</b> : Kalıcı $1000 PNL kasasını gösterir.\n• <b>/karne</b> : En çok kazandıran ve stop eden coinlerin karnesini çıkarır.\n• <b>/karantina</b> : Cezalı veya dikkat izlenen coinleri gösterir.\n• <b>/sifirla</b> : $1000 simüle kasayı sıfırlayıp baştan başlatır.\n• <b>/dip</b> veya <b>/tepe</b> : Stoch RSI dip/tepe coinleri tarar.\n• <b>Coin Adı (Örn: sei, sol, btc)</b> : O coinin detaylı röntgenini çeker.`, message.message_id);
                    continue;
                }

                let targetCoin = null;
                if (txt.startsWith('/analiz')) targetCoin = txt.split(' ')[1];
                else if (txt.length >= 2 && txt.length <= 12 && !txt.includes(' ') && !txt.startsWith('/')) targetCoin = txt;
                else if (lowerTxt.includes('analiz')) {
                    const parts = txt.split(' ');
                    targetCoin = parts[0].toLowerCase() === 'analiz' ? parts[1] : parts[0];
                }
                
                if (targetCoin) {
                    try { await analyzeSpecificCoin(targetCoin, message.message_id); } catch (err) {}
                }
            }
        }
    } catch (e) {}
}

// ==========================================
// 6. İŞLEM TAKİBİ, İZ SÜREN STOP & ACİL BTC ŞOK KALKANI
// ==========================================
async function checkActiveTrades(symbol, currentPrice, currentHigh, currentLow, btc) {
    const trade = activeTrades.get(symbol);
    if (!trade) return;

    trade.lastPrice = currentPrice;
    const cleanSymbol = symbol.replace('USDT', '');
    const nowTime = getTurkishTimeString();

    if (trade.side === 'LONG') {
        const curProfitPct = ((currentPrice - trade.entry) / trade.entry) * 100;
        if (!trade.tp1Hit && !trade.shockProtected && curProfitPct >= 0.60 && (btc.btcTrend === 'DUMP' || btc.shockDump)) {
            trade.shockProtected = true;
            trade.sl = trade.entry;
            await sendTelegramMessage(`⚡🛡️ <b>ACİL BTC ŞOK KORUMASI DEVREDE | #${cleanSymbol}/USDT</b>\n\nBTC sert satış yediği için (+%${curProfitPct.toFixed(2)} kârda olan) LONG işleminizin stopu TP1 beklenmeden <b>GİRİŞ SEVİYESİNE ($${formatPrice(trade.entry, trade.entry)})</b> çekilerek koruma altına alındı!\n⏱ <b>${nowTime}</b>`);
        }

        if (!trade.tp1Hit && currentHigh >= trade.tp1) {
            trade.tp1Hit = true;
            trade.sl = trade.entry;
            recordTradeEvent('TP1', symbol);
            handleTradeResult(symbol, 'TP');
            const gainPct = (((trade.tp1 - trade.entry) / trade.entry) * 100).toFixed(2);
            await sendTelegramMessage(`👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n✅ <b>HEDEF GELDİ! (TP1 ALINDI) | #${cleanSymbol}/USDT</b>\n\n🎯 <b>Yön:</b> 🟢 LONG\n💵 <b>Giriş:</b> $${formatPrice(trade.entry, trade.entry)}\n🎯 <b>TP1 Fiyatı:</b> $${formatPrice(trade.tp1, trade.entry)}\n💰 <b>Kazanılan Kâr:</b> +%${gainPct}\n\n🛡️ Stop <b>GİRİŞ SEVİYESİNE</b> çekildi.\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
        }

        const midTargetLong = trade.tp1 + ((trade.tp2 - trade.tp1) * 0.5);
        if (trade.tp1Hit && !trade.trailingHit && currentHigh >= midTargetLong && currentHigh < trade.tp2) {
            trade.trailingHit = true;
            trade.sl = trade.tp1;
            await sendTelegramMessage(`🔒 <b>KÂR KİLİTLENDİ (İZ SÜREN STOP) | #${cleanSymbol}/USDT</b>\n\nFiyat TP2 yolunun yarısını devirdiği için Stop seviyesi girişten <b>TP1 SEVİYESİNE ($${formatPrice(trade.tp1, trade.entry)})</b> yükseltildi! Artık geri dönse bile kârımız garanti altında.\n⏱ <b>${nowTime}</b>`);
        }

        if (currentHigh >= trade.tp2) {
            recordTradeEvent('TP2', symbol);
            handleTradeResult(symbol, 'TP2');
            const gainPct = (((trade.tp2 - trade.entry) / trade.entry) * 100).toFixed(2);
            await sendTelegramMessage(`👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n✅✅ <b>TÜM HEDEFLER TAMAMLANDI! (TP2) | #${cleanSymbol}/USDT</b>\n\n🎯 <b>Yön:</b> 🟢 LONG\n🚀 <b>Net Kazanç:</b> +%${gainPct}\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
            activeTrades.delete(symbol); return;
        }

        if (currentLow <= trade.sl) {
            if (trade.trailingHit) {
                await sendTelegramMessage(`👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n🔒✅ <b>İZ SÜREN STOP İLE KÂRLI KAPANDI | #${cleanSymbol}/USDT</b>\n\nFiyat TP2 öncesi geri döndü ve kilitlediğimiz <b>TP1 ($${formatPrice(trade.sl, trade.entry)})</b> seviyesinden net kârla kapandı.\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
            } else if (trade.tp1Hit || trade.shockProtected) {
                await sendTelegramMessage(`👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n🛡️ <b>İŞLEM GİRİŞTEN KORUNARAK KAPANDI | #${cleanSymbol}/USDT</b>\n\nStop noktamıza giriş seviyesinde değdi. (Net Zarar Yok).\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
            } else {
                recordTradeEvent('STOP', symbol);
                handleTradeResult(symbol, 'STOP');
                await sendTelegramMessage(`👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n❌ <b>STOP TETİKLENDİ | #${cleanSymbol}/USDT</b>\n\n🎯 <b>Yön:</b> 🟢 LONG\n🛑 <b>Stop Fiyatı:</b> $${formatPrice(trade.sl, trade.entry)}\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
            }
            activeTrades.delete(symbol); return;
        }
    }

    if (trade.side === 'SHORT') {
        const curProfitPct = ((trade.entry - currentPrice) / trade.entry) * 100;
        if (!trade.tp1Hit && !trade.shockProtected && curProfitPct >= 0.60 && (btc.btcTrend === 'PUMP' || btc.shockPump)) {
            trade.shockProtected = true;
            trade.sl = trade.entry;
            await sendTelegramMessage(`⚡🛡️ <b>ACİL BTC ŞOK KORUMASI DEVREDE | #${cleanSymbol}/USDT</b>\n\nBTC sert alım yediği için (+%${curProfitPct.toFixed(2)} kârda olan) SHORT işleminizin stopu TP1 beklenmeden <b>GİRİŞ SEVİYESİNE ($${formatPrice(trade.entry, trade.entry)})</b> çekilerek koruma altına alındı!\n⏱ <b>${nowTime}</b>`);
        }

        if (!trade.tp1Hit && currentLow <= trade.tp1) {
            trade.tp1Hit = true;
            trade.sl = trade.entry;
            recordTradeEvent('TP1', symbol);
            handleTradeResult(symbol, 'TP');
            const gainPct = (((trade.entry - trade.tp1) / trade.entry) * 100).toFixed(2);
            await sendTelegramMessage(`👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n✅ <b>HEDEF GELDİ! (TP1 ALINDI) | #${cleanSymbol}/USDT</b>\n\n🎯 <b>Yön:</b> 🔴 SHORT\n💰 <b>Kazanılan Kâr:</b> +%${gainPct}\n\n🛡️ Stop <b>GİRİŞ SEVİYESİNE</b> çekildi.\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
        }

        const midTargetShort = trade.tp1 - ((trade.tp1 - trade.tp2) * 0.5);
        if (trade.tp1Hit && !trade.trailingHit && currentLow <= midTargetShort && currentLow > trade.tp2) {
            trade.trailingHit = true;
            trade.sl = trade.tp1;
            await sendTelegramMessage(`🔒 <b>KÂR KİLİTLENDİ (İZ SÜREN STOP) | #${cleanSymbol}/USDT</b>\n\nFiyat TP2 yolunun yarısını devirdiği için Stop seviyesi girişten <b>TP1 SEVİYESİNE ($${formatPrice(trade.tp1, trade.entry)})</b> çekildi! Artık geri dönse bile kârımız garanti altında.\n⏱ <b>${nowTime}</b>`);
        }

        if (currentLow <= trade.tp2) {
            recordTradeEvent('TP2', symbol);
            handleTradeResult(symbol, 'TP2');
            const gainPct = (((trade.entry - trade.tp2) / trade.entry) * 100).toFixed(2);
            await sendTelegramMessage(`👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n✅✅ <b>TÜM HEDEFLER TAMAMLANDI! (TP2) | #${cleanSymbol}/USDT</b>\n\n🎯 <b>Yön:</b> 🔴 SHORT\n🚀 <b>Net Kazanç:</b> +%${gainPct}\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
            activeTrades.delete(symbol); return;
        }

        if (currentHigh >= trade.sl) {
            if (trade.trailingHit) {
                await sendTelegramMessage(`👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n🔒✅ <b>İZ SÜREN STOP İLE KÂRLI KAPANDI | #${cleanSymbol}/USDT</b>\n\nFiyat TP2 öncesi geri döndü ve kilitlediğimiz <b>TP1 ($${formatPrice(trade.sl, trade.entry)})</b> seviyesinden net kârla kapandı.\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
            } else if (trade.tp1Hit || trade.shockProtected) {
                await sendTelegramMessage(`👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n🛡️ <b>İŞLEM GİRİŞTEN KORUNARAK KAPANDI | #${cleanSymbol}/USDT</b>\n\nStop noktamıza giriş seviyesinde değdi. (Net Zarar Yok).\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
            } else {
                recordTradeEvent('STOP', symbol);
                handleTradeResult(symbol, 'STOP');
                await sendTelegramMessage(`👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n❌ <b>STOP TETİKLENDİ | #${cleanSymbol}/USDT</b>\n\n🎯 <b>Yön:</b> 🔴 SHORT\n🛑 <b>Stop Fiyatı:</b> $${formatPrice(trade.sl, trade.entry)}\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
            }
            activeTrades.delete(symbol); return;
        }
    }

    if (Date.now() - trade.time > 6 * 60 * 60 * 1000) {
        const pnlPct = trade.side === 'LONG' ? (((currentPrice - trade.entry) / trade.entry) * 100) : (((trade.entry - currentPrice) / trade.entry) * 100);
        if (!trade.tp1Hit) {
            recordTradeEvent(pnlPct >= 0 ? 'MANUAL_WIN' : 'MANUAL_LOSS', symbol, 1 + (pnlPct / 100));
        }
        const sign = pnlPct >= 0 ? "+" : "";
        await sendTelegramMessage(`⌛ <b>ZAMAN AŞIMI (6 SAAT DOLDU) | #${cleanSymbol}/USDT</b>\n\n6 saat boyunca ana hedeflere ulaşmayan işlem kontenjan boşaltmak için güncel fiyattan ($${formatPrice(currentPrice, trade.entry)} | <b>${sign}%${pnlPct.toFixed(2)}</b>) kapatıldı.\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
        activeTrades.delete(symbol);
    }
}

function canOpenNewTrade(side) {
    if (activeTrades.size >= MAX_TOTAL_ACTIVE_TRADES) return false;
    let sameSideCount = 0;
    for (const t of activeTrades.values()) {
        if (t.side === side) sameSideCount++;
    }
    return sameSideCount < MAX_SAME_SIDE_TRADES;
}

// ==========================================
// 7. TURBO HIZLI TARAMA MOTORU (V-DÖNÜŞLÜ ESNEK TREND FİLTRESİ)
// ==========================================
async function scanMarket() {
    try {
        const session = getActiveSessionName();
        const btc = await checkBtcCondition();
        if (!btc.safe) return;

        let signalSentInThisCycle = false, scannedCount = 0, stochNeutralCount = 0, macroBlockedCount = 0, volumeBlockedCount = 0;

        for (const symbol of TARGET_COINS) {
            const prof = getCoinProfile(symbol);
            if (prof.quarantineUntil > Date.now()) continue;

            const klines15m = await fetchUniversalKlines(symbol, "15", 55);
            await sleep(10);
            if (!klines15m || klines15m.length < 40) continue;
            scannedCount++;

            const opens15 = klines15m.map(k => parseFloat(k[1]));
            const highs15 = klines15m.map(k => parseFloat(k[2]));
            const lows15 = klines15m.map(k => parseFloat(k[3]));
            const closes15 = klines15m.map(k => parseFloat(k[4]));
            
            const currentOpen = opens15[opens15.length - 1];
            const currentHigh = highs15[highs15.length - 1];
            const currentLow = lows15[lows15.length - 1];
            const currentPrice = closes15[closes15.length - 1];

            await checkActiveTrades(symbol, currentPrice, currentHigh, currentLow, btc);

            const stoch15m = calculateStochRSI(closes15);
            
            const bodySize = Math.abs(currentPrice - currentOpen);
            const lowerWick = Math.min(currentOpen, currentPrice) - currentLow;
            const upperWick = currentHigh - Math.max(currentOpen, currentPrice);
            
            const hasBullReversalCandle = (lowerWick >= bodySize * 0.20) || (currentPrice > currentOpen);
            const hasBearReversalCandle = (upperWick >= bodySize * 0.20) || (currentPrice < currentOpen);

            // Genişletilmiş Kesişim ve Dip/Tepe Şartı
            const isPotentialLong = (stoch15m.k <= prof.stochLong && stoch15m.bullCross && hasBullReversalCandle && btc.btcTrend !== "DUMP");
            const isPotentialShort = (stoch15m.k >= prof.stochShort && stoch15m.bearCross && hasBearReversalCandle && btc.btcTrend !== "PUMP");

            if (!isPotentialLong && !isPotentialShort) {
                stochNeutralCount++;
                continue;
            }

            const volData = analyze15MVolume(klines15m);
            if (!volData.isAlive) {
                volumeBlockedCount++;
                continue;
            }

            const desiredSide = isPotentialLong ? 'LONG' : 'SHORT';
            if (!canOpenNewTrade(desiredSide)) continue;

            const klines1h = await fetchUniversalKlines(symbol, "60", 55);
            const klines4h = await fetchUniversalKlines(symbol, "240", 55);
            if (!klines1h || klines1h.length < 25) continue;

            const closes1h = klines1h.map(k => parseFloat(k[4]));
            const rsi1h = Math.round(calculateRSI(closes1h, 14));
            const ema50_1h = calculateEMA(closes1h, 50) || calculateEMA(closes1h, 20);
            const currentPrice1h = closes1h[closes1h.length - 1];
            const mom1h = analyze1HMomentum(klines1h);

            // V-TİPİ DÖNÜŞ İSTİSNASI (SEI gibi dip tepkilerini kaçırmamak için EMA50 şartı esnetildi)
            const canLong1H = ((currentPrice1h >= ema50_1h * 0.990 || rsi1h >= 40) && !mom1h.isWaterfall);
            const canShort1H = ((currentPrice1h <= ema50_1h * 1.010 || rsi1h <= 60) && !mom1h.isRocket);

            let candleData = { reportText: "⚠️ 4H Verisi Alınamadı", netGain: 0, isBearDominance: false, isBullDominance: false };
            if (klines4h && klines4h.length >= 20) candleData = analyze4HCandles(klines4h);

            if ((isPotentialLong && (!canLong1H || candleData.isBearDominance)) || (isPotentialShort && (!canShort1H || candleData.isBullDominance))) {
                macroBlockedCount++;
                continue;
            }

            const lsData = await fetchLongShortRatio(symbol);
            const fundingData = await fetchFundingRate(symbol);
            if ((isPotentialLong && fundingData.blockLong) || (isPotentialShort && fundingData.blockShort)) {
                macroBlockedCount++;
                continue;
            }

            const atr15 = calculateATR(highs15, lows15, closes15, 14);
            const cleanSymbol = symbol.replace('USDT', '');
            let signal = null;

            if (isPotentialLong && lsData.longPct < prof.maxLsRatio) {
                const stopDist = atr15 ? Math.max(atr15 * prof.atrMultiplier, currentPrice * 0.012) : currentPrice * 0.014;
                signal = { 
                    type: "🟢 LONG", 
                    side: "LONG",
                    rawEntry: currentPrice, 
                    rawSl: currentPrice - stopDist, 
                    rawTp1: currentPrice + (stopDist * 1.25), 
                    rawTp2: currentPrice + (stopDist * 2.5), 
                    sl: formatPrice(currentPrice - stopDist, currentPrice), 
                    tp1: formatPrice(currentPrice + (stopDist * 1.25), currentPrice), 
                    tp2: formatPrice(currentPrice + (stopDist * 2.5), currentPrice), 
                    tp1Pct: ((((currentPrice + (stopDist * 1.25)) - currentPrice) / currentPrice) * 100).toFixed(2) 
                };
            }

            if (isPotentialShort && lsData.shortPct < prof.maxLsRatio) {
                const stopDist = atr15 ? Math.max(atr15 * prof.atrMultiplier, currentPrice * 0.012) : currentPrice * 0.014;
                signal = { 
                    type: "🔴 SHORT", 
                    side: "SHORT",
                    rawEntry: currentPrice, 
                    rawSl: currentPrice + stopDist, 
                    rawTp1: currentPrice - (stopDist * 1.25), 
                    rawTp2: currentPrice - (stopDist * 2.5), 
                    sl: formatPrice(currentPrice + stopDist, currentPrice), 
                    tp1: formatPrice(currentPrice - (stopDist * 1.25), currentPrice), 
                    tp2: formatPrice(currentPrice - (stopDist * 2.5), currentPrice), 
                    tp1Pct: (((currentPrice - (currentPrice - (stopDist * 1.25))) / currentPrice) * 100).toFixed(2) 
                };
            }

            const lastAlertTime = alertedCoins.get(symbol) || 0;
            if (signal && !activeTrades.has(symbol) && (Date.now() - lastAlertTime >= 20 * 60 * 1000)) {
                const quality = evaluateSignalQuality(signal.side, stoch15m, volData, lsData, fundingData, candleData);

                activeTrades.set(symbol, { 
                    side: signal.side, 
                    entry: signal.rawEntry, 
                    lastPrice: currentPrice,
                    sl: signal.rawSl, 
                    tp1: signal.rawTp1, 
                    tp2: signal.rawTp2, 
                    tp1Hit: false, 
                    trailingHit: false, 
                    shockProtected: false,
                    stars: quality.stars,
                    time: Date.now() 
                });
                alertedCoins.set(symbol, Date.now());

                const msg = `👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n${quality.stars} <b>${quality.title} (V-Dönüş Modu)</b>\n\n🪙 <b>Coin:</b> #${cleanSymbol}/USDT\n🎯 <b>Yön:</b> ${signal.type}\n💵 <b>Giriş Fiyatı:</b> $${formatPrice(currentPrice, currentPrice)}\n🛑 <b>Önerilen Stop:</b> $${signal.sl}\n⚖️ <b>Önerilen Kaldıraç:</b> 5x – 10x\n\n🎯 <b>Kademeli Kâr Hedefleri (İz Süren & Şok Stop Aktif):</b>\n• <b>TP1 (İlk Kâr - %${signal.tp1Pct}):</b> $${signal.tp1}\n• <b>TP2 (Trend Kârı):</b> $${signal.tp2}\n\n⚙️ <b>Tetik, Hacim ve Fonlama Onayı:</b>\n• Profil: ${prof.category}\n• Stoch Kesişimi: <b>%K: ${stoch15m.k} | %D: ${stoch15m.d}</b> (V-Dönüş Onayı ✅)\n• 15M Hacim Gücü: <b>${volData.badge}</b>\n• Fonlama (Funding): <b>${fundingData.text}</b>\n• Aktif İşlem Kontenjanı: <b>${activeTrades.size}/${MAX_TOTAL_ACTIVE_TRADES}</b>\n\n🧭 <b>Makro & BTC Kalkanı:</b>\n• <b>1H Trend & RSI:</b> Uygun (RSI: ${rsi1h})\n• <b>BTC 15M Durumu:</b> %${btc.change15m} (${btc.btcTrend === 'NEUTRAL' ? 'Güvenli ✅' : btc.btcTrend})\n\n${lsData.text}\n\n${candleData.reportText}\n\n${getStatsText()}\n\n🔗 <a href="https://www.binance.com/tr/futures/${symbol}">Binance Futures'ta Aç</a>\n\n⚠️ <i>"YTD" HEPSİ.</i>`;
                await sendTelegramMessage(msg);
                signalSentInThisCycle = true;
            }
        }

        if (!signalSentInThisCycle && (Date.now() - lastStatusReportTime >= 10 * 60 * 1000)) {
            const btcBadge = btc.btcTrend === "DUMP" ? "🔴 BTC Satışta (Longlar Kilitli)" : btc.btcTrend === "PUMP" ? "🟢 BTC Alımda (Shortlar Kilitli)" : "⚪ Sakin / Güvenli";
            await sendTelegramMessage(`👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n⏳ <b>[${getTurkishTimeString()}] V-DÖNÜŞLÜ VIP TARAMA RAPORU</b>\n\n🌐 <b>Aktif Seans:</b> ${session}\n📊 <b>Hızlı Taranan:</b> ${scannedCount} Parite | <b>Açık İşlem:</b> ${activeTrades.size}/${MAX_TOTAL_ACTIVE_TRADES}\n⚡ <b>BTC Kalkanı:</b> %${btc.change15m} (${btcBadge})\n\n🔍 <b>Neden Sinyal Çıkmadı?</b>\n• <b>15M Stoch Kesişimi Bekleyen:</b> ${stochNeutralCount} Parite\n• <b>Düşük Hacim Filtresine Takılan:</b> ${volumeBlockedCount} Parite\n• <b>Makro / Fonlama Kalkanına Takılan:</b> ${macroBlockedCount} Parite\n\n${getStatsText()}\n\n⌨️ <i>Komutlar: /acik | /kapat | /kasa | /karne | /karantina | /sifirla</i>\n⚠️ <i>"YTD" HEPSİ.</i>`);
            lastStatusReportTime = Date.now();
        }
    } catch (err) {}
}

// ==========================================
// 8. ANA ÇALIŞTIRICI
// ==========================================
async function runLoop() {
    console.log("🚀 ScalpPro V-Dönüşlü VIP Ultimate Başlatıldı...");
    sendTelegramMessage("⚡🔄 <b>V-DÖNÜŞLÜ VIP ULTIMATE AKTİF!</b>\n\n1️⃣ <b>V-Tipi Dip Dönüş İstisnası:</b> SEI gibi sert düşüşlerden sonra aniden dönen dipler artık 1H EMA50 engeline takılmadan yakalanıyor!\n2️⃣ <b>Genişletilmiş Kesişim Penceresi:</b> Stoch RSI dip/tepe sınırları esnetilerek fırsat kaçırma oranı sıfırlandı.\n3️⃣ <b>Tüm VIP Özellikler Devrede:</b> Canlı PNL'li <code>/acik</code>, <code>/kapat</code>, <code>/karne</code> ve acil BTC şok kalkanı aktif!");
    
    (async () => { while (true) { await pollTelegramUpdates(); await sleep(1500); } })();
    while (true) { await scanMarket(); await sleep(10000); }
}

runLoop();
