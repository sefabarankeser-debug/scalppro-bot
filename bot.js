process.on('uncaughtException', (err) => {
    console.error('Kritik Hata Yakalandı:', err.message);
});

process.on('unhandledRejection', (reason) => {
    console.error('İşlenmeyen Promise Hatası:', reason);
});

const http = require('http');
const https = require('https');

// ==========================================
// 1. RENDER PORT & SABİT TELEGRAM BİLGİLERİ
// ==========================================
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ScalpPro Adaptive AI + Balanced Sensitivity Active\n');
}).listen(PORT, '0.0.0.0', () => {
    console.log(`Sunucu ${PORT} portunda aktif.`);
});

const TELEGRAM_TOKEN = "8930276912:AAE4xogVFRIqIjPuJ97RqHJFuHvFexNxt2k";
const CHAT_ID = "-1004412694884";

// ==========================================
// 2. DENGELENMİŞ ADAPTİF PROFİLLER
// ==========================================
const BASE_PROFILES = {
    MAJOR: {
        category: "💎 Majör / Trend Sadık",
        rsiLong: 40,
        rsiShort: 60,
        atrMultiplier: 1.3,
        maxLsRatio: 68
    },
    MEME: {
        category: "🐸 Meme / Ekstrem Volatilite",
        rsiLong: 33,
        rsiShort: 68,
        atrMultiplier: 2.0,
        maxLsRatio: 64
    },
    VOLATILE_ALT: {
        category: "⚡ Sığ Tahta / Yüksek Oynaklık",
        rsiLong: 35,
        rsiShort: 65,
        atrMultiplier: 1.8,
        maxLsRatio: 62
    }
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
        dynamicCoinMemory.set(symbol, {
            group,
            category: base.category,
            rsiLong: base.rsiLong,
            rsiShort: base.rsiShort,
            atrMultiplier: base.atrMultiplier,
            maxLsRatio: base.maxLsRatio,
            consecutiveStops: 0,
            totalTps: 0,
            totalStops: 0,
            quarantineUntil: 0
        });
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
            sendTelegramMessage(`🛡️ <b>${symbol} 24 Saat Karantinaya Alındı!</b>\nPeş peşe 3 stop nedeniyle parametreler optimize edilene kadar sinyaller durduruldu.`);
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
const processedNewsIds = new Set();
const tradeHistory = [];

let lastStatusReportTime = 0;
let lastNewsCheckTime = 0;

let lastNotifiedEvents = {
    date: "",
    approachingNY: false,
    openNY: false,
    closeNY: false
};

const TARGET_COINS = Object.keys(COIN_ASSIGNMENTS);

const COIN_ALIASES = {
    "CFX": ["conflux", "cfx"], "DYM": ["dymension", "dym"], "NOT": ["notcoin", "not"],
    "JUP": ["jupiter", "jup"], "INJ": ["injective", "inj"], "STX": ["stacks", "stx"],
    "PENDLE": ["pendle"], "GMX": ["gmx"], "STRK": ["starknet", "strk"],
    "PYTH": ["pyth network", "pyth"], "W":
