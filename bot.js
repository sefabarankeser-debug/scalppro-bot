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
    res.end('ScalpPro Quant V6 Pro - Dynamic Risk Shield, Dominance & L/S Size Active\n');
}).listen(PORT, '0.0.0.0', () => {
    console.log(`Sunucu ${PORT} portunda dinlemede.`);
});

const TELEGRAM_TOKEN = "8930276912:AAE4xogVFRIqIjPuJ97RqHJFuHvFexNxt2k";
const CHAT_ID = "-1004412694884";

// ==========================================
// 2. BINANCE FUTURES GERÇEK İŞLEM MOTORU
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
            return resolve({ error: "API_KEYS_MISSING" });
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
                    resolve({ error: "JSON_PARSE_ERROR", raw: data });
                }
            });
        });
        req.on('timeout', () => { req.destroy(); resolve({ error: "TIMEOUT" }); });
        req.on('error', (err) => { resolve({ error: err.message }); });
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
                if (ok) {
                    return true;
                }
            }
        }
    } catch (e) {}
    return false;
}

async function initTelegramOffset() {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=-1&timeout=1`;
        const res = await fetchJSON(url, {}, 5000);
        if (res && res.ok && Array.isArray(res.result) && res.result.length > 0) {
            lastUpdateId = res.result[res.result.length - 1].update_id;
        }
    } catch (e) {}
}

async function pollTelegramUpdates() {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=4`;
        const res = await fetchJSON(url, {}, 7000);
        
        if (res && res.ok && Array.isArray(res.result)) {
            for (const upd of res.result) {
                lastUpdateId = upd.update_id;
                const message = upd.message || upd.channel_post;
                if (!message || !message.text) continue;
                handleSingleTelegramCommand(message).catch(() => {});
            }
        }
    } catch (e) {}
}

async function checkDominanceCondition(btcTrend = "NEUTRAL") {
    let btcDom = 55.9; 
    let domChange15m = 0;
    let domChange1h = 0;
    let domIndexPrice = 0;

    try {
        const domKlines = await fetchJSON("https://fapi.binance.com/fapi/v1/klines?symbol=BTCDOMUSDT&interval=15m&limit=6", {}, 5000);
        if (Array.isArray(domKlines) && domKlines.length >= 5) {
            const curClose = parseFloat(domKlines[domKlines.length - 1][4]);
            const curOpen = parseFloat(domKlines[domKlines.length - 1][1]);
            const prevOpen = parseFloat(domKlines[domKlines.length - 2][1]);
            const open1hAgo = parseFloat(domKlines[domKlines.length - 5][1]);

            domIndexPrice = curClose;
            btcDom = parseFloat((curClose / 100).toFixed(2));
            
            const c1 = ((curClose - curOpen) / curOpen) * 100;
            const c2 = ((curClose - prevOpen) / prevOpen) * 100;
            domChange15m = parseFloat((Math.abs(c1) > Math.abs(c2) ? c1 : c2).toFixed(2));
            domChange1h = parseFloat((((curClose - open1hAgo) / open1hAgo) * 100).toFixed(2));
        }
    } catch (e) {}

    const isDomRisingFast = domChange15m >= 0.28 || domChange1h >= 0.45;
    const isDomFalling = domChange15m <= -0.15 || domChange1h <= -0.25;

    let regime = "NEUTRAL";
    let badge = `⚖️ Dengeli Akış (BTC.D: %${btcDom} | 1s: ${domChange1h >= 0 ? '+' : ''}%${domChange1h})`;
    let blockAltLongs = false;
    let boostAltLongs = false;
    let boostAltShorts = false;

    if (isDomRisingFast && btcTrend === "DUMP") {
        regime = "ALT_BLEED";
        blockAltLongs = true;
        boostAltShorts = true;
        badge = `🩸 Altcoin Kanama Kalkanı (BTC.D: %${btcDom} ⬆️ +%${domChange1h})`;
    } else if (isDomRisingFast) {
        regime = "BTC_SUCKING_LIQUIDITY";
        blockAltLongs = true;
        boostAltShorts = true;
        badge = `⚠️ BTC Likidite Emiyor / Alt Ezilmesi (BTC.D: %${btcDom} ⬆️ +%${domChange1h})`;
    } else if (isDomFalling && btcTrend !== "DUMP") {
        regime = "ALT_SEASON_FLOW";
        boostAltLongs = true;
        badge = `🚀 Altcoin Para Girişi (BTC.D: %${btcDom} ⬇️ %${domChange1h})`;
    }

    return {
        btcDom,
        ethDom: 13.2,
        mcapChange24h: -4.5,
        domIndexPrice,
        domChange15m,
        domChange1h,
        regime,
        blockAltLongs,
        boostAltLongs,
        boostAltShorts,
        badge
    };
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
        } else {
            try {
                const bData = await fetchJSON(`https://fapi.binance.com/futures/data/topLongShortAccountRatio?symbol=${symbol}&period=1h&limit=1`, {}, 4500);
                if (Array.isArray(bData) && bData.length > 0) {
                    longPct = Math.round(parseFloat(bData[0].longAccount) * 100);
                    shortPct = Math.round(parseFloat(bData[0].shortAccount) * 100);
                }
            } catch (e) {}
        }

        let totalOIUSD = 1500000;
        if (json && json.retCode === 0 && json.result?.list?.length > 0) {
            const oiCoin = parseFloat(json.result.list[0].openInterest || "0");
            if (oiCoin > 0 && currentPrice > 0) {
                totalOIUSD = oiCoin * currentPrice;
            }
        }

        const longSizeVal = (totalOIUSD * (longPct / 100));
        const shortSizeVal = (totalOIUSD * (shortPct / 100));

        const formatSizeUSD = (val) => {
            if (val >= 1e9) return (val / 1e9).toFixed(2) + 'B';
            if (val >= 1e6) return (val / 1e6).toFixed(2) + 'M';
            if (val >= 1e3) return (val / 1e3).toFixed(2) + 'K';
            return val.toFixed(2);
        };

        const bar = '█'.repeat(Math.max(0, Math.round((longPct/100)*15))) + '░'.repeat(Math.max(0, 15-Math.round((longPct/100)*15)));
        const text = `⚖️ <b>Tahta Dolar Dağılımı (Long/Short Size):</b>\n[${bar}]\n🟢 <b>Long:</b> %${longPct} (${formatSizeUSD(longSizeVal)} size)\n🔴 <b>Short:</b> %${shortPct} (${formatSizeUSD(shortSizeVal)} size)`;

        return { longPct, shortPct, longSizeUSD: formatSizeUSD(longSizeVal), shortSizeUSD: formatSizeUSD(shortSizeVal), text };
    } catch (e) {}

    return { 
        longPct: 50, shortPct: 50, longSizeUSD: "1.50M", shortSizeUSD: "1.50M", 
        text: `⚖️ <b>Tahta Dolar Dağılımı (Long/Short Size):</b>\n[███████░░░░░░░░]\n🟢 <b>Long:</b> %50 (1.50M size)\n🔴 <b>Short:</b> %50 (1.50M size)` 
    };
}

