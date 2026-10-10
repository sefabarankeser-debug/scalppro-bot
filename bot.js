process.on('uncaughtException', (err) => {
    console.error('Kritik Hata Yakalandı:', err.message);
});

process.on('unhandledRejection', (reason) => {
    console.error('İşlenmeyen Promise Hatası:', reason);
});

const http = require('http');

const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ScalpPro 40-Coin Dedicated Engine with Live Tracking Active\n');
}).listen(PORT, '0.0.0.0', () => {
    console.log(`Sunucu ${PORT} portunda aktif.`);
});

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8930276912:AAE4xogVFRIqIjPuJ97RqHJFuHvFexNxt2k";
const CHAT_ID = process.env.CHAT_ID || "-1004412694884";

const alertedCoins = new Map();
const spikeAlertedCoins = new Map();
const activeTrades = new Map();
const processedNewsIds = new Set();
let lastStatusReportTime = 0;
let lastNewsCheckTime = 0;

let lastNotifiedEvents = {
    date: "",
    approachingNY: false,
    openNY: false,
    closeNY: false
};

const TARGET_COINS = [
    "SOLUSDT", "DOGEUSDT", "SUIUSDT", "1000PEPEUSDT", "AVAXUSDT",
    "NEARUSDT", "WIFUSDT", "APTUSDT", "1000SHIBUSDT", "TAOUSDT",
    "FETUSDT", "SEIUSDT", "ARKMUSDT", "RENDERUSDT", "INJUSDT",
    "ARBUSDT", "OPUSDT", "TIAUSDT", "NOTUSDT", "1000FLOKIUSDT",
    "1000BONKUSDT", "BCHUSDT", "PENDLEUSDT", "GALAUSDT", "STXUSDT",
    "ORDIUSDT", "RUNEUSDT", "AAVEUSDT", "LDOUSDT", "WLDUSDT",
    "JUPUSDT", "ENAUSDT", "ARUSDT", "CFXUSDT", "JTOUSDT",
    "CRVUSDT", "NEIROUSDT", "DYDXUSDT", "GMXUSDT", "UNIUSDT"
];

const CRITICAL_KEYWORDS = [
    "sec", "fed", "powell", "binance", "tether", "etf", "interest rate",
    "inflation", "cpi", "hack", "liquidation", "ban", "lawsuit", "court", "war", "tariff"
];

const defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json'
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getTurkishTimeString() {
    return new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' });
}

function formatPrice(val, basePrice) {
    if (!val || isNaN(val)) return "0.00";
    const ref = basePrice || val;
    let decimals = 4;
    if (ref < 0.001) decimals = 7;
    else if (ref < 0.1) decimals = 6;
    else if (ref < 1) decimals = 5;
    else if (ref < 10) decimals = 4;
    else if (ref < 1000) decimals = 2;
    else decimals = 1;
    return Number(val).toFixed(decimals);
}

function getMarketParameters() {
    const now = new Date();
    const trHour = (now.getUTCHours() + 3) % 24;

    if (trHour >= 2 && trHour < 10) {
        return {
            sessionName: "🌏 Asya Seansı",
            rsiShort: 68,
            rsiLong: 32,
            minVolMultiplier: 1.05,
            wallThreshold: 180000
        };
    }

    if (trHour >= 10 && trHour < 16) {
        return {
            sessionName: "🇪🇺 Londra Seansı",
            rsiShort: 70,
            rsiLong: 30,
            minVolMultiplier: 1.25,
            wallThreshold: 220000
        };
    }

    return {
        sessionName: "🗽 New York Seansı",
        rsiShort: 73,
        rsiLong: 27,
        minVolMultiplier: 1.40,
        wallThreshold: 260000
    };
}

async function sendTelegramMessage(text) {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: text,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        });
        const data = await response.json();
        if (!data.ok) {
            console.error("🔴 Telegram Hatası:", data.description);
        }
    } catch (e) {
        console.error("🔴 Telegram Ağ Hatası:", e.message);
    }
}

