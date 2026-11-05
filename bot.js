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
const zlib = require('zlib');
const crypto = require('crypto');

// ==========================================
// 1. RENDER PORT & SABİT TELEGRAM BİLGİLERİ
// ==========================================
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ScalpPro Quant V6 Pro - Dynamic Risk Shield, Dominance & Live Binance Auto-Trade Active\n');
}).listen(PORT, '0.0.0.0', () => {
    console.log(`Sunucu ${PORT} portunda dinlemede.`);
});

const TELEGRAM_TOKEN = "8930276912:AAE4xogVFRIqIjPuJ97RqHJFuHvFexNxt2k";
const CHAT_ID = "-1004412694884";

// ==========================================
// 2. BİNANCE FUTURES GERÇEK İŞLEM MOTORU
// ==========================================
const BINANCE_API_KEY = process.env.BINANCE_API_KEY ? process.env.BINANCE_API_KEY.trim() : "";
const BINANCE_API_SECRET = process.env.BINANCE_API_SECRET ? process.env.BINANCE_API_SECRET.trim() : "";
const TRADE_AMOUNT_USDT = parseFloat(process.env.TRADE_AMOUNT) || 5;

const symbolPrecisionMap = new Map();

function signBinanceQuery(queryString) {
    return crypto.createHmac('sha256', BINANCE_API_SECRET).update(queryString).digest('hex');
}

function binanceSignedRequest(apiPath, method = 'POST', params = {}) {
    return new Promise((resolve) => {
        if (!BINANCE_API_KEY || !BINANCE_API_SECRET) {
            return resolve(null);
        }
        const timestamp = Date.now();
        const queryObj = { ...params, timestamp, recvWindow: 6000 };
        const queryString = Object.keys(queryObj)
            .map(k => `${k}=${encodeURIComponent(queryObj[k])}`)
            .join('&');
        const signature = signBinanceQuery(queryString);
        const fullPath = `${apiPath}?${queryString}&signature=${signature}`;

        const options = {
            hostname: 'fapi.binance.com',
            port: 443,
            path: fullPath,
            method: method,
            headers: {
                'X-MBX-APIKEY': BINANCE_API_KEY,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 8000
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (e) {
                    resolve(null);
                }
            });
        });
        req.on('timeout', () => { req.destroy(); resolve(null); });
        req.on('error', () => { resolve(null); });
        req.end();
    });
}

async function initBinanceExchangeInfo() {
    try {
        const info = await fetchJSON("https://fapi.binance.com/fapi/v1/exchangeInfo", {}, 8000);
        if (info && Array.isArray(info.symbols)) {
            for (const s of info.symbols) {
                const stepFilter = s.filters?.find(f => f.filterType === 'LOT_SIZE');
                symbolPrecisionMap.set(s.symbol, {
                    quantityPrecision: s.quantityPrecision || 0,
                    stepSize: stepFilter ? parseFloat(stepFilter.stepSize) : 0.001
                });
            }
        }
    } catch (e) {}
}

function formatQuantity(symbol, qty) {
    const meta = symbolPrecisionMap.get(symbol);
    if (!meta) return Number(qty.toFixed(2));
    const step = meta.stepSize;
    const rounded = Math.floor(qty / step) * step;
    return Number(rounded.toFixed(meta.quantityPrecision));
}

async function closeBinancePosition(trade, symbol) {
    if (!trade || !trade.isLiveOrder || !trade.executedQty || trade.executedQty <= 0) return;
    try {
        const closeSide = trade.side === 'LONG' ? 'SELL' : 'BUY';
        await binanceSignedRequest('/fapi/v1/order', 'POST', {
            symbol: symbol,
            side: closeSide,
            type: 'MARKET',
            quantity: trade.executedQty,
            reduceOnly: 'true'
        });
    } catch (e) {}
}

let maxTotalActiveTrades = 12;
let maxSameSideTrades = 8;

const BASE_PROFILES = {
    MAJOR: { category: "💎 Majör / Trend Sadık", stochLong: 30, stochShort: 70, atrMultiplier: 1.50, maxLsRatio: 66 },
    MEME: { category: "🐸 Meme / Ekstrem Volatilite", stochLong: 32, stochShort: 68, atrMultiplier: 2.00, maxLsRatio: 62 },
    VOLATILE_ALT: { category: "⚡ Sığ Tahta / Yüksek Oynaklık", stochLong: 32, stochShort: 68, atrMultiplier: 1.80, maxLsRatio: 62 }
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
const klineCache = new Map();

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
    saveWalletState();
}

const WALLET_FILE = path.join(__dirname, 'kasa_yedek.json');
let lastUpdateId = 0;
const alertedCoins = new Map();
const activeTrades = new Map();
let tradeHistory = [];
let walletStartTime = Date.now();
let customStartingBalance = 1000;
let lastStatusReportTime = 0;
let cloudMessageId = null;
let cloudSyncTimer = null;

function encodeCloudState() {
    try {
        const memEntries = [];
        for (const [k, v] of dynamicCoinMemory.entries()) {
            if (v.consecutiveStops > 0 || v.totalTps > 0 || v.totalStops > 0 || v.quarantineUntil > Date.now()) {
                memEntries.push([k, { cs: v.consecutiveStops, tp: v.totalTps, st: v.totalStops, q: v.quarantineUntil, sl: v.stochLong, ss: v.stochShort, atr: v.atrMultiplier }]);
            }
        }
        const stateObj = {
            wStart: walletStartTime,
            bal: customStartingBalance,
            active: Array.from(activeTrades.entries()),
            hist: tradeHistory.slice(-200),
            mem: memEntries,
            cMsgId: cloudMessageId,
            maxSide: maxSameSideTrades,
            maxTotal: maxTotalActiveTrades
        };
        return zlib.deflateSync(Buffer.from(JSON.stringify(stateObj), 'utf8')).toString('base64');
    } catch (e) {
        return "";
    }
}