async function fetchFundingRate(symbol) {
    try {
        const url = `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`;
        const json = await fetchJSON(url, {}, 5000);
        if (json.retCode === 0 && json.result?.list?.length > 0) {
            const rateRaw = parseFloat(json.result.list[0].fundingRate || "0");
            const ratePct = rateRaw * 100;
            const blockLong = ratePct >= 0.06;
            const blockShort = ratePct <= -0.06;
            let status = blockLong ? "⚠️ Aşırı Pozitif (Long Riskli)" : blockShort ? "⚠️ Aşırı Negatif (Short Riskli)" : "Normal / Sağlıklı ✅";
            return { ratePct, blockLong, blockShort, text: `${ratePct >= 0 ? "+" : ""}%${ratePct.toFixed(4)} (${status})` };
        }
    } catch (e) {}
    return { ratePct: 0.01, blockLong: false, blockShort: false, text: `+%0.0100 (Normal ✅)` };
}

async function fetchOpenInterestData(symbol) {
    try {
        const url = `https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${symbol}&intervalTime=15min&limit=4`;
        const json = await fetchJSON(url, {}, 5000);
        if (json.retCode === 0 && json.result?.list?.length >= 3) {
            const list = json.result.list;
            const latestOI = parseFloat(list[0].openInterest);
            const oldOI = parseFloat(list[list.length - 1].openInterest);
            if (oldOI > 0) {
                const changePct = ((latestOI - oldOI) / oldOI) * 100;
                const isInflow = changePct >= 0.45;
                const badge = isInflow ? `🐋 Balina Girişi (+%${changePct.toFixed(2)} OI)` : `${changePct >= 0 ? '+' : ''}%${changePct.toFixed(2)} OI`;
                return { changePct, isInflow, badge };
            }
        }
    } catch (e) {}
    return { changePct: 0, isInflow: false, badge: "Dengeli OI" };
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

    const isAlive = ratio >= 0.65;
    const isSpike = ratio >= 1.25;
    const badge = isSpike ? `🔥 Yüksek Hacim / Balina Girişi (${ratio.toFixed(1)}x)` : isAlive ? `Canlı Hacim ✅ (${ratio.toFixed(1)}x)` : `⚠️ Cılız / Ölü Hacim (${ratio.toFixed(1)}x)`;

    return { isAlive, isSpike, ratio, badge };
}

