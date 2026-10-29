process.on('uncaughtException', (err) => {
    console.error('Kritik Hata Yakalandi:', err.message);
});

process.on('unhandledRejection', (reason) => {
    console.error('Promise Hatasi:', reason);
});

const http = require('http');
const https = require('https');

// ==========================================
// 1. RENDER PORT & SABİT TELEGRAM BİLGİLERİ
// ==========================================
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ScalpPro Adaptive AI + 1H Trend Engine Active\n');
}).listen(PORT, '0.0.0.0', () => {
    console.log(`Sunucu ${PORT} portunda dinlemede.`);
});

const TELEGRAM_TOKEN = "8930276912:AAE4xogVFRIqIjPuJ97RqHJFuHvFexNxt2k";
const CHAT_ID = "-1004412694884";

// ==========================================
// 2. ADAPTİF PROFİLLER VE COİN KATEGORİLERİ
// ==========================================
const BASE_PROFILES = {
    MAJOR: { category: "💎 Majör / Trend Sadık", rsiLong: 40, rsiShort: 60, atrMultiplier: 1.3, maxLsRatio: 68 },
    MEME: { category: "🐸 Meme / Ekstrem Volatilite", rsiLong: 33, rsiShort: 68, atrMultiplier: 2.0, maxLsRatio: 64 },
    VOLATILE_ALT: { category: "⚡ Sığ Tahta / Yüksek Oynaklık", rsiLong: 35, rsiShort: 65, atrMultiplier: 1.8, maxLsRatio: 62 }
};

const COIN_ASSIGNMENTS = {
    "SOLUSDT": "MAJOR", "AVAXUSDT": "MAJOR", "NEARUSDT": "MAJOR", "LINKUSDT": "MAJOR",
    "UNIUSDT": "MAJOR", "LTCUSDT": "MAJOR", "BCHUSDT": "MAJOR", "ETCUSDT": "MAJOR",
    "ATOMUSDT": "MAJOR", "FILUSDT": "MAJOR", "ALGOUSDT": "MAJOR",
    "DOGEUSDT": "MEME", "1000PEPEUSDT": "MEME", "WIFUSDT": "MEME", "1000SHIBUSDT": "MEME",
    "1000FLOKIUSDT": "MEME", "1000BONKUSDT": "MEME", "NEIROUSDT": "MEME", "NOTUSDT": "MEME",
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
    "ZROUSDT": "VOLATILE_ALT", "PYTHUSDT": "VOLATILE_ALT", "WUSDT": "VOLATILE_ALT"
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
        prof.rsiLong = Math.max(22, prof.rsiLong - 2);
        prof.rsiShort = Math.min(78, prof.rsiShort + 2);
        prof.atrMultiplier = parseFloat((prof.atrMultiplier + 0.15).toFixed(2));
        if (prof.consecutiveStops >= 3) {
            prof.quarantineUntil = Date.now() + (24 * 60 * 60 * 1000);
            sendTelegramMessage(`🛡️ <b>${symbol} 24 Saat Karantinaya Alındı!</b>\nPeş peşe 3 stop nedeniyle parametreler sıkılaştırıldı.`);
        }
    } else if (resultType === 'TP') {
        prof.totalTps++;
        prof.consecutiveStops = 0;
    }
}

// ==========================================
// 3. HAFIZA & DEĞİŞKENLER
// ==========================================
let lastUpdateId = 0;
const alertedCoins = new Map();
const activeTrades = new Map();
const tradeHistory = [];
let lastStatusReportTime = 0;