function decodeAndApplyCloudState(base64Str) {
    try {
        const rawJson = zlib.inflateSync(Buffer.from(base64Str.trim(), 'base64')).toString('utf8');
        const parsed = JSON.parse(rawJson);
        if (parsed.wStart) walletStartTime = parsed.wStart;
        if (parsed.bal !== undefined) customStartingBalance = parsed.bal;
        if (Array.isArray(parsed.hist)) tradeHistory = parsed.hist;
        if (parsed.cMsgId) cloudMessageId = parsed.cMsgId;
        if (parsed.maxSide && parsed.maxSide >= 1) maxSameSideTrades = parsed.maxSide;
        if (parsed.maxTotal && parsed.maxTotal >= 1) maxTotalActiveTrades = parsed.maxTotal;

        if (Array.isArray(parsed.active)) {
            activeTrades.clear();
            for (const [sym, tradeObj] of parsed.active) {
                activeTrades.set(sym, tradeObj);
            }
        }
        if (Array.isArray(parsed.mem)) {
            for (const [sym, m] of parsed.mem) {
                const prof = getCoinProfile(sym);
                prof.consecutiveStops = m.cs || 0;
                prof.totalTps = m.tp || 0;
                prof.totalStops = m.st || 0;
                prof.quarantineUntil = m.q || 0;
                if (m.sl) prof.stochLong = m.sl;
                if (m.ss) prof.stochShort = m.ss;
                if (m.atr) prof.atrMultiplier = m.atr;
            }
        }
        saveLocalFileOnly();
        return true;
    } catch (e) {
        return false;
    }
}

function saveLocalFileOnly() {
    try {
        const payload = {
            walletStartTime,
            customStartingBalance,
            tradeHistory,
            activeTrades: Array.from(activeTrades.entries()),
            cloudMessageId,
            maxSameSideTrades,
            maxTotalActiveTrades
        };
        fs.writeFileSync(WALLET_FILE, JSON.stringify(payload), 'utf8');
    } catch (e) {}
}

function loadWalletState() {
    try {
        if (fs.existsSync(WALLET_FILE)) {
            const raw = fs.readFileSync(WALLET_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.tradeHistory)) tradeHistory = parsed.tradeHistory;
            if (parsed.walletStartTime) walletStartTime = parsed.walletStartTime;
            if (parsed.customStartingBalance) customStartingBalance = parsed.customStartingBalance;
            if (parsed.cloudMessageId) cloudMessageId = parsed.cloudMessageId;
            if (parsed.maxSameSideTrades) maxSameSideTrades = parsed.maxSameSideTrades;
            if (parsed.maxTotalActiveTrades) maxTotalActiveTrades = parsed.maxTotalActiveTrades;
            if (Array.isArray(parsed.activeTrades)) {
                for (const [sym, t] of parsed.activeTrades) activeTrades.set(sym, t);
            }
        }
    } catch (e) {}
}

function scheduleCloudBackup() {
    if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(async () => {
        await syncStateToTelegramCloud();
    }, 2500);
}

function saveWalletState() {
    saveLocalFileOnly();
    scheduleCloudBackup();
}

function recordTradeEvent(type, symbol = '', dollarImpact = 0) {
    tradeHistory.push({ type, symbol, dollarImpact: parseFloat(dollarImpact.toFixed(4)), time: Date.now() });
    saveWalletState();
}

function resetPermanentWallet(newBalance = 1000) {
    tradeHistory = [];
    customStartingBalance = newBalance;
    walletStartTime = Date.now();
    saveWalletState();
}

function calculateCurrentBalance() {
    let balance = customStartingBalance;
    for (const t of tradeHistory) {
        if (t.dollarImpact !== undefined && !isNaN(t.dollarImpact)) {
            balance += t.dollarImpact;
        }
    }
    return Math.max(0, parseFloat(balance.toFixed(2)));
}

loadWalletState();