function calculateADX(highs, lows, closes, period = 14) {
    if (!closes || closes.length < period * 2) return { adx: 25, isChoppy: false, isStrongTrend: false, badge: "Normal Trend (ADX: 25)" };
    const tr = [], plusDM = [], minusDM = [];
    for (let i = 1; i < closes.length; i++) {
        const upMove = highs[i] - highs[i - 1];
        const downMove = lows[i - 1] - lows[i];
        plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
        minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
        tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
    }

    let smoothTR = tr.slice(0, period).reduce((a, b) => a + b, 0);
    let smoothPlusDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
    let smoothMinusDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0);

    const dxList = [];
    for (let i = period; i < tr.length; i++) {
        smoothTR = smoothTR - (smoothTR / period) + tr[i];
        smoothPlusDM = smoothPlusDM - (smoothPlusDM / period) + plusDM[i];
        smoothMinusDM = smoothMinusDM - (smoothMinusDM / period) + minusDM[i];

        const plusDI = smoothTR === 0 ? 0 : (smoothPlusDM / smoothTR) * 100;
        const minusDI = smoothTR === 0 ? 0 : (smoothMinusDM / smoothTR) * 100;
        const sumDI = plusDI + minusDI;
        const dx = sumDI === 0 ? 0 : (Math.abs(plusDI - minusDI) / sumDI) * 100;
        dxList.push(dx);
    }

    if (dxList.length < period) return { adx: 25, isChoppy: false, isStrongTrend: false, badge: "Normal Trend" };
    let adx = dxList.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < dxList.length; i++) {
        adx = ((adx * (period - 1)) + dxList[i]) / period;
    }
    const roundedAdx = Math.round(adx);
    const isChoppy = roundedAdx < 18;
    const isStrongTrend = roundedAdx >= 26;
    const badge = isStrongTrend ? `🔥 Güçlü Trend (ADX: ${roundedAdx})` : isChoppy ? `⚠️ Yatay / Testere (ADX: ${roundedAdx})` : `✅ Dengeli Trend (ADX: ${roundedAdx})`;
    return { adx: roundedAdx, isChoppy, isStrongTrend, badge };
}

function detectLiquiditySweep(klines) {
    if (!klines || klines.length < 20) return { bullSweep: false, bearSweep: false, badge: "Yok" };
    const priorCandles = klines.slice(-18, -3);
    const recentCandles = klines.slice(-3);

    let swingLow = Infinity;
    let swingHigh = -Infinity;
    for (const c of priorCandles) {
        const h = parseFloat(c[2]);
        const l = parseFloat(c[3]);
        if (l < swingLow) swingLow = l;
        if (h > swingHigh) swingHigh = h;
    }

    let bullSweep = false;
    let bearSweep = false;
    for (const c of recentCandles) {
        const high = parseFloat(c[2]);
        const low = parseFloat(c[3]);
        const close = parseFloat(c[4]);
        if (low < swingLow && close > swingLow) bullSweep = true;
        if (high > swingHigh && close < swingHigh) bearSweep = true;
    }

    let badge = "Standart Likidite";
    if (bullSweep) badge = "🧲 Dip Likidite Avı (Stop Hunt Onaylı!)";
    else if (bearSweep) badge = "🧲 Tepe Likidite Avı (Stop Hunt Onaylı!)";

    return { bullSweep, bearSweep, badge };
}

function detectSmartMoneyStructure(klines) {
    if (!klines || klines.length < 10) return { hasOB: false, hasFVG: false, smcBadge: "Standart Yapı ⚙️" };
    let hasOB = false;
    let hasFVG = false;

    for (let i = klines.length - 3; i < klines.length; i++) {
        if (i < 2) continue;
        const m1High = parseFloat(klines[i-2][2]);
        const m3Low = parseFloat(klines[i][3]);
        const m1Low = parseFloat(klines[i-2][3]);
        const m3High = parseFloat(klines[i][2]);

        if (m3Low > m1High) { hasFVG = true; break; }
        if (m3High < m1Low) { hasFVG = true; break; }
    }

    for (let i = klines.length - 5; i < klines.length - 1; i++) {
        if (i < 0) continue;
        const open = parseFloat(klines[i][1]);
        const close = parseFloat(klines[i][4]);
        const nextClose = parseFloat(klines[i+1][4]);
        const nextOpen = parseFloat(klines[i+1][1]);

        const isRed = close < open;
        const isGreen = close > open;
        const nextIsStrongPump = nextClose > nextOpen && (nextClose - nextOpen) > Math.abs(close - open) * 1.5;
        const nextIsStrongDump = nextClose < nextOpen && (open - close) > Math.abs(nextOpen - nextClose) * 1.5;

        if ((isRed && nextIsStrongPump) || (isGreen && nextIsStrongDump)) {
            hasOB = true;
            break;
        }
    }

    let badge = "Standart Yapı ⚙️";
    if (hasOB && hasFVG) badge = "💎 Bullish/Bearish OB + FVG (Smart Money)";
    else if (hasOB) badge = "🧱 Order Block (Kurumsal Blok)";
    else if (hasFVG) badge = "🕳️ Fair Value Gap (Adil Değer Boşluğu)";

    return { hasOB, hasFVG, smcBadge: badge };
}