async function checkBreakingNews() {
    try {
        const now = Date.now();
        if (now - lastNewsCheckTime < 2 * 60 * 1000) return;
        lastNewsCheckTime = now;

        const res = await fetch('https://cryptopanic.com/api/free/v1/posts/?public=true', { headers: defaultHeaders });
        if (!res.ok) return;
        const data = await res.json();

        if (!data || !data.results || !Array.isArray(data.results)) return;

        for (const item of data.results.slice(0, 5)) {
            const newsId = item.id.toString();
            if (processedNewsIds.has(newsId)) continue;
            processedNewsIds.add(newsId);

            if (processedNewsIds.size > 200) {
                const firstKey = processedNewsIds.values().next().value;
                processedNewsIds.delete(firstKey);
            }

            const title = (item.title || "").trim();
            const lowerTitle = title.toLowerCase();

            let matchedCoin = null;
            for (const sym of TARGET_COINS) {
                const clean = sym.replace('USDT', '').replace('1000', '');
                const regex = new RegExp(`\\b${clean}\\b`, 'i');
                if (regex.test(lowerTitle)) {
                    matchedCoin = clean;
                    break;
                }
            }

            const isMacroOrBtc = lowerTitle.includes('bitcoin') || lowerTitle.includes('btc') ||
                                 CRITICAL_KEYWORDS.some(kw => lowerTitle.includes(kw));

            if (matchedCoin) {
                const newsMsg = `👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n` +
                                `📰 <b>FLAŞ HABER RADARI | #${matchedCoin}</b>\n\n` +
                                `📢 <b>Başlık:</b> ${title}\n\n` +
                                `⚠️ <b>Etki:</b> Paritede volatilite ve hacim artışı bekleniyor!\n\n` +
                                `⚠️ <i>"YTD" HEPSİ.</i>`;
                await sendTelegramMessage(newsMsg);
                await sleep(1200);
            } else if (isMacroOrBtc) {
                const macroMsg = `👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n` +
                                 `🚨 <b>PİYASA GENELİ SICAK GELİŞME (BTC / MAKRO)</b>\n\n` +
                                 `📢 <b>Haber:</b> ${title}\n\n` +
                                 `🛑 Dalgalanma durumunda sinyaller kilitlenebilir.\n\n` +
                                 `⚠️ <i>"YTD" HEPSİ.</i>`;
                await sendTelegramMessage(macroMsg);
                await sleep(1200);
            }
        }
    } catch (e) {
        console.error("Haber servisi okunamadı:", e.message);
    }
}

async function checkSessionAlerts() {
    const now = new Date();
    const trHour = (now.getUTCHours() + 3) % 24;
    const trMinute = now.getUTCMinutes();
    const todayStr = now.toISOString().slice(0, 10);

    if (lastNotifiedEvents.date !== todayStr) {
        lastNotifiedEvents = {
            date: todayStr,
            approachingNY: false,
            openNY: false,
            closeNY: false
        };
    }

    if (trHour === 16 && trMinute >= 0 && trMinute < 10 && !lastNotifiedEvents.approachingNY) {
        const msg = `👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n` +
                    `⏳ <b>DİKKAT: EN HAREKETLİ SEANSA 30 DAKİKA KALDI!</b>\n\n` +
                    `🗽 <b>16:30'da ABD (Wall Street) Piyasaları Açılıyor!</b>\n` +
                    `• ETF işlemleri ve küresel fonlar piyasaya girmek üzere.\n` +
                    `• Botumuz yüksek likidite moduna (Sıkı Filtreler) hazırlanıyor.\n\n` +
                    `⚠️ <i>"YTD" HEPSİ.</i>`;
        await sendTelegramMessage(msg);
        lastNotifiedEvents.approachingNY = true;
    }

    if (trHour === 16 && trMinute >= 30 && trMinute < 40 && !lastNotifiedEvents.openNY) {
        const msg = `👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n` +
                    `🔥 <b>NEW YORK (WALL STREET) SEANSI RESMEN AÇILDI!</b>\n\n` +
                    `⚡ Günün en yüksek hacimli ve sert seansı başladı.\n` +
                    `• Filtreler en katı seviyede (RSI 27/73 - Hacim 1.4x).\n\n` +
                    `⚠️ <i>"YTD" HEPSİ.</i>`;
        await sendTelegramMessage(msg);
        lastNotifiedEvents.openNY = true;
    }

    if (trHour === 23 && trMinute >= 0 && trMinute < 10 && !lastNotifiedEvents.closeNY) {
        const msg = `👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n` +
                    `🌙 <b>NEW YORK SEANSI KAPANDI (PİYASA SAKİNLEŞİYOR)</b>\n\n` +
                    `💤 ABD borsaları kapandı, ana hacim dalgası sona erdi.\n` +
                    `• Piyasa yatay banda geçiyor.\n\n` +
                    `⚠️ <i>"YTD" HEPSİ.</i>`;
        await sendTelegramMessage(msg);
        lastNotifiedEvents.closeNY = true;
    }
}

function calculateRSI(klines, period = 14) {
    if (!Array.isArray(klines) || klines.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        let diff = parseFloat(klines[i][4]) - parseFloat(klines[i - 1][4]);
        if (diff >= 0) gains += diff;
        else losses += Math.abs(diff);
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < klines.length; i++) {
        let diff = parseFloat(klines[i][4]) - parseFloat(klines[i - 1][4]);
        if (diff >= 0) {
            avgGain = (avgGain * 13 + diff) / 14;
            avgLoss = (avgLoss * 13) / 14;
        } else {
            avgGain = (avgGain * 13 + diff) / 14;
            avgLoss = (avgLoss * 13 + Math.abs(diff)) / 14;
        }
    }
    if (avgLoss === 0) return 100;
    if (avgGain === 0) return 0;
    const rs = avgGain / avgLoss;
    const rsi = Math.round(100 - (100 / (1 + rs)));
    return Math.max(0, Math.min(100, rsi));
}