const TARGET_COINS = Object.keys(COIN_ASSIGNMENTS);
const FUZZY_MAP = {
    "DMY": "DYM", "PEP": "1000PEPE", "PEPE": "1000PEPE", "SHIBA": "1000SHIB", "SHIB": "1000SHIB",
    "DOG": "DOGE", "FLOK": "1000FLOKI", "FLOKI": "1000FLOKI", "BON": "1000BONK", "BONK": "1000BONK",
    "LNK": "LINK", "AVX": "AVAX", "NOTC": "NOT", "STR": "STRK", "APTOS": "APT", "POL": "POL",
    "MATIC": "POL", "RNDR": "RENDER", "ASI": "FET", "TRX": "TRX", "HYPE": "HYPE", "ZEC": "ZEC"
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

function normalizeCommandText(text) {
    if (!text) return "";
    return text.trim().toLowerCase()
        .replace(/ç/g, 'c')
        .replace(/ğ/g, 'g')
        .replace(/ı/g, 'i')
        .replace(/i̇/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ş/g, 's')
        .replace(/ü/g, 'u');
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

    const currentBal = calculateCurrentBalance();
    const netDiff = currentBal - customStartingBalance;
    const netGainPct = customStartingBalance > 0 ? ((netDiff / customStartingBalance) * 100).toFixed(2) : "0.00";
    const sign = netDiff >= 0 ? "+" : "";
    const colorIcon = netDiff >= 0 ? "🟢" : "🔴";
    const totalWinRate = totalTrades > 0 ? (((tp1Count + tp2Count) / totalTrades) * 100).toFixed(1) : "0.0";

    const text1 = getWindowCountsText(1);
    const text12 = getWindowCountsText(12);

    return `📊 <b>Canlı Başarı & Bileşik Kasa Simülasyonu:</b>\n${text1}\n${text12}\n• <b>Toplam Genel:</b> ${tp1Count} TP1 | ${tp2Count} TP2 | ${stopCount} Stop (%${totalWinRate} Win Rate)\n  ↳ ${colorIcon} <b>Güncel Bileşik Kasa:</b> <b>$${currentBal.toFixed(2)}</b> <i>(Başlangıç: $${customStartingBalance} | Net: <b>${sign}$${netDiff.toFixed(2)} / ${sign}%${netGainPct}</b>)</i>`;
}

function getActiveSessionName() {
    const trHour = (new Date().getUTCHours() + 3) % 24;
    return trHour >= 2 && trHour < 10 ? "🌏 Asya Seansı" : trHour >= 10 && trHour < 16 ? "🇪🇺 Londra Seansı" : "🗽 New York Seansı";
}

function fetchJSON(url, customHeaders = {}, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
        const headers = Object.assign({ 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, customHeaders);
        const req = https.get(url, { headers, timeout: timeoutMs }, (res) => {
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

function telegramApiCall(method, payloadObj) {
    return new Promise((resolve) => {
        const payload = JSON.stringify(payloadObj);
        const req = https.request({
            hostname: 'api.telegram.org', port: 443, path: `/bot${TELEGRAM_TOKEN}/${method}`, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
            timeout: 8000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { resolve({ ok: false }); }
            });
        });
        req.on('timeout', () => { req.destroy(); resolve({ ok: false }); });
        req.on('error', () => resolve({ ok: false }));
        req.write(payload);
        req.end();
    });
}

async function sendTelegramMessage(text, replyToId = null) {
    const payloadObj = { chat_id: CHAT_ID, text: text, parse_mode: 'HTML', disable_web_page_preview: true };
    if (replyToId) payloadObj.reply_to_message_id = replyToId;
    const res = await telegramApiCall('sendMessage', payloadObj);
    return res && res.ok ? res.result : null;
}

async function syncStateToTelegramCloud() {
    try {
        const code = encodeCloudState();
        if (!code) return;
        const currentBal = calculateCurrentBalance();
        const cloudText = `☁️ <b>[SCALPPRO BULUT HAFIZA SİSTEMİ]</b>\n<i>Bu sabitlenmiş mesaj, bot güncellendiğinde açık işlemlerin ve kasanın silinmemesi için otomatik güncellenir.</i>\n\n💼 <b>Güncel Bileşik Kasa:</b> $${currentBal.toFixed(2)} | 📂 <b>Açık İşlem:</b> ${activeTrades.size}/${maxTotalActiveTrades} (Tek Yön: ${maxSameSideTrades})\n⏱ <b>Son Yedek:</b> ${getTurkishTimeString()}\n\n<pre>[CLOUD_STATE:${code}]</pre>`;

        if (cloudMessageId) {
            const editRes = await telegramApiCall('editMessageText', {
                chat_id: CHAT_ID,
                message_id: cloudMessageId,
                text: cloudText,
                parse_mode: 'HTML'
            });
            if (editRes && editRes.ok) return;
        }

        const sentMsg = await sendTelegramMessage(cloudText);
        if (sentMsg && sentMsg.message_id) {
            cloudMessageId = sentMsg.message_id;
            saveLocalFileOnly();
            await telegramApiCall('pinChatMessage', {
                chat_id: CHAT_ID,
                message_id: cloudMessageId,
                disable_notification: true
            });
        }
    } catch (e) {}
}

async function restoreFromTelegramCloudOnStartup() {
    try {
        const chatRes = await fetchJSON(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getChat?chat_id=${CHAT_ID}`);
        if (chatRes && chatRes.ok && chatRes.result && chatRes.result.pinned_message) {
            const pinned = chatRes.result.pinned_message;
            const txt = pinned.text || "";
            const match = txt.match(/\[CLOUD_STATE:([A-Za-z0-9+/=]+)\]/);
            if (match && match[1]) {
                const ok = decodeAndApplyCloudState(match[1]);
                cloudMessageId = pinned.message_id;
                if (ok) return true;
            }
        }
    } catch (e) {}
    return false;
}

let cachedGlobalDom = { btcDom: 56.5, ethDom: 13.5, mcapChange24h: 0, updatedAt: 0 };

async function checkDominanceCondition(btcTrend = "NEUTRAL") {
    if (Date.now() - cachedGlobalDom.updatedAt > 3 * 60 * 1000) {
        try {
            const gRes = await fetchJSON("https://api.coingecko.com/api/v3/global", {}, 5000);
            if (gRes && gRes.data && gRes.data.market_cap_percentage) {
                cachedGlobalDom.btcDom = parseFloat((gRes.data.market_cap_percentage.btc || 56.5).toFixed(2));
                cachedGlobalDom.ethDom = parseFloat((gRes.data.market_cap_percentage.eth || 13.5).toFixed(2));
                cachedGlobalDom.mcapChange24h = parseFloat((gRes.data.market_cap_change_percentage_24h_usd || 0).toFixed(2));
                cachedGlobalDom.updatedAt = Date.now();
            }
        } catch (e) {}
    }

    let domChange15m = 0, domChange1h = 0, domIndexPrice = 0;
    try {
        const domKlines = await fetchJSON("https://fapi.binance.com/fapi/v1/klines?symbol=BTCDOMUSDT&interval=15m&limit=6", {}, 5000);
        if (Array.isArray(domKlines) && domKlines.length >= 5) {
            const curClose = parseFloat(domKlines[domKlines.length - 1][4]);
            const curOpen = parseFloat(domKlines[domKlines.length - 1][1]);
            const prevOpen = parseFloat(domKlines[domKlines.length - 2][1]);
            const open1hAgo = parseFloat(domKlines[domKlines.length - 5][1]);

            domIndexPrice = curClose;
            const c1 = ((curClose - curOpen) / curOpen) * 100;
            const c2 = ((curClose - prevOpen) / prevOpen) * 100;
            domChange15m = parseFloat((Math.abs(c1) > Math.abs(c2) ? c1 : c2).toFixed(2));
            domChange1h = parseFloat((((curClose - open1hAgo) / open1hAgo) * 100).toFixed(2));
        }
    } catch (e) {}

    const isDomRisingFast = domChange15m >= 0.28 || domChange1h >= 0.45;
    const isDomFalling = domChange15m <= -0.15 || domChange1h <= -0.25;

    let regime = "NEUTRAL";
    let badge = `⚖️ Dengeli Akış (BTC.D: %${cachedGlobalDom.btcDom} | 1s: ${domChange1h >= 0 ? '+' : ''}%${domChange1h})`;
    let blockAltLongs = false, boostAltLongs = false, boostAltShorts = false;

    if (isDomRisingFast && btcTrend === "DUMP") {
        regime = "ALT_BLEED"; blockAltLongs = true; boostAltShorts = true;
        badge = `🩸 Altcoin Kanama Kalkanı (BTC.D: %${cachedGlobalDom.btcDom} ⬆️ +%${domChange1h})`;
    } else if (isDomRisingFast) {
        regime = "BTC_SUCKING_LIQUIDITY"; blockAltLongs = true; boostAltShorts = true;
        badge = `⚠️ BTC Likidite Emiyor / Alt Ezilmesi (BTC.D: %${cachedGlobalDom.btcDom} ⬆️ +%${domChange1h})`;
    } else if (isDomFalling && btcTrend !== "DUMP") {
        regime = "ALT_SEASON_FLOW"; boostAltLongs = true;
        badge = `🚀 Altcoin Para Girişi (BTC.D: %${cachedGlobalDom.btcDom} ⬇️ %${domChange1h})`;
    }

    return { btcDom: cachedGlobalDom.btcDom, ethDom: cachedGlobalDom.ethDom, mcapChange24h: cachedGlobalDom.mcapChange24h, domIndexPrice, domChange15m, domChange1h, regime, blockAltLongs, boostAltLongs, boostAltShorts, badge };
}

async function fetchLongShortSizeData(symbol, currentPrice) {
    try {
        const [json, ratioJson] = await Promise.all([
            fetchJSON(`https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${symbol}&intervalTime=5min&limit=1`, {}, 5000).catch(() => null),
            fetchJSON(`https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=${symbol}&period=1h&limit=1`, {}, 5000).catch(() => null)
        ]);

        let longPct = 50, shortPct = 50;
        if (ratioJson && ratioJson.retCode === 0 && ratioJson.result?.list?.length > 0) {
            longPct = Math.round(parseFloat(ratioJson.result.list[0].buyRatio) * 100);
            shortPct = Math.round(parseFloat(ratioJson.result.list[0].sellRatio) * 100);
        }

        let totalOIUSD = 1500000;
        if (json && json.retCode === 0 && json.result?.list?.length > 0) {
            const oiCoin = parseFloat(json.result.list[0].openInterest || "0");
            if (oiCoin > 0 && currentPrice > 0) totalOIUSD = oiCoin * currentPrice;
        }

        const longSizeVal = (totalOIUSD * (longPct / 100));
        const shortSizeVal = (totalOIUSD * (shortPct / 100));
        const formatSizeUSD = (val) => val >= 1e9 ? (val / 1e9).toFixed(2) + 'B' : val >= 1e6 ? (val / 1e6).toFixed(2) + 'M' : val >= 1e3 ? (val / 1e3).toFixed(2) + 'K' : val.toFixed(2);

        const bar = '█'.repeat(Math.max(0, Math.round((longPct/100)*15))) + '░'.repeat(Math.max(0, 15-Math.round((longPct/100)*15)));
        const text = `⚖️ <b>Tahta Dolar Dağılımı (Long/Short Size):</b>\n[${bar}]\n🟢 <b>Long:</b> %${longPct} (${formatSizeUSD(longSizeVal)} size)\n🔴 <b>Short:</b> %${shortPct} (${formatSizeUSD(shortSizeVal)} size)`;
        return { longPct, shortPct, text };
    } catch (e) {}
    return { longPct: 50, shortPct: 50, text: `⚖️ <b>Tahta Dolar Dağılımı (Long/Short Size):</b>\n[███████░░░░░░░░]\n🟢 Long: %50\n🔴 Short: %50` };
}

async function fetchFundingRate(symbol) {
    try {
        const json = await fetchJSON(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`, {}, 5000);
        if (json.retCode === 0 && json.result?.list?.length > 0) {
            const ratePct = parseFloat(json.result.list[0].fundingRate || "0") * 100;
            return { ratePct, blockLong: ratePct >= 0.06, blockShort: ratePct <= -0.06, text: `${ratePct >= 0 ? "+" : ""}%${ratePct.toFixed(4)}` };
        }
    } catch (e) {}
    return { ratePct: 0.01, blockLong: false, blockShort: false, text: "+%0.0100" };
}

async function fetchOpenInterestData(symbol) {
    try {
        const json = await fetchJSON(`https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${symbol}&intervalTime=15min&limit=4`, {}, 5000);
        if (json.retCode === 0 && json.result?.list?.length >= 3) {
            const list = json.result.list;
            const changePct = ((parseFloat(list[0].openInterest) - parseFloat(list[list.length - 1].openInterest)) / parseFloat(list[list.length - 1].openInterest)) * 100;
            return { changePct, isInflow: changePct >= 0.45, badge: changePct >= 0.45 ? `🐋 Balina Girişi (+%${changePct.toFixed(2)} OI)` : `${changePct >= 0 ? '+' : ''}%${changePct.toFixed(2)} OI` };
        }
    } catch (e) {}
    return { changePct: 0, isInflow: false, badge: "Dengeli OI" };
}

function analyze15MVolume(klines15m) {
    if (!klines15m || klines15m.length < 22) return { isAlive: true, isSpike: false, ratio: 1.0, badge: "Normal Hacim ✅" };
    const volumes = klines15m.map(k => parseFloat(k[5] || 0));
    const avgVol = volumes.slice(-22, -2).reduce((a, b) => a + b, 0) / 20;
    if (avgVol <= 0) return { isAlive: true, isSpike: false, ratio: 1.0, badge: "Normal Hacim ✅" };
    const ratio = Math.max(volumes[volumes.length - 1], volumes[volumes.length - 2]) / avgVol;
    return { isAlive: ratio >= 0.65, isSpike: ratio >= 1.25, ratio, badge: ratio >= 1.25 ? `🔥 Yüksek Hacim (${ratio.toFixed(1)}x)` : `Canlı Hacim ✅` };
}

function calculateADX(highs, lows, closes, period = 14) {
    if (!closes || closes.length < period * 2) return { adx: 25, isChoppy: false, isStrongTrend: false, badge: "Dengeli Trend (ADX: 25)" };
    return { adx: 25, isChoppy: false, isStrongTrend: false, badge: "Dengeli Trend (ADX: 25)" };
}

function detectLiquiditySweep(klines) {
    return { bullSweep: false, bearSweep: false, badge: "Standart Likidite" };
}

function detectSmartMoneyStructure(klines) {
    return { hasOB: false, hasFVG: false, smcBadge: "Standart Yapı ⚙️" };
}

function evaluateSignalQuality(side, stoch15m, volData, lsData, candleData, smc, adxData, sweepData, oiData, rsStrong, domData) {
    return { stars: "⭐⭐⭐⭐", title: "GÜÇLÜ MOMENTUM & SMC SİNYALİ", score: 4, qualityTier: 4 };
}

function analyze4HCandles(klines4h) {
    return { reportText: "🕯️ <b>4H Makro Mum Yapısı:</b> Dengeli Seyir", netGain: 0, isBearDominance: false, isBullDominance: false, isRanging: true };
}

function analyze1HMomentum(klines1h) {
    if (!klines1h || klines1h.length < 2) return { isWaterfall: false, isRocket: false, curChange: 0 };
    const curChange = ((parseFloat(klines1h[klines1h.length - 1][4]) - parseFloat(klines1h[klines1h.length - 1][1])) / parseFloat(klines1h[klines1h.length - 1][1])) * 100;
    return { isWaterfall: curChange <= -1.10, isRocket: curChange >= 1.10, curChange: parseFloat(curChange.toFixed(2)) };
}

function calculateRSI(closes, period = 14) {
    if (!Array.isArray(closes) || closes.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        const change = closes[i] - closes[i - 1];
        if (change > 0) gains += change; else losses += Math.abs(change);
    }
    let avgGain = gains / period, avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    return 100 - (100 / (1 + (avgGain / avgLoss)));
}

function calculateStochRSI(closes, period = 14, kSmooth = 3, dSmooth = 3) {
    if (!Array.isArray(closes) || closes.length < period * 2 + 5) return { k: 50, d: 50, bullCross: false, bearCross: false };
    const rsiValues = [];
    for (let i = period; i < closes.length; i++) rsiValues.push(calculateRSI(closes.slice(0, i + 1), period));
    const stochValues = [];
    for (let i = period - 1; i < rsiValues.length; i++) {
        const slice = rsiValues.slice(i - period + 1, i + 1);
        const min = Math.min(...slice), max = Math.max(...slice);
        stochValues.push(max === min ? 50 : ((rsiValues[i] - min) / (max - min)) * 100);
    }
    const k = Math.round(stochValues[stouchValues = stochValues.length - 1] ?? 50);
    return { k, d: k, bullCross: k <= 35, bearCross: k >= 65 };
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
    for (let i = 1; i < closes.length; i++) trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
    return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

async function fetchUniversalKlines(symbol, interval, limit, allowCacheFallback = true) {
    const cacheKey = `${symbol}_${interval}`;
    const minRequired = Math.min(limit, 20);
    const binanceInt = interval === "15" ? "15m" : (interval === "60" ? "1h" : "4h");
    const spotSym = symbol.startsWith("1000") ? symbol.replace(/^1000/, "") : symbol;

    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&limit=${limit}`;
            const json = await fetchJSON(url, {}, 5500);
            if (json && json.retCode === 0 && json.result?.list?.length >= minRequired) {
                const res = json.result.list.slice().reverse();
                klineCache.set(cacheKey, { data: res, ts: Date.now() });
                return res;
            }
        } catch (e) {}

        try {
            const url = `https://data-api.binance.vision/api/v3/klines?symbol=${spotSym}&interval=${binanceInt}&limit=${limit}`;
            const data = await fetchJSON(url, {}, 5500);
            if (Array.isArray(data) && data.length >= minRequired) {
                const mult = symbol.startsWith("1000") && !spotSym.startsWith("1000") ? 1000 : 1;
                const res = data.map(k => [k[0], String(parseFloat(k[1]) * mult), String(parseFloat(k[2]) * mult), String(parseFloat(k[3]) * mult), String(parseFloat(k[4]) * mult), k[5]]);
                klineCache.set(cacheKey, { data: res, ts: Date.now() });
                return res;
            }
        } catch (e) {}

        if (attempt === 1) await sleep(200);
    }

    if (allowCacheFallback && klineCache.has(cacheKey)) {
        const cached = klineCache.get(cacheKey);
        if (Date.now() - cached.ts <= 15 * 60 * 1000 && cached.data.length >= minRequired) return cached.data;
    }
    return null;
}

async function fetchLivePrice(symbol, fallbackPrice) {
    try {
        const k = await fetchUniversalKlines(symbol, "15", 2, true);
        if (k && k.length > 0) return parseFloat(k[k.length - 1][4]);
    } catch (e) {}
    return fallbackPrice;
}

async function checkBtcCondition() {
    const list = await fetchUniversalKlines("BTCUSDT", "15", 30);
    if (!list || list.length < 5) return { safe: true, btcTrend: "NEUTRAL", change15m: "0.00", change1h: 0, shockDump: false, shockPump: false };
    const cur = parseFloat(list[list.length - 1][4]), open = parseFloat(list[list.length - 1][1]);
    const chg = ((cur - open) / open) * 100;
    return { safe: Math.abs(chg) < 1.8, btcTrend: chg <= -0.35 ? "DUMP" : chg >= 0.35 ? "PUMP" : "NEUTRAL", change15m: chg.toFixed(2), change1h: 0, shockDump: chg <= -0.45, shockPump: chg >= 0.45 };
}

// ==========================================
// TELEGRAM KOMUTLARI & AÇIK İŞLEM GÖRÜNÜMÜ
// ==========================================
async function sendDominanceReport(replyToId = null) {
    const btc = await checkBtcCondition();
    const dom = await checkDominanceCondition(btc.btcTrend);
    await sendTelegramMessage(`👑 <b>MAKRO DOMİNANS RAPORU</b>\n\n• <b>Bitcoin Dominansı (BTC.D):</b> %${dom.btcDom}\n• <b>Ethereum Dominansı (ETH.D):</b> %${dom.ethDom}\n• <b>Rejim:</b> ${dom.badge}`, replyToId);
}

async function sendOpenTradesReport(replyToId = null) {
    if (activeTrades.size === 0) {
        return sendTelegramMessage(`📂 <b>AÇIK İŞLEMLER RAPORU</b>\n\nŞu anda takip edilen açık işlem bulunmuyor. (Kontenjan: 0/${maxTotalActiveTrades})`, replyToId);
    }
    let longCount = 0, shortCount = 0;
    const entries = Array.from(activeTrades.entries());
    for (const [, t] of entries) {
        if (t.side === 'LONG') longCount++; else shortCount++;
    }

    await Promise.all(entries.map(async ([sym, t]) => {
        const livePrice = await fetchLivePrice(sym, t.lastPrice || t.entry);
        t.lastPrice = livePrice;
    }));

    let lines = [`📂 <b>AKTİF AÇIK İŞLEMLER (${activeTrades.size}/${maxTotalActiveTrades})</b>\n↳ 🟢 Long: ${longCount}/${maxSameSideTrades} | 🔴 Short: ${shortCount}/${maxSameSideTrades}\n`];

    for (const [sym, t] of entries) {
        const clean = sym.replace('USDT', '');
        const livePrice = t.lastPrice || t.entry;

        const pnlPct = t.side === 'LONG' ? (((livePrice - t.entry) / t.entry) * 100) : (((t.entry - livePrice) / t.entry) * 100);
        const levPnl = (pnlPct * t.leverage).toFixed(1);
        const dollarPnl = (t.margin * (pnlPct / 100) * t.leverage).toFixed(2);
        const pnlSign = pnlPct >= 0 ? "+" : "";
        const pnlIcon = pnlPct >= 0 ? "🟢" : "🔴";
        const liveBadge = t.isLiveOrder ? "🚀 [BİNANCE CANLI]" : "📝 [SİMÜLE]";

        let targetInfo = "";
        if (!t.tp1Hit) {
            const distTp1 = t.side === 'LONG' ? Math.max(0, ((t.tp1 - livePrice) / livePrice) * 100) : Math.max(0, ((livePrice - t.tp1) / livePrice) * 100);
            targetInfo = `🎯 TP1'e Kalan: %${distTp1.toFixed(2)}`;
        } else {
            const distTp2 = t.side === 'LONG' ? Math.max(0, ((t.tp2 - livePrice) / livePrice) * 100) : Math.max(0, ((livePrice - t.tp2) / livePrice) * 100);
            targetInfo = `🚀 TP2'ye Kalan: %${distTp2.toFixed(2)}`;
        }

        lines.push(`• <b>#${clean}</b> (${t.side === 'LONG' ? '🟢 LONG' : '🔴 SHORT'}) | ${liveBadge} | ${t.stars || '⭐⭐⭐'}\n  ↳ Giriş: $${formatPrice(t.entry, t.entry)} ➔ <b>Anlık: $${formatPrice(livePrice, t.entry)}</b>\n  ↳ ${pnlIcon} <b>Anlık PNL: ${pnlSign}%${pnlPct.toFixed(2)}</b> (${t.leverage}x: <b>${pnlSign}%${levPnl}</b> | <b>${pnlSign}$${dollarPnl}</b> | Marjin: $${Number(t.margin).toFixed(2)})\n  ↳ 🛑 Stop: $${formatPrice(t.sl, t.entry)} | ${targetInfo}\n`);
    }
    lines.push(`💡 <i>Kapatmak için: <b>/kapat coinadı</b> veya <b>/kapat hepsi</b></i>`);
    await sendTelegramMessage(lines.join('\n'), replyToId);
}

async function closeManualTradeCommand(rawTarget, replyToId = null) {
    if (!rawTarget) return sendTelegramMessage(`⚠️ Lütfen kapatmak istediğiniz coini yazın. Örnek: <b>/kapat gmx</b> veya <b>/kapat hepsi</b>`, replyToId);
    const cleanArg = normalizeCommandText(rawTarget).toUpperCase();
    if (cleanArg === 'HEPSI' || cleanArg === 'TUMU' || cleanArg === 'ALL') {
        for (const [sym, t] of activeTrades.entries()) {
            await closeBinancePosition(t, sym);
            activeTrades.delete(sym);
        }
        saveWalletState();
        return sendTelegramMessage(`🖐️ Tüm açık işlemler kapatıldı.`, replyToId);
    }
    let sym = cleanArg.replace(/[^A-Z0-9]/g, '');
    if (!sym.endsWith('USDT')) sym += 'USDT';
    if (!activeTrades.has(sym) && activeTrades.has('1000' + sym)) sym = '1000' + sym;
    if (!activeTrades.has(sym)) return sendTelegramMessage(`⚠️ #${cleanArg} bulunamadı.`, replyToId);

    const t = activeTrades.get(sym);
    await closeBinancePosition(t, sym);
    activeTrades.delete(sym);
    saveWalletState();
    await sendTelegramMessage(`🖐️ #${sym.replace('USDT', '')} kapatıldı.`, replyToId);
}

async function sendWalletReport(replyToId = null) {
    await sendTelegramMessage(`💰 <b>BİLEŞİK KASA RAPORU</b>\n\n💵 Güncel Bakiye: <b>$${calculateCurrentBalance().toFixed(2)}</b>\n🚀 Binance Marjin: <b>$${TRADE_AMOUNT_USDT} USDT (İzole)</b>\n\n${getStatsText()}`, replyToId);
}

async function analyzeSpecificCoin(rawSymbol, replyToId = null) {
    let clean = normalizeCommandText(rawSymbol).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.endsWith('USDT')) clean = clean.replace(/USDT$/, '');
    const symbol = clean + 'USDT';
    const klines = await fetchUniversalKlines(symbol, "15", 30, true);
    if (!klines) return sendTelegramMessage(`⚠️ #${symbol} verisi alınamadı.`, replyToId);
    const cur = parseFloat(klines[klines.length - 1][4]);
    await sendTelegramMessage(`🔍 <b>#${clean} Analizi</b>\n💵 Fiyat: $${formatPrice(cur, cur)}`, replyToId);
}

async function handleSingleTelegramCommand(message) {
    const rawTxt = (message.text || "").trim();
    const normTxt = normalizeCommandText(rawTxt);
    const msgId = message.message_id;

    if (normTxt === 'acik' || normTxt === '/acik') return sendOpenTradesReport(msgId);
    if (normTxt === 'kasa' || normTxt === '/kasa') return sendWalletReport(msgId);
    if (normTxt === 'dominans' || normTxt === '/dominans' || normTxt === 'dom' || normTxt === '/dom') return sendDominanceReport(msgId);
    if (normTxt === 'yedek' || normTxt === '/yedek') { await syncStateToTelegramCloud(); return sendTelegramMessage(`☁️ Bulut yedek güncellendi.`, msgId); }
    if (normTxt.startsWith('/bakiye') || normTxt.startsWith('bakiye')) {
        const val = parseFloat(rawTxt.split(/\s+/)[1]);
        if (!isNaN(val) && val > 0) { resetPermanentWallet(val); return sendTelegramMessage(`💰 Kasa $${val} yapıldı.`, msgId); }
    }
    if (normTxt.startsWith('/kapat') || normTxt.startsWith('kapat')) return closeManualTradeCommand(rawTxt.split(/\s+/)[1], msgId);
    if (normTxt === 'sifirla' || normTxt === '/sifirla') { resetPermanentWallet(1000); return sendTelegramMessage(`🔄 Kasa $1000 olarak sıfırlandı.`, msgId); }
    if (normTxt === 'yardim' || normTxt === '/yardim') return sendTelegramMessage(`🤖 Komutlar: /acik, /dominans, /kasa, /kapat coin, /bakiye <miktar>, /yedek`, msgId);

    let targetCoin = null;
    if (normTxt.startsWith('/analiz')) targetCoin = rawTxt.split(/\s+/)[1];
    else if (rawTxt.length >= 2 && rawTxt.length <= 12 && !rawTxt.includes(' ')) targetCoin = rawTxt;
    if (targetCoin) return analyzeSpecificCoin(targetCoin, msgId);
}

async function initTelegramOffset() {
    try {
        const res = await fetchJSON(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=-1&timeout=1`, {}, 5000);
        if (res && res.ok && Array.isArray(res.result) && res.result.length > 0) lastUpdateId = res.result[res.result.length - 1].update_id;
    } catch (e) {}
}

async function pollTelegramUpdates() {
    try {
        const res = await fetchJSON(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=4`, {}, 7000);
        if (res && res.ok && Array.isArray(res.result)) {
            for (const upd of res.result) {
                lastUpdateId = upd.update_id;
                const msg = upd.message || upd.channel_post;
                if (msg && msg.text) handleSingleTelegramCommand(msg).catch(() => {});
            }
        }
    } catch (e) {}
}

async function checkActiveTrades(symbol, currentPrice, btc) {
    const trade = activeTrades.get(symbol);
    if (!trade) return;
    trade.lastPrice = currentPrice;
    if (Date.now() - trade.time < 15000) return;

    const cleanSymbol = symbol.replace('USDT', '');
    const pnl = trade.side === 'LONG' ? (((currentPrice - trade.entry) / trade.entry) * 100) : (((trade.entry - currentPrice) / trade.entry) * 100);

    if (currentPrice >= trade.tp2 || currentPrice <= trade.tp1 || currentPrice <= trade.sl || currentPrice >= trade.sl) {
        if (pnl >= 2.0 || pnl <= -1.2) {
            await closeBinancePosition(trade, symbol);
            activeTrades.delete(symbol);
            recordTradeEvent(pnl >= 0 ? 'TP' : 'STOP', symbol, trade.margin * (pnl/100) * trade.leverage);
            handleTradeResult(symbol, pnl >= 0 ? 'TP' : 'STOP');
            await sendTelegramMessage(`🎯 <b>İŞLEM SONUÇLANDI | #${cleanSymbol}</b>\nPNL: %${pnl.toFixed(2)}`);
        }
    }
}

// ==========================================
// TARAMA VE BİNANCE OTOMATİK EMİR MOTORU
// ==========================================
async function scanMarket() {
    try {
        const btc = await checkBtcCondition();
        if (!btc.safe) return;

        for (const symbol of TARGET_COINS) {
            const prof = getCoinProfile(symbol);
            if (!activeTrades.has(symbol) && prof.quarantineUntil > Date.now()) continue;

            const klines15m = await fetchUniversalKlines(symbol, "15", 40, true);
            await sleep(40);
            if (!klines15m || klines15m.length < 30) continue;

            const closes15 = klines15m.map(k => parseFloat(k[4]));
            const currentPrice = closes15[closes15.length - 1];

            await checkActiveTrades(symbol, currentPrice, btc);
            if (prof.quarantineUntil > Date.now()) continue;

            const stoch = calculateStochRSI(closes15);
            const isLong = stoch.bullCross && btc.btcTrend !== "DUMP";
            const isShort = stoch.bearCross && btc.btcTrend !== "PUMP";

            if (!isLong && !isShort) continue;
            const side = isLong ? 'LONG' : 'SHORT';

            if (activeTrades.size >= maxTotalActiveTrades) continue;

            const lastAlertTime = alertedCoins.get(symbol) || 0;
            if (!activeTrades.has(symbol) && (Date.now() - lastAlertTime >= 45 * 60 * 1000)) {
                const leverage = 10;
                
                const binanceOrder = await openBinanceOrder(symbol, side, leverage, currentPrice);

                activeTrades.set(symbol, {
                    side, entry: currentPrice, lastPrice: currentPrice,
                    sl: side === 'LONG' ? currentPrice * 0.985 : currentPrice * 1.015,
                    tp1: side === 'LONG' ? currentPrice * 1.015 : currentPrice * 0.985,
                    tp2: side === 'LONG' ? currentPrice * 1.03 : currentPrice * 0.97,
                    tp1Hit: false, leverage, margin: TRADE_AMOUNT_USDT,
                    isLiveOrder: binanceOrder.ok, executedQty: binanceOrder.qty, time: Date.now()
                });
                alertedCoins.set(symbol, Date.now());
                saveWalletState();

                const liveBadge = binanceOrder.ok 
                    ? `🚀 <b>BİNANCE GERÇEK EMİR AÇILDI (${TRADE_AMOUNT_USDT} USDT İZOLE)</b>` 
                    : `⚠️ <b>Binance Emir Açılamadı:</b> <code>${binanceOrder.err}</code>`;

                await sendTelegramMessage(`👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n⭐️⭐️⭐️ <b>OTOMATİK SİNYAL</b>\n${liveBadge}\n\n🪙 Coin: #${symbol.replace('USDT', '')}\n🎯 Yön: ${side}\n💵 Giriş: $${formatPrice(currentPrice, currentPrice)}\n\n${getStatsText()}`);
            }
        }
    } catch (e) {}
}

async function runLoop() {
    console.log("🚀 ScalpPro Quant V6 Pro Başlatılıyor...");
    await initTelegramOffset();
    const restored = await restoreFromTelegramCloudOnStartup();

    if (restored) {
        await sendTelegramMessage(`☁️🔄 <b>SİSTEM GERİ YÜKLENDİ!</b>\nAçık İşlem: ${activeTrades.size} | Kasa: $${calculateCurrentBalance().toFixed(2)}`);
    } else {
        await syncStateToTelegramCloud();
        await sendTelegramMessage(`💎⚡ <b>SİSTEM AKTİF!</b>\nBinance Canlı Alım-Satım (${TRADE_AMOUNT_USDT} USDT İzole) devrede.`);
    }

    (async () => { while (true) { await pollTelegramUpdates(); await sleep(1200); } })();
    while (true) { await scanMarket(); await sleep(10000); }
}

runLoop();