function evaluateSignalQuality(side, stoch15m, volData, lsData, candleData, smc, adxData, sweepData, oiData, rsStrong, domData) {
    let score = 0;
    if (volData.ratio >= 1.15) score++;
    if ((side === 'LONG' && stoch15m.k <= 18) || (side === 'SHORT' && stoch15m.k >= 82)) score++;
    if ((side === 'LONG' && lsData.longPct <= 60) || (side === 'SHORT' && lsData.shortPct <= 60)) score++;
    if (smc.hasOB || smc.hasFVG) score += 2;
    if ((side === 'LONG' && sweepData.bullSweep) || (side === 'SHORT' && sweepData.bearSweep)) score += 2;
    if (adxData.isStrongTrend) score++;
    if (oiData.isInflow) score++;
    if (rsStrong) score++;
    if ((side === 'LONG' && domData && domData.boostAltLongs) || (side === 'SHORT' && domData && domData.boostAltShorts)) score++;

    if (score >= 5) {
        return { stars: "🔥⭐⭐⭐⭐⭐", title: "A+ KURUMSAL QUANT & BALİNA SİNYALİ", score, qualityTier: 5 };
    } else if (score >= 3) {
        return { stars: "⭐⭐⭐⭐", title: "GÜÇLÜ MOMENTUM & SMC SİNYALİ", score, qualityTier: 4 };
    }
    return { stars: "⭐⭐⭐", title: "STANDART ONAYLI SİNYAL", score, qualityTier: 3 };
}

function analyze4HCandles(klines4h) {
    if (!klines4h || klines4h.length < 3) return { reportText: "⚠️ 4H Verisi Yetersiz", netGain: 0, isBearDominance: false, isBullDominance: false, isRanging: true };
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
    const isRanging = !isBullDominance && !isBearDominance;
    let netTrendText = isBullDominance ? "🟢 Güçlü Boğa Baskısı (4H)" : isBearDominance ? "🔴 Güçlü Ayı Baskısı (4H)" : "⚪ Yatay / Kararsız Seyir";
    return { reportText: `🕯️ <b>4H Makro Mum Yapısı (Bilgilendirme):</b>\n<pre>${lines.join('\n')}\n ↳ 4H Net Yön: ${netTrendText}</pre>`, netGain, isBullDominance, isBearDominance, isRanging };
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

    return { isWaterfall, isRocket, curChange: parseFloat(curChange.toFixed(2)), prevChange: parseFloat(prevChange.toFixed(2)) };
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

async function fetchUniversalKlines(symbol, interval, limit, allowCacheFallback = true) {
    const cacheKey = `${symbol}_${interval}`;
    const minRequired = Math.min(limit, 20);
    const binanceInt = interval === "15" ? "15m" : (interval === "60" ? "1h" : (interval === "240" ? "4h" : interval));
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
            const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${binanceInt}&limit=${limit}`;
            const data = await fetchJSON(url, {}, 5500);
            if (Array.isArray(data) && data.length >= minRequired) {
                const res = data.map(k => [k[0], k[1], k[2], k[3], k[4], k[5]]);
                klineCache.set(cacheKey, { data: res, ts: Date.now() });
                return res;
            }
        } catch (e) {}

        try {
            const url = `https://data-api.binance.vision/api/v3/klines?symbol=${spotSym}&interval=${binanceInt}&limit=${limit}`;
            const data = await fetchJSON(url, {}, 5500);
            if (Array.isArray(data) && data.length >= minRequired) {
                const is1000 = symbol.startsWith("1000") && !spotSym.startsWith("1000");
                const mult = is1000 ? 1000 : 1;
                const res = data.map(k => [
                    k[0],
                    String(parseFloat(k[1]) * mult),
                    String(parseFloat(k[2]) * mult),
                    String(parseFloat(k[3]) * mult),
                    String(parseFloat(k[4]) * mult),
                    k[5]
                ]);
                klineCache.set(cacheKey, { data: res, ts: Date.now() });
                return res;
            }
        } catch (e) {}

        if (attempt === 1) await sleep(250);
    }

    if (allowCacheFallback && klineCache.has(cacheKey)) {
        const cached = klineCache.get(cacheKey);
        if (Date.now() - cached.ts <= 15 * 60 * 1000 && cached.data.length >= minRequired) {
            return cached.data;
        }
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
    const currentPrice = parseFloat(list[list.length - 1][4]);
    const openCurrent = parseFloat(list[list.length - 1][1]);
    const openPrev = parseFloat(list[list.length - 2][1]);
    const open1hAgo = parseFloat(list[Math.max(0, list.length - 4)][1]);
    
    const changeCur = ((currentPrice - openCurrent) / openCurrent) * 100;
    const changeTwo = ((currentPrice - openPrev) / openPrev) * 100;
    const change1h = ((currentPrice - open1hAgo) / open1hAgo) * 100;
    const worstChange = Math.abs(changeCur) > Math.abs(changeTwo) ? changeCur : changeTwo;

    let btcTrend = "NEUTRAL";
    if (changeCur <= -0.35 || changeTwo <= -0.45) btcTrend = "DUMP";
    else if (changeCur >= 0.35 || changeTwo >= 0.45) btcTrend = "PUMP";

    const shockDump = changeCur <= -0.45 || changeTwo <= -0.60;
    const shockPump = changeCur >= 0.45 || changeTwo >= 0.60;

    return { safe: Math.abs(worstChange) < 1.8, btcTrend, change15m: worstChange.toFixed(2), change1h: parseFloat(change1h.toFixed(2)), shockDump, shockPump };
}