function calculateBollinger(klines, period = 20, multiplier = 2) {
    if (!Array.isArray(klines) || klines.length < period) return null;
    const slice = klines.slice(-period).map(k => parseFloat(k[4]));
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    return {
        middle: mean,
        upper: mean + (multiplier * stdDev),
        lower: mean - (multiplier * stdDev)
    };
}

async function fetchOrderBookWall(symbol, threshold) {
    try {
        const res = await fetch(`https://fapi.binance.com/fapi/v1/depth?symbol=${symbol}&limit=20`, { headers: defaultHeaders });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data || !data.bids || !data.asks) return null;

        let maxAskWall = 0, maxBidWall = 0;
        data.asks.forEach(a => {
            const val = parseFloat(a[0]) * parseFloat(a[1]);
            if (val > maxAskWall) maxAskWall = val;
        });
        data.bids.forEach(b => {
            const val = parseFloat(b[0]) * parseFloat(b[1]);
            if (val > maxBidWall) maxBidWall = val;
        });

        if (maxAskWall >= threshold) return `🧱 $${(maxAskWall / 1000).toFixed(0)}K Satış Duvarı`;
        if (maxBidWall >= threshold) return `🧱 $${(maxBidWall / 1000).toFixed(0)}K Alış Duvarı`;
        return null;
    } catch (e) {
        return null;
    }
}

async function checkBtcCondition() {
    try {
        const res = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=1m&limit=5`, { headers: defaultHeaders });
        if (!res.ok) return { safe: true, btcTrend: "NEUTRAL", change3m: "0.00" };
        const klines = await res.json();
        if (!Array.isArray(klines) || klines.length < 4) return { safe: true, btcTrend: "NEUTRAL", change3m: "0.00" };

        const currentPrice = parseFloat(klines[klines.length - 1][4]);
        const price3mAgo = parseFloat(klines[klines.length - 4][1]);
        const change3m = ((currentPrice - price3mAgo) / price3mAgo) * 100;

        const isVolatile = Math.abs(change3m) >= 0.48;
        let btcTrend = "NEUTRAL";
        if (change3m <= -0.25) btcTrend = "DUMP";
        else if (change3m >= 0.25) btcTrend = "PUMP";

        return {
            safe: !isVolatile,
            btcTrend,
            change3m: change3m.toFixed(2),
            currentBtcPrice: currentPrice
        };
    } catch (e) {
        return { safe: true, btcTrend: "NEUTRAL", change3m: "0.00" };
    }
}

async function fetchAnalysis(symbol) {
    try {
        const res1m = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1m&limit=50`, { headers: defaultHeaders });
        if (!res1m.ok) return null;
        const klines1m = await res1m.json();
        if (!Array.isArray(klines1m) || klines1m.length < 25) return null;

        const lastCandle = klines1m[klines1m.length - 1];
        const prevCandle = klines1m[klines1m.length - 2];

        const openPrice = parseFloat(lastCandle[1]);
        const highPrice = parseFloat(lastCandle[2]);
        const lowPrice = parseFloat(lastCandle[3]);
        const currentPrice = parseFloat(lastCandle[4]);

        const prevHigh = parseFloat(prevCandle[2]);
        const prevLow = parseFloat(prevCandle[3]);

        const rsi1m = calculateRSI(klines1m);
        const bb = calculateBollinger(klines1m, 20, 2);

        const currentVol = parseFloat(lastCandle[5]);
        const pastVols = klines1m.slice(-21, -1).map(k => parseFloat(k[5]));
        const avgVol = pastVols.length > 0 ? (pastVols.reduce((a, b) => a + b, 0) / pastVols.length) : 1;
        const volMultiplier = avgVol > 0 ? (currentVol / avgVol).toFixed(1) : 1;

        return {
            symbol,
            currentPrice,
            openPrice,
            highPrice,
            lowPrice,
            prevHigh,
            prevLow,
            rsi1m,
            bb,
            volMultiplier
        };
    } catch (e) {
        return null;
    }
}

async function checkActiveTrades(symbol, currentPrice) {
    const trade = activeTrades.get(symbol);
    if (!trade) return;

    const cleanSymbol = symbol.replace('USDT', '');
    const nowTime = getTurkishTimeString();

    if (trade.side === 'LONG') {
        if (!trade.tp1Hit && currentPrice >= trade.tp1) {
            trade.tp1Hit = true;
            trade.sl = trade.entry;
            const gainPct = (((trade.tp1 - trade.entry) / trade.entry) * 100).toFixed(2);
            const tp1Msg = `✅ <b>HEDEF GELDİ! (TP1 AL