const TARGET_COINS = Object.keys(COIN_ASSIGNMENTS);
const FUZZY_MAP = {
    "DMY": "DYM", "PEP": "PEPE", "SHIBA": "SHIB", "DOG": "DOGE", "FLOK": "FLOKI",
    "BON": "BONK", "LNK": "LINK", "AVX": "AVAX", "NOTC": "NOT", "STR": "STRK", "APTOS": "APT"
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getTurkishTimeString() {
    return new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' });
}

function formatPrice(val, basePrice) {
    if (!val || isNaN(val)) return "0.00";
    const ref = basePrice || val;
    let decimals = ref < 0.001 ? 7 : ref < 0.1 ? 6 : ref < 1 ? 5 : ref < 10 ? 4 : ref < 1000 ? 2 : 1;
    return Number(val).toFixed(decimals);
}

function getPeriodStats(hours) {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    const filtered = tradeHistory.filter(t => t.time >= cutoff);
    const tps = filtered.filter(t => t.type === 'TP').length;
    const stops = filtered.filter(t => t.type === 'STOP').length;
    const total = tps + stops;
    const winRate = total > 0 ? ((tps / total) * 100).toFixed(1) : "0.0";
    return { tps, stops, total, winRate };
}

function getStatsText() {
    const twelveHoursAgo = Date.now() - (12 * 60 * 60 * 1000);
    while (tradeHistory.length > 0 && tradeHistory[0].time < twelveHoursAgo) tradeHistory.shift();
    const s1 = getPeriodStats(1);
    const s12 = getPeriodStats(12);
    let text1 = s1.total > 0 ? `• ⚡ <b>Son 1 Saat:</b> ${s1.tps} TP | ${s1.stops} Stop (<b>%${s1.winRate} Win Rate</b>)` : `• ⚡ <b>Son 1 Saat:</b> İşlem yok`;
    let text12 = s12.total > 0 ? `• 🌐 <b>Son 12 Saat:</b> ${s12.tps} TP | ${s12.stops} Stop (<b>%${s12.winRate} Win Rate</b>)` : `• 🌐 <b>Son 12 Saat:</b> Henüz sonuçlanan işlem yok`;
    return `📊 <b>Canlı Başarı Karnesi (1H Trend + 15M):</b>\n${text1}\n${text12}`;
}

function getActiveSessionName() {
    const trHour = (new Date().getUTCHours() + 3) % 24;
    return trHour >= 2 && trHour < 10 ? "🌏 Asya Seansı" : trHour >= 10 && trHour < 16 ? "🇪🇺 Londra Seansı" : "🗽 New York Seansı";
}

// ==========================================
// 4. API MOTORLARI
// ==========================================
function fetchJSON(url, customHeaders = {}) {
    return new Promise((resolve, reject) => {
        const headers = Object.assign({ 'User-Agent': 'Mozilla/5.0' }, customHeaders);
        const req = https.get(url, { headers, timeout: 12000 }, (res) => {
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
    const isBullDominance = netGain >= 2.5;
    const isBearDominance = netGain <= -2.5;
    let netTrendText = isBullDominance ? "🟢 Güçlü Boğa Baskısı (4H)" : isBearDominance ? "🔴 Güçlü Ayı Baskısı (4H)" : "⚪ Yatay / Kararsız Seyir";
    return { reportText: `🕯️ <b>4H Makro Mum Yapısı (Bilgilendirme):</b>\n<pre>${lines.join('\n')}\n ↳ 4H Net Yön: ${netTrendText}</pre>`, netGain, isBullDominance, isBearDominance };
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
    return Math.round(100 - (100 / (1 + (avgGain / avgLoss))));
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

async function checkBtcCondition() {
    const list = await fetchUniversalKlines("BTCUSDT", "15", 30);
    if (!list || list.length < 3) return { safe: true, btcTrend: "NEUTRAL", change15m: "0.00" };
    const currentPrice = parseFloat(list[list.length - 1][4]), pricePrev = parseFloat(list[list.length - 2][1]);
    const change15m = ((currentPrice - pricePrev) / pricePrev) * 100;
    return { safe: Math.abs(change15m) < 1.8, btcTrend: change15m <= -0.85 ? "DUMP" : change15m >= 0.85 ? "PUMP" : "NEUTRAL", change15m: change15m.toFixed(2) };
}

// ==========================================
// 5. ON-DEMAND VE ÖZEL TARAMA MOTORLARI
// ==========================================
async function analyzeSpecificCoin(rawSymbol, replyToId = null) {
    let clean = rawSymbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (FUZZY_MAP[clean]) clean = FUZZY_MAP[clean];
    if (!clean.endsWith('USDT')) clean += 'USDT';

    let symbol = clean;
    let klines15m = await fetchUniversalKlines(symbol, "15", 50);
    if (!klines15m && !symbol.startsWith('1000')) {
        symbol = '1000' + clean;
        klines15m = await fetchUniversalKlines(symbol, "15", 50);
    }
    if (!klines15m || klines15m.length < 25) return sendTelegramMessage(`⚠️ <b>#${clean}</b> için veri bulunamadı.`, replyToId);
    
    const klines1h = await fetchUniversalKlines(symbol, "60", 50);
    const klines4h = await fetchUniversalKlines(symbol, "240", 50);

    const closes15 = klines15m.map(k => parseFloat(k[4]));
    const currentPrice = closes15[closes15.length - 1];
    const rsi15m = calculateRSI(closes15, 14);
    
    let rsi1h = "N/A", ema50_1h = null, rsi4h = "N/A";
    if (klines1h) {
        const closes1h = klines1h.map(k => parseFloat(k[4]));
        rsi1h = calculateRSI(closes1h, 14);
        ema50_1h = calculateEMA(closes1h, 50) || calculateEMA(closes1h, 20);
    }
    if (klines4h) {
        const closes4h = klines4h.map(k => parseFloat(k[4]));
        rsi4h = calculateRSI(closes4h, 14);
    }

    let trendText = currentPrice > ema50_1h && rsi1h >= 50 ? "🟢 Yükseliş Trendi (Boğa)" : currentPrice < ema50_1h && rsi1h <= 50 ? "🔴 Düşüş Trendi (Ayı)" : "⚪ Yatay / Kararsız";
    const lsData = await fetchLongShortRatio(symbol);
    const candleData = analyze4HCandles(klines4h);
    const prof = getCoinProfile(symbol);

    let verdict = "⚪ Nötr / Bekle-Gör";
    if (candleData.isBearDominance) verdict = "🛑 4H Ayı Baskısı Mevcut (Long Filtrelendi)";
    else if (candleData.isBullDominance) verdict = "🚀 4H Boğa Baskısı Mevcut (Short Filtrelendi)";
    else if (rsi15m <= prof.rsiLong && currentPrice > ema50_1h && lsData.longPct < prof.maxLsRatio) verdict = `🟢 LONG Fırsat Bölgesi (Özel Eşik: ${prof.rsiLong})`;
    else if (rsi15m >= prof.rsiShort && currentPrice < ema50_1h && lsData.shortPct < prof.maxLsRatio) verdict = `🔴 SHORT Fırsat Bölgesi (Özel Eşik: ${prof.rsiShort})`;

    const reportMsg = `👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n🔍 <b>ÖZEL COİN ANALİZİ | #${symbol.replace('USDT', '')}</b>\n\n💵 <b>Anlık Fiyat:</b> $${formatPrice(currentPrice, currentPrice)}\n🧭 <b>1H Ana Trend:</b> ${trendText} (RSI: ${rsi1h})\n⚡ <b>15dk RSI:</b> ${rsi15m} (Hedef Eşiği: ${prof.rsiLong})\n📊 <b>4H Makro Bilgi:</b> RSI ${rsi4h}\n🎯 <b>Sistem Değerlendirmesi:</b> <b>${verdict}</b>\n\n⚙️ <b>Coin Özel Parametresi:</b>\n• Profil: ${prof.category}\n• Optimize ATR: ${prof.atrMultiplier}x | Maks L/S: %${prof.maxLsRatio}\n\n${lsData.text}\n\n${candleData.reportText}\n\n🔗 <a href="https://www.binance.com/tr/futures/${symbol}">Binance Futures'ta Aç</a>\n\n⚠️ <i>"YTD" HEPSİ.</i>`;
    await sendTelegramMessage(reportMsg, replyToId);
}

async function scanExtremes(type, replyToId = null) {
    await sendTelegramMessage(`🔍 <b>${type === 'DIP' ? 'Dip Bölgesindeki (RSI <= 38)' : 'Aşırı Şişmiş (RSI >= 62)'} Pariteler Taranıyor...</b> Lütfen bekleyiniz.`, replyToId);
    
    const valid = [];
    for (const sym of TARGET_COINS.slice(0, 35)) {
        try {
            const k15 = await fetchUniversalKlines(sym, "15", 30);
            await sleep(35);
            if (!k15 || k15.length < 20) continue;
            const closes = k15.map(k => parseFloat(k[4]));
            const rsi = calculateRSI(closes, 14);
            const cur = closes[closes.length - 1];
            
            if (type === 'DIP' && rsi <= 38) valid.push({ sym: sym.replace('USDT', ''), rsi, price: cur });
            else if (type === 'TEPE' && rsi >= 62) valid.push({ sym: sym.replace('USDT', ''), rsi, price: cur });
        } catch (e) {}
    }

    valid.sort((a, b) => type === 'DIP' ? a.rsi - b.rsi : b.rsi - a.rsi);

    if (valid.length === 0) {
        return sendTelegramMessage(`ℹ️ Şu an ${type === 'DIP' ? 'aşırı dipte (RSI <= 38)' : 'aşırı tepede (RSI >= 62)'} parite bulunamadı.`, replyToId);
    }

    let text = `👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n🎯 <b>${type === 'DIP' ? '🟢 EN DİPTEKİ PARİTELER' : '🔴 EN TEPEDEKİ PARİTELER'}</b>\n\n`;
    for (const r of valid.slice(0, 6)) text += `• <b>#${r.sym}:</b> 15M RSI <b>${r.rsi}</b> | Fiyat: $${formatPrice(r.price, r.price)}\n`;
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
// 6. FİTİL (İĞNE UCU) YAKALAMALI İŞLEM TAKİBİ
// ==========================================
async function checkActiveTrades(symbol, currentPrice, currentHigh, currentLow) {
    const trade = activeTrades.get(symbol);
    if (!trade) return;

    const cleanSymbol = symbol.replace('USDT', '');
    const nowTime = getTurkishTimeString();

    if (trade.side === 'LONG') {
        if (!trade.tp1Hit && currentHigh >= trade.tp1) {
            trade.tp1Hit = true;
            trade.sl = trade.entry;
            tradeHistory.push({ type: 'TP', time: Date.now() });
            handleTradeResult(symbol, 'TP');
            const gainPct = (((trade.tp1 - trade.entry) / trade.entry) * 100).toFixed(2);
            await sendTelegramMessage(`👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n✅ <b>HEDEF GELDİ! (TP1 ALINDI) | #${cleanSymbol}/USDT</b>\n\n🎯 <b>Yön:</b> 🟢 LONG\n💵 <b>Giriş:</b> $${formatPrice(trade.entry, trade.entry)}\n🎯 <b>TP1 Fiyatı:</b> $${formatPrice(trade.tp1, trade.entry)}\n💰 <b>Kazanılan Kâr:</b> +%${gainPct}\n\n🛡️ Stop <b>GİRİŞ SEVİYESİNE</b> çekildi.\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
        }
        if (currentHigh >= trade.tp2) {
            tradeHistory.push({ type: 'TP', time: Date.now() });
            handleTradeResult(symbol, 'TP');
            const gainPct = (((trade.tp2 - trade.entry) / trade.entry) * 100).toFixed(2);
            await sendTelegramMessage(`👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n✅✅ <b>TÜM HEDEFLER TAMAMLANDI! (TP2) | #${cleanSymbol}/USDT</b>\n\n🎯 <b>Yön:</b> 🟢 LONG\n🚀 <b>Net Kazanç:</b> +%${gainPct}\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
            activeTrades.delete(symbol); return;
        }
        if (currentLow <= trade.sl) {
            tradeHistory.push({ type: 'STOP', time: Date.now() });
            handleTradeResult(symbol, 'STOP');
            await sendTelegramMessage(`👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n❌ <b>STOP TETİKLENDİ | #${cleanSymbol}/USDT</b>\n\n🎯 <b>Yön:</b> 🟢 LONG\n🛑 <b>Stop Fiyatı:</b> $${formatPrice(trade.sl, trade.entry)}\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
            activeTrades.delete(symbol); return;
        }
    }

    if (trade.side === 'SHORT') {
        if (!trade.tp1Hit && currentLow <= trade.tp1) {
            trade.tp1Hit = true;
            trade.sl = trade.entry;
            tradeHistory.push({ type: 'TP', time: Date.now() });
            handleTradeResult(symbol, 'TP');
            const gainPct = (((trade.entry - trade.tp1) / trade.entry) * 100).toFixed(2);
            await sendTelegramMessage(`👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n✅ <b>HEDEF GELDİ! (TP1 ALINDI) | #${cleanSymbol}/USDT</b>\n\n🎯 <b>Yön:</b> 🔴 SHORT\n💰 <b>Kazanılan Kâr:</b> +%${gainPct}\n\n🛡️ Stop <b>GİRİŞ SEVİYESİNE</b> çekildi.\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
        }
        if (currentLow <= trade.tp2) {
            tradeHistory.push({ type: 'TP', time: Date.now() });
            handleTradeResult(symbol, 'TP');
            const gainPct = (((trade.entry - trade.tp2) / trade.entry) * 100).toFixed(2);
            await sendTelegramMessage(`👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n✅✅ <b>TÜM HEDEFLER TAMAMLANDI! (TP2) | #${cleanSymbol}/USDT</b>\n\n🎯 <b>Yön:</b> 🔴 SHORT\n🚀 <b>Net Kazanç:</b> +%${gainPct}\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
            activeTrades.delete(symbol); return;
        }
        if (currentHigh >= trade.sl) {
            tradeHistory.push({ type: 'STOP', time: Date.now() });
            handleTradeResult(symbol, 'STOP');
            await sendTelegramMessage(`👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n❌ <b>STOP TETİKLENDİ | #${cleanSymbol}/USDT</b>\n\n🎯 <b>Yön:</b> 🔴 SHORT\n🛑 <b>Stop Fiyatı:</b> $${formatPrice(trade.sl, trade.entry)}\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
            activeTrades.delete(symbol); return;
        }
    }
    if (Date.now() - trade.time > 6 * 60 * 60 * 1000) activeTrades.delete(symbol);
}

// ==========================================
// 7. MULTI-TIMEFRAME (1H + 15M + 4H) TARAMA
// ==========================================
async function scanMarket() {
    try {
        const session = getActiveSessionName();
        const btc = await checkBtcCondition();
        if (!btc.safe) return;

        let signalSentInThisCycle = false, scannedCount = 0, trendBlockedCount = 0, rsiNeutralCount = 0;

        for (const symbol of TARGET_COINS) {
            const prof = getCoinProfile(symbol);
            if (prof.quarantineUntil > Date.now()) continue;

            const klines15m = await fetchUniversalKlines(symbol, "15", 50);
            await sleep(40);
            if (!klines15m || klines15m.length < 35) continue;
            scannedCount++;

            const opens15 = klines15m.map(k => parseFloat(k[1])), highs15 = klines15m.map(k => parseFloat(k[2])), lows15 = klines15m.map(k => parseFloat(k[3])), closes15 = klines15m.map(k => parseFloat(k[4]));
            const currentPrice = closes15[closes15.length - 1], currentOpen = opens15[opens15.length - 1], currentHigh = highs15[highs15.length - 1], currentLow = lows15[lows15.length - 1];

            await checkActiveTrades(symbol, currentPrice, currentHigh, currentLow);

            const rsi15m = calculateRSI(closes15, 14);
            const isPotentialLong = (rsi15m <= prof.rsiLong), isPotentialShort = (rsi15m >= prof.rsiShort);
            if (!isPotentialLong && !isPotentialShort) { rsiNeutralCount++; continue; }

            // Ana Trend Pusulası (1 Saatlik Grafik)
            const klines1h = await fetchUniversalKlines(symbol, "60", 60);
            await sleep(40);
            if (!klines1h || klines1h.length < 25) continue;
            const closes1h = klines1h.map(k => parseFloat(k[4]));
            const rsi1h = calculateRSI(closes1h, 14);
            const ema50_1h = calculateEMA(closes1h, 50) || calculateEMA(closes1h, 20);
            let mainTrend = currentPrice > ema50_1h && rsi1h >= 48 ? "BULL" : currentPrice < ema50_1h && rsi1h <= 52 ? "BEAR" : "NEUTRAL";

            // Makro Güvenlik Filtresi ve Bilgilendirme (4 Saatlik Grafik)
            const klines4h = await fetchUniversalKlines(symbol, "240", 60);
            await sleep(40);
            let candleData = { reportText: "⚠️ 4H Verisi Alınamadı", isBearDominance: false, isBullDominance: false };
            if (klines4h && klines4h.length >= 20) candleData = analyze4HCandles(klines4h);
            
            const lsData = await fetchLongShortRatio(symbol);
            const atr15 = calculateATR(highs15, lows15, closes15, 14);
            const cleanSymbol = symbol.replace('USDT', '');
            let signal = null;

            // LONG Tetiği: 1H Trend Boğa İSE ve 4H'ta devasa bir Ayı çöküşü YOKSA
            const hasLowerWick = (Math.min(currentOpen, currentPrice) - currentLow) >= (Math.abs(currentPrice - currentOpen) * 0.25);
            if (isPotentialLong && mainTrend === "BULL" && hasLowerWick && btc.btcTrend !== "DUMP" && lsData.longPct < prof.maxLsRatio && !candleData.isBearDominance) {
                const stopDist = atr15 ? Math.max(atr15 * prof.atrMultiplier, currentPrice * 0.011) : currentPrice * 0.013;
                signal = { type: "🟢 LONG", rawEntry: currentPrice, rawSl: currentPrice - stopDist, rawTp1: currentPrice + (stopDist * 1.25), rawTp2: currentPrice + (stopDist * 2.5), sl: formatPrice(currentPrice - stopDist, currentPrice), tp1: formatPrice(currentPrice + (stopDist * 1.25), currentPrice), tp2: formatPrice(currentPrice + (stopDist * 2.5), currentPrice), tp1Pct: ((((currentPrice + (stopDist * 1.25)) - currentPrice) / currentPrice) * 100).toFixed(2), reason: `1H Trend Boğa (RSI: ${rsi1h}), 15M Düzeltme (${rsi15m} <= ${prof.rsiLong})` };
            }

            // SHORT Tetiği: 1H Trend Ayı İSE ve 4H'ta devasa bir Boğa rallisi YOKSA
            const hasUpperWick = (currentHigh - Math.max(currentOpen, currentPrice)) >= (Math.abs(currentPrice - currentOpen) * 0.25);
            if (isPotentialShort && mainTrend === "BEAR" && hasUpperWick && btc.btcTrend !== "PUMP" && lsData.shortPct < prof.maxLsRatio && !candleData.isBullDominance) {
                const stopDist = atr15 ? Math.max(atr15 * prof.atrMultiplier, currentPrice * 0.011) : currentPrice * 0.013;
                signal = { type: "🔴 SHORT", rawEntry: currentPrice, rawSl: currentPrice + stopDist, rawTp1: currentPrice - (stopDist * 1.25), rawTp2: currentPrice - (stopDist * 2.5), sl: formatPrice(currentPrice + stopDist, currentPrice), tp1: formatPrice(currentPrice - (stopDist * 1.25), currentPrice), tp2: formatPrice(currentPrice - (stopDist * 2.5), currentPrice), tp1Pct: (((currentPrice - (currentPrice - (stopDist * 1.25))) / currentPrice) * 100).toFixed(2), reason: `1H Trend Ayı (RSI: ${rsi1h}), 15M Tepki (${rsi15m} >= ${prof.rsiShort})` };
            }

            if (!signal && (isPotentialLong || isPotentialShort)) trendBlockedCount++;

            const lastAlertTime = alertedCoins.get(symbol) || 0;
            if (signal && !activeTrades.has(symbol) && (Date.now() - lastAlertTime >= 25 * 60 * 1000)) {
                const msg = `👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n🎯 <b>ADAPTİF PRO SİNYAL (1H + 15M)</b> 🎯\n\n🪙 <b>Coin:</b> #${cleanSymbol}/USDT\n🎯 <b>Yön:</b> ${signal.type}\n💵 <b>Giriş Fiyatı:</b> $${formatPrice(currentPrice, currentPrice)}\n🛑 <b>Önerilen Stop:</b> $${signal.sl}\n⚖️ <b>Önerilen Kaldıraç:</b> 5x – 10x\n\n🎯 <b>Kademeli Kâr Hedefleri:</b>\n• <b>TP1 (İlk Kâr - %${signal.tp1Pct}):</b> $${signal.tp1}\n• <b>TP2 (Trend Kârı):</b> $${signal.tp2}\n\n⚙️ <b>Coin Özel Parametresi:</b>\n• Profil: ${prof.category}\n\n${lsData.text}\n\n${candleData.reportText}\n\n🔗 <a href="https://www.binance.com/tr/futures/${symbol}">Binance Futures'ta Aç</a>\n\n⚠️ <i>"YTD" HEPSİ.</i>`;
                await sendTelegramMessage(msg);
                alertedCoins.set(symbol, Date.now());
                activeTrades.set(symbol, { side: signal.type.includes('LONG') ? 'LONG' : 'SHORT', entry: signal.rawEntry, sl: signal.rawSl, tp1: signal.rawTp1, tp2: signal.rawTp2, tp1Hit: false, time: Date.now() });
                signalSentInThisCycle = true;
            }
        }

        // TAM 10 DAKİKADA BİR RAPOR
        if (!signalSentInThisCycle && (Date.now() - lastStatusReportTime >= 10 * 60 * 1000)) {
            await sendTelegramMessage(`👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n⏳ <b>[${getTurkishTimeString()}] ÇİFT ZAMAN DİLİMİ RAPORU (1H + 15M)</b>\n\n🌐 <b>Aktif Seans:</b> ${session}\n📊 <b>İncelenen:</b> ${scannedCount} Parite\n⚡ <b>BTC Durumu:</b> %${btc.change15m}\n\n🔍 <b>Neden Sinyal Çıkmadı?</b>\n• <b>Nötr RSI Bölgesi:</b> ${rsiNeutralCount} Parite\n• <b>1H/4H Filtre Kilidine Takılan:</b> ${trendBlockedCount} Parite\n\n${getStatsText()}\n\n⚠️ <i>"YTD" HEPSİ.</i>`);
            lastStatusReportTime = Date.now();
        }
    } catch (err) {}
}

// ==========================================
// 8. ANA ÇALIŞTIRICI
// ==========================================
async function runLoop() {
    console.log("🚀 ScalpPro Başlatıldı...");
    sendTelegramMessage("🤖 <b>Sistem Güncellendi:</b> Ana trend 1 Saatlik (1H) grafiğe çekildi. Hızlandırılmış Scalp modu devrede, 4 Saatlik grafik (4H) bilgi ekranı olarak bırakıldı.");
    
    (async () => { while (true) { await pollTelegramUpdates(); await sleep(1500); } })();
    while (true) { await scanMarket(); await sleep(15000); }
}

runLoop();