async function scanMarket() {
    try {
        const session = getActiveSessionName();
        const btc = await checkBtcCondition();
        if (!btc.safe) return;

        const domData = await checkDominanceCondition(btc.btcTrend);
        let signalSentInThisCycle = false, scannedCount = 0;

        for (const symbol of TARGET_COINS) {
            const prof = getCoinProfile(symbol);
            const hasOpenTrade = activeTrades.has(symbol);
            if (!hasOpenTrade && prof.quarantineUntil > Date.now()) continue;

            const klines15m = await fetchUniversalKlines(symbol, "15", 55, true);
            await sleep(35);
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

            await checkActiveTrades(symbol, currentPrice, btc);
            if (prof.quarantineUntil > Date.now()) continue;

            const stoch15m = calculateStochRSI(closes15);

            const prevOpen = opens15[opens15.length - 2];
            const prevClose = closes15[closes15.length - 2];
            const bodySize = Math.abs(currentPrice - currentOpen);
            const lowerWick = Math.min(currentOpen, currentPrice) - currentLow;
            const upperWick = currentHigh - Math.max(currentOpen, currentPrice);
            
            const hasBullReversalCandle = ((lowerWick >= bodySize * 0.25 || currentPrice > currentOpen) && upperWick <= bodySize * 2.2) || (prevClose > prevOpen && currentPrice >= prevClose);
            const hasBearReversalCandle = ((upperWick >= bodySize * 0.25 || currentPrice < currentOpen) && lowerWick <= bodySize * 2.2) || (prevClose < prevOpen && currentPrice <= prevClose);

            const isPotentialLong = (stoch15m.k <= prof.stochLong && stoch15m.bullCross && hasBullReversalCandle && btc.btcTrend !== "DUMP");
            const isPotentialShort = (stoch15m.k >= prof.stochShort && stoch15m.bearCross && hasBearReversalCandle && btc.btcTrend !== "PUMP");

            if (!isPotentialLong && !isPotentialShort) continue;

            const volData = analyze15MVolume(klines15m);
            if (!volData.isAlive) continue;

            const adxData = calculateADX(highs15, lows15, closes15);
            const smc = detectSmartMoneyStructure(klines15m);
            const sweepData = detectLiquiditySweep(klines15m);

            const isAltcoin = symbol !== "BTCUSDT" && symbol !== "ETHUSDT";
            if (isAltcoin && isPotentialLong && domData.blockAltLongs) {
                const hasAPlusReversal = sweepData.bullSweep && (smc.hasOB || smc.hasFVG) && volData.isSpike;
                if (!hasAPlusReversal) continue;
            }

            if (adxData.isChoppy) {
                const hasInstitutionalSetup = (isPotentialLong && sweepData.bullSweep) || (isPotentialShort && sweepData.bearSweep) || ((smc.hasOB || smc.hasFVG) && volData.isSpike);
                if (!hasInstitutionalSetup) continue;
            }

            const desiredSide = isPotentialLong ? 'LONG' : 'SHORT';
            if (!canOpenNewTrade(desiredSide)) continue;

            const klines1h = await fetchUniversalKlines(symbol, "60", 55, true);
            const klines4h = await fetchUniversalKlines(symbol, "240", 55, true);
            if (!klines1h || klines1h.length < 25) continue;

            const closes1h = klines1h.map(k => parseFloat(k[4]));
            const rsi1h = Math.round(calculateRSI(closes1h, 14));
            const ema50_1h = calculateEMA(closes1h, 50) || calculateEMA(closes1h, 20);
            const currentPrice1h = closes1h[closes1h.length - 1];
            const mom1h = analyze1HMomentum(klines1h);

            const rsDiff = mom1h.curChange - btc.change1h;
            const rsStrong = (isPotentialLong && rsDiff >= 0.15) || (isPotentialShort && rsDiff <= -0.15);
            const rsBadge = isPotentialLong
                ? (rsDiff >= 0 ? `💪 BTC'den Güçlü (+%${rsDiff.toFixed(2)})` : `⚪ Nötr Korelasyon (%${rsDiff.toFixed(2)})`)
                : (rsDiff <= 0 ? `📉 BTC'den Zayıf (%${rsDiff.toFixed(2)})` : `⚪ Nötr Korelasyon (+%${rsDiff.toFixed(2)})`);

            if ((isPotentialLong && rsDiff < -1.2 && !sweepData.bullSweep) || (isPotentialShort && rsDiff > 1.2 && !sweepData.bearSweep)) continue;

            const canLong1H = ((currentPrice1h >= ema50_1h * 0.990 || rsi1h >= 42) && !mom1h.isWaterfall);
            const canShort1H = ((currentPrice1h <= ema50_1h * 1.010 || rsi1h <= 58) && !mom1h.isRocket);

            let candleData = { reportText: "⚠️ 4H Verisi Alınamadı", netGain: 0, isBearDominance: false, isBullDominance: false, isRanging: true };
            if (klines4h && klines4h.length >= 20) candleData = analyze4HCandles(klines4h);

            if ((isPotentialLong && (!canLong1H || candleData.isBearDominance)) || (isPotentialShort && (!canShort1H || candleData.isBullDominance))) continue;

            const [lsSizeData, fundingData, oiData] = await Promise.all([
                fetchLongShortSizeData(symbol, currentPrice),
                fetchFundingRate(symbol),
                fetchOpenInterestData(symbol)
            ]);

            if ((isPotentialLong && fundingData.blockLong) || (isPotentialShort && fundingData.blockShort)) continue;

            const atr15 = calculateATR(highs15, lows15, closes15, 14);
            const cleanSymbol = symbol.replace('USDT', '');
            let signal = null;

            const isFastRiskFreeMode = adxData.adx < 22 || candleData.isRanging;
            const tp1Mult = isFastRiskFreeMode ? 1.08 : (adxData.isStrongTrend ? 1.32 : 1.20);
            const tp2Mult = isFastRiskFreeMode ? 2.25 : (adxData.isStrongTrend ? 2.75 : 2.50);

            const rawAtrDist = atr15 ? (atr15 * prof.atrMultiplier) : (currentPrice * 0.012);
            const minSafeDist = currentPrice * 0.0065;
            const maxSafeDist = currentPrice * 0.0280;
            const stopDist = Math.min(maxSafeDist, Math.max(minSafeDist, rawAtrDist));

            if (isPotentialLong && lsSizeData.longPct < prof.maxLsRatio) {
                signal = { 
                    type: "🟢 LONG", side: "LONG",
                    rawEntry: currentPrice, rawSl: currentPrice - stopDist, 
                    rawTp1: currentPrice + (stopDist * tp1Mult), rawTp2: currentPrice + (stopDist * tp2Mult), 
                    sl: formatPrice(currentPrice - stopDist, currentPrice), 
                    tp1: formatPrice(currentPrice + (stopDist * tp1Mult), currentPrice), 
                    tp2: formatPrice(currentPrice + (stopDist * tp2Mult), currentPrice), 
                    tp1Pct: ((((currentPrice + (stopDist * tp1Mult)) - currentPrice) / currentPrice) * 100).toFixed(2),
                    slPct: (((stopDist) / currentPrice) * 100).toFixed(2)
                };
            }

            if (isPotentialShort && lsSizeData.shortPct < prof.maxLsRatio) {
                signal = { 
                    type: "🔴 SHORT", side: "SHORT",
                    rawEntry: currentPrice, rawSl: currentPrice + stopDist, 
                    rawTp1: currentPrice - (stopDist * tp1Mult), rawTp2: currentPrice - (stopDist * tp2Mult), 
                    sl: formatPrice(currentPrice + stopDist, currentPrice), 
                    tp1: formatPrice(currentPrice - (stopDist * tp1Mult), currentPrice), 
                    tp2: formatPrice(currentPrice - (stopDist * tp2Mult), currentPrice), 
                    tp1Pct: (((currentPrice - (currentPrice - (stopDist * tp1Mult))) / currentPrice) * 100).toFixed(2),
                    slPct: (((stopDist) / currentPrice) * 100).toFixed(2)
                };
            }

            const lastAlertTime = alertedCoins.get(symbol) || 0;
            if (signal && !activeTrades.has(symbol) && (Date.now() - lastAlertTime >= 45 * 60 * 1000)) {
                const quality = evaluateSignalQuality(signal.side, stoch15m, volData, lsSizeData, candleData, smc, adxData, sweepData, oiData, rsStrong, domData);

                let leverage = 10;
                if (quality.qualityTier === 5) leverage = 14;
                else if (quality.qualityTier === 4) leverage = 12;
                else leverage = 9;

                let binanceSuccess = false;
                let actualExecutedQty = 0;
                let errorReason = "";

                if (BINANCE_API_KEY && BINANCE_API_SECRET) {
                    try {
                        const marginRes = await binanceSignedRequest('/fapi/v1/marginType', 'POST', { symbol, marginType: 'ISOLATED' });
                        if (marginRes && marginRes.code && marginRes.code !== -4041 && marginRes.code !== 0) {
                            errorReason = `Margin: [${marginRes.code}] ${marginRes.msg}`;
                        }

                        const levRes = await binanceSignedRequest('/fapi/v1/leverage', 'POST', { symbol, leverage });
                        if (levRes && levRes.code && levRes.code !== 0) {
                            errorReason = `Leverage: [${levRes.code}] ${levRes.msg}`;
                        }

                        const positionSizeUsd = TRADE_AMOUNT_USDT * leverage;
                        const calculatedQty = positionSizeUsd / currentPrice;
                        const finalQty = formatQuantity(symbol, calculatedQty);

                        if (finalQty > 0) {
                            const orderSide = signal.side === 'LONG' ? 'BUY' : 'SELL';
                            const orderRes = await binanceSignedRequest('/fapi/v1/order', 'POST', {
                                symbol,
                                side: orderSide,
                                type: 'MARKET',
                                quantity: finalQty
                            });

                            if (orderRes && orderRes.orderId) {
                                binanceSuccess = true;
                                actualExecutedQty = parseFloat(orderRes.executedQty || finalQty);
                            } else if (orderRes) {
                                errorReason = `Order: [${orderRes.code || 'Bilinmeyen'}] ${orderRes.msg || 'Reddedildi'}`;
                            }
                        }
                    } catch (bErr) {
                        errorReason = `Catch: ${bErr.message}`;
                    }
                } else {
                    errorReason = "API Anahtarları Tanımlı Değil!";
                }

                activeTrades.set(symbol, { 
                    side: signal.side, 
                    entry: signal.rawEntry, 
                    lastPrice: currentPrice,
                    highestSeen: currentPrice,
                    lowestSeen: currentPrice,
                    sl: signal.rawSl, 
                    tp1: signal.rawTp1, 
                    tp2: signal.rawTp2, 
                    tp1Hit: false, 
                    trailingHit: false, 
                    shockProtected: false,
                    stars: quality.stars,
                    leverage: leverage,
                    margin: TRADE_AMOUNT_USDT,
                    executedQty: actualExecutedQty,
                    isLiveOrder: binanceSuccess,
                    time: Date.now() 
                });
                alertedCoins.set(symbol, Date.now());
                saveWalletState();

                const modeBadge = isFastRiskFreeMode ? `⚡ Hızlı Risk-Free (${tp1Mult}R)` : `🚀 Trend Takip (${tp1Mult}R)`;
                const expectedTp1Dollar = (TRADE_AMOUNT_USDT * (parseFloat(signal.tp1Pct) / 100) * leverage).toFixed(2);
                
                const liveOrderBadge = binanceSuccess 
                    ? `🚀 <b>BİNANCE GERÇEK EMİR AÇILDI (5 USDT İZOLE)</b>` 
                    : `⚠️ <b>BİNANCE REDDİ:</b> <code>${errorReason || 'Bilinmeyen Hata'}</code>`;

                const msg = `👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n${quality.stars} <b>${quality.title}</b>\n${liveOrderBadge}\n\n🪙 <b>Coin:</b> #${cleanSymbol}/USDT\n🎯 <b>Yön:</b> ${signal.type}\n💵 <b>Giriş Fiyatı:</b> $${formatPrice(currentPrice, currentPrice)}\n🛑 <b>Doğal ATR Stop (-%${signal.slPct}):</b> $${signal.sl}\n\n💵 <b>Binance Marjin:</b> <b>$${TRADE_AMOUNT_USDT} USDT</b>\n⚖️ <b>Kaldıraç:</b> <b>${leverage}x</b> (Pozisyon Hacmi: $${(TRADE_AMOUNT_USDT * leverage).toFixed(1)})\n\n🎯 <b>Kademeli Kâr Hedefleri (${modeBadge}):</b>\n• <b>TP1 (+%${signal.tp1Pct} | +$${expectedTp1Dollar}):</b> $${signal.tp1}\n• <b>TP2:</b> $${signal.tp2}\n\n⚙️ <b>Kurumsal Onaylar (8 Filtre):</b>\n• Profil: ${prof.category}\n• Dominans Akışı: ${domData.badge}\n• Trend Gücü: ${adxData.badge}\n• Likidite: ${sweepData.badge}\n• Açık Pozisyon (OI): ${oiData.badge}\n• Rölatif Güç: ${rsBadge}\n• 15M Hacim: ${volData.badge}\n• Smart Money (SMC): ${smc.smcBadge}\n\n${lsSizeData.text}\n\n${candleData.reportText}\n\n${getStatsText()}\n\n🔗 <a href="https://www.binance.com/tr/futures/${symbol}">Binance Futures'ta Gör</a>\n\n⚠️ <i>"YTD" HEPSİ.</i>`;
                await sendTelegramMessage(msg);
                signalSentInThisCycle = true;
            }
        }

        if (!signalSentInThisCycle && (Date.now() - lastStatusReportTime >= 10 * 60 * 1000)) {
            const btcBadge = btc.btcTrend === "DUMP" ? "🔴 BTC Satışta" : btc.btcTrend === "PUMP" ? "🟢 BTC Alımda" : "⚪ Güvenli";
            await sendTelegramMessage(`👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n⏳ <b>[${getTurkishTimeString()}] TARAMA RAPORU</b>\n🌐 Seans: ${session} | Taranan: ${scannedCount} | Açık: ${activeTrades.size}/${maxTotalActiveTrades} (Tek Yön: ${maxSameSideTrades})\n⚡ BTC Kalkanı: %${btc.change15m} (${btcBadge})\n👑 Dominans: ${domData.badge}\n🚀 Binance Otomatik Emir: Aktif (5 USDT İzole)\n\n${getStatsText()}\n\n⌨️ <i>Komutlar: /acik | /kalkan 8 12 | /dominans | /kapat | /kasa</i>`);
            lastStatusReportTime = Date.now();
        }
    } catch (err) {}
}

async function runLoop() {
    console.log("🚀 ScalpPro Quant V6 Pro (Dynamic Risk Shield & Binance Live) Başlatılıyor...");
    await initBinanceExchangeInfo();
    await initTelegramOffset();
    const restored = await restoreFromTelegramCloudOnStartup();
    const domInit = await checkDominanceCondition();

    if (restored) {
        const curBal = calculateCurrentBalance();
        await sendTelegramMessage(`☁️🔄 <b>QUANT V6 PRO GÜNCELLENDİ (BİNANCE CANLI ALIM-SATIM AKTİF)!</b>\n\n📂 <b>Korunan Açık İşlem:</b> ${activeTrades.size} / ${maxTotalActiveTrades}\n💵 <b>Sabit İşlem Marjini:</b> <b>${TRADE_AMOUNT_USDT} USDT (ISOLATED)</b>\n🛡️ <b>Mevcut Pozisyon Koruması:</b> Manuel işlemleriniz tamamen izoledir.\n👑 <b>Canlı Dominans Filtresi:</b> ${domInit.badge}`);
    } else {
        await syncStateToTelegramCloud();
        await sendTelegramMessage(`💎⚡ <b>QUANT V6 PRO: BİNANCE CANLI ALIM-SATIM ENTEGRASYONU TAMAMLANDI!</b>\n1️⃣ <b>Otomatik İşlem:</b> Sinyal geldiğinde Binance Vadeli İşlemlerde <b>${TRADE_AMOUNT_USDT} USDT</b> marjin ile anında pozisyon açılır.`);
    }

    (async () => { while (true) { await pollTelegramUpdates(); await sleep(1200); } })();
    while (true) { await scanMarket(); await sleep(10000); }
}

runLoop();
