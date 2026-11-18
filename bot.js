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

// ==========================================
// 1. RENDER PORT & SABİT TELEGRAM BİLGİLERİ
// ==========================================
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ScalpPro Quant V6.6 Ultra - 125 Coins, 11 Filters, Profit-Lock BE, Fixed-Risk & Fast Monitor Active\n');
}).listen(PORT, '0.0.0.0', () => {
    console.log(`Sunucu ${PORT} portunda dinlemede.`);
});

const TELEGRAM_TOKEN = "8930276912:AAE4xogVFRIqIjPuJ97RqHJFuHvFexNxt2k";
const CHAT_ID = "-1004412694884";

let maxTotalActiveTrades = 12;
let maxSameSideTrades = 8;
let lastLongSignalTime = 0;
let lastShortSignalTime = 0;
const tradeCheckLocks = new Set();

// ==========================================
// 2. ADAPTİF PROFİLLER VE GENİŞLETİLMİŞ SEPET (125 PARİTE)
// ==========================================
const BASE_PROFILES = {
    MAJOR: { category: "💎 Majör / Trend Sadık", stochLong: 25, stochShort: 75, atrMultiplier: 1.75, maxLsRatio: 65 },
    MEME: { category: "🐸 Meme / Ekstrem Volatilite", stochLong: 27, stochShort: 73, atrMultiplier: 2.15, maxLsRatio: 62 },
    VOLATILE_ALT: { category: "⚡ Sığ Tahta / Yüksek Oynaklık", stochLong: 26, stochShort: 74, atrMultiplier: 1.95, maxLsRatio: 62 }
};

const COIN_ASSIGNMENTS = {
    // 25 MAJÖR PARİTE
    "BTCUSDT": "MAJOR", "ETHUSDT": "MAJOR", "SOLUSDT": "MAJOR", "AVAXUSDT": "MAJOR", 
    "NEARUSDT": "MAJOR", "LINKUSDT": "MAJOR", "UNIUSDT": "MAJOR", "LTCUSDT": "MAJOR", 
    "BCHUSDT": "MAJOR", "ETCUSDT": "MAJOR", "ATOMUSDT": "MAJOR", "FILUSDT": "MAJOR", 
    "ALGOUSDT": "MAJOR", "XRPUSDT": "MAJOR", "ADAUSDT": "MAJOR", "BNBUSDT": "MAJOR", 
    "ICPUSDT": "MAJOR", "TRXUSDT": "MAJOR", "HYPEUSDT": "MAJOR", "ZECUSDT": "MAJOR",
    "TONUSDT": "MAJOR", "XLMUSDT": "MAJOR", "DOTUSDT": "MAJOR", "VETUSDT": "MAJOR",
    "NEOUSDT": "MAJOR",
    
    // 18 MEME PARİTE
    "DOGEUSDT": "MEME", "1000PEPEUSDT": "MEME", "WIFUSDT": "MEME", "1000SHIBUSDT": "MEME",
    "1000FLOKIUSDT": "MEME", "1000BONKUSDT": "MEME", "NEIROUSDT": "MEME", "NOTUSDT": "MEME",
    "POPCATUSDT": "MEME", "BOMEUSDT": "MEME", "PNUTUSDT": "MEME", "ACTUSDT": "MEME",
    "GOATUSDT": "MEME", "MOODENGUSDT": "MEME", "PENGUUSDT": "MEME", "FARTCOINUSDT": "MEME",
    "TRUMPUSDT": "MEME", "1000CATUSDT": "MEME",
    
    // 82 VOLATİL ALTCOİN PARİTESİ
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
    "BBUSDT": "VOLATILE_ALT", "IOUSDT": "VOLATILE_ALT", "ZKUSDT": "VOLATILE_ALT",
    "REZUSDT": "VOLATILE_ALT", "ENSUSDT": "VOLATILE_ALT", "EIGENUSDT": "VOLATILE_ALT",
    "VIRTUALUSDT": "VOLATILE_ALT", "COMPUSDT": "VOLATILE_ALT", "GRASSUSDT": "VOLATILE_ALT",
    "RAYUSDT": "VOLATILE_ALT", "KAITOUSDT": "VOLATILE_ALT", "IPUSDT": "VOLATILE_ALT",
    "MOVEUSDT": "VOLATILE_ALT", "MEUSDT": "VOLATILE_ALT", "USUALUSDT": "VOLATILE_ALT",
    "AIXBTUSDT": "VOLATILE_ALT", "ONDOUSDT": "VOLATILE_ALT", "JASMYUSDT": "VOLATILE_ALT",
    "BLURUSDT": "VOLATILE_ALT", "MINAUSDT": "VOLATILE_ALT", "APEUSDT": "VOLATILE_ALT",
    "KAVAUSDT": "VOLATILE_ALT", "ROSEUSDT": "VOLATILE_ALT", "ZILUSDT": "VOLATILE_ALT",
    "FLOWUSDT": "VOLATILE_ALT", "EGLDUSDT": "VOLATILE_ALT", "QNTUSDT": "VOLATILE_ALT",
    "IOTAUSDT": "VOLATILE_ALT", "CAKEUSDT": "VOLATILE_ALT", "SNXUSDT": "VOLATILE_ALT",
    "1INCHUSDT": "VOLATILE_ALT"
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
        prof.stochLong = Math.max(12, prof.stochLong - 2);
        prof.stochShort = Math.min(88, prof.stochShort + 2);
        prof.atrMultiplier = parseFloat((prof.atrMultiplier + 0.12).toFixed(2));
        if (prof.consecutiveStops >= 2) {
            prof.quarantineUntil = Date.now() + (12 * 60 * 60 * 1000);
            sendTelegramMessage(`🛡️ <b>${symbol} 12 Saat Karantinaya Alındı!</b>\nPeş peşe 2 stop nedeniyle kasa koruması devreye girdi ve parametreler sıkılaştırıldı.`);
        }
    } else if (resultType === 'TP' || resultType === 'TP2' || resultType === 'LOCKED_PROFIT') {
        prof.totalTps++; 
        prof.consecutiveStops = 0;
    }
    saveWalletState();
}

// ==========================================
// 3. KALICI BİLEŞİK KASA & OTOMATİK BULUT YEDEKLEME
// ==========================================
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
            hist: tradeHistory.slice(-300),
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
        if (Array.isArray(parsed.hist) && parsed.hist.length > 0) tradeHistory = parsed.hist;
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
    }, 1500);
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
    "MATIC": "POL", "RNDR": "RENDER", "ASI": "FET", "TRX": "TRX", "HYPE": "HYPE", "ZEC": "ZEC",
    "CAT": "1000CAT", "TON": "TON", "XLM": "XLM", "ONDO": "ONDO", "TRUMP": "TRUMP", "PENGU": "PENGU",
    "PNUT": "PNUT", "VIRTUAL": "VIRTUAL", "EIGEN": "EIGEN", "ENS": "ENS", "DOT": "DOT", "KAITO": "KAITO"
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
    const lockedCount = filtered.filter(t => t.type === 'LOCKED_PROFIT').length;
    const rfCount = filtered.filter(t => t.type === 'RISK_FREE_CLOSE').length;
    const stopCount = filtered.filter(t => t.type === 'STOP' || t.type === 'MANUAL_LOSS').length;
    const totalWins = tp1Count + tp2Count + lockedCount;
    const total = totalWins + stopCount;
    if (total === 0 && rfCount === 0) return `• <b>Son ${hours} Saat:</b> Henüz sonuçlanan işlem yok`;
    const winRate = total > 0 ? ((totalWins / total) * 100).toFixed(1) : "100.0";
    const lockedBadge = lockedCount > 0 ? ` | 🛡️🟢 ${lockedCount} Kârlı-Koruma` : "";
    const rfBadge = rfCount > 0 ? ` | 🛡️ ${rfCount} Başabaş` : "";
    return `• <b>Son ${hours} Saat:</b> ${tp1Count} TP1 | ${tp2Count} TP2 | ${stopCount} Stop${lockedBadge}${rfBadge} (%${winRate} Win Rate)`;
}

function getStatsText() {
    const tp1Count = tradeHistory.filter(t => t.type === 'TP1' || t.type === 'MANUAL_WIN').length;
    const tp2Count = tradeHistory.filter(t => t.type === 'TP2').length;
    const lockedCount = tradeHistory.filter(t => t.type === 'LOCKED_PROFIT').length;
    const rfCount = tradeHistory.filter(t => t.type === 'RISK_FREE_CLOSE').length;
    const stopCount = tradeHistory.filter(t => t.type === 'STOP' || t.type === 'MANUAL_LOSS').length;
    const totalWins = tp1Count + tp2Count + lockedCount;
    const totalTrades = totalWins + stopCount;

    const currentBal = calculateCurrentBalance();
    const netDiff = currentBal - customStartingBalance;
    const netGainPct = customStartingBalance > 0 ? ((netDiff / customStartingBalance) * 100).toFixed(2) : "0.00";
    const sign = netDiff >= 0 ? "+" : "";
    const colorIcon = netDiff >= 0 ? "🟢" : "🔴";
    const totalWinRate = totalTrades > 0 ? ((totalWins / totalTrades) * 100).toFixed(1) : "0.0";
    const lockedTotalBadge = lockedCount > 0 ? ` | 🛡️🟢 ${lockedCount} Kârlı-Koruma` : "";
    const rfTotalBadge = rfCount > 0 ? ` | 🛡️ ${rfCount} Başabaş` : "";

    const text1 = getWindowCountsText(1);
    const text12 = getWindowCountsText(12);

    return `📊 <b>Canlı Başarı & Bileşik Kasa Simülasyonu:</b>\n${text1}\n${text12}\n• <b>Toplam Genel:</b> ${tp1Count} TP1 | ${tp2Count} TP2 | ${stopCount} Stop${lockedTotalBadge}${rfTotalBadge} (%${totalWinRate} Win Rate)\n  ↳ ${colorIcon} <b>Güncel Bileşik Kasa:</b> <b>$${currentBal.toFixed(2)}</b> <i>(Başlangıç: $${customStartingBalance} | Net: <b>${sign}$${netDiff.toFixed(2)} / ${sign}%${netGainPct}</b>)</i>`;
}

function getActiveSessionName() {
    const trHour = (new Date().getUTCHours() + 3) % 24;
    return trHour >= 2 && trHour < 10 ? "🌏 Asya Seansı" : trHour >= 10 && trHour < 16 ? "🇪🇺 Londra Seansı" : "🗽 New York Seansı";
}

// ==========================================
// 4. TELEGRAM API & OTOMATİK BULUT SENKRONİZASYON
// ==========================================
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
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const chatRes = await fetchJSON(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getChat?chat_id=${CHAT_ID}`, {}, 8000);
            if (chatRes && chatRes.ok && chatRes.result) {
                if (chatRes.result.pinned_message) {
                    const pinned = chatRes.result.pinned_message;
                    const txt = pinned.text || "";
                    const match = txt.match(/\[CLOUD_STATE:([A-Za-z0-9+/=]+)\]/);
                    if (match && match[1]) {
                        const ok = decodeAndApplyCloudState(match[1]);
                        cloudMessageId = pinned.message_id;
                        if (ok) {
                            console.log(`☁️ Bulut Hafıza Başarıyla Geri Yüklendi! Kasa: $${calculateCurrentBalance()} | Açık İşlem: ${activeTrades.size}`);
                            return { restored: true, hadPinnedMessage: true };
                        }
                    }
                    return { restored: false, hadPinnedMessage: true };
                } else {
                    return { restored: false, hadPinnedMessage: false };
                }
            }
        } catch (e) {}
        if (attempt < 3) await sleep(2000);
    }
    return { restored: false, hadPinnedMessage: true };
}

// ==========================================
// 5. KURUMSAL İNDİKATÖRLER, REGRESYON, PİVOT, SUPERTREND & MAKRO DOMİNANS
// ==========================================
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
            const c1 = ((curClose - curOpen) / curOpen) * 100;
            const c2 = ((curClose - prevOpen) / prevOpen) * 100;
            domChange15m = parseFloat((Math.abs(c1) > Math.abs(c2) ? c1 : c2).toFixed(2));
            domChange1h = parseFloat((((curClose - open1hAgo) / open1hAgo) * 100).toFixed(2));
        }
    } catch (e) {}

    if (!domIndexPrice || isNaN(domIndexPrice)) {
        domIndexPrice = parseFloat((cachedGlobalDom.btcDom * 100).toFixed(1));
        try {
            const [btcK, ethK] = await Promise.all([
                fetchUniversalKlines("BTCUSDT", "15", 6, true),
                fetchUniversalKlines("ETHUSDT", "15", 6, true)
            ]);
            if (btcK && ethK && btcK.length >= 5 && ethK.length >= 5) {
                const btcClose = parseFloat(btcK[btcK.length - 1][4]);
                const btcOpen15 = parseFloat(btcK[btcK.length - 1][1]);
                const btcOpen1h = parseFloat(btcK[btcK.length - 5][1]);

                const ethClose = parseFloat(ethK[ethK.length - 1][4]);
                const ethOpen15 = parseFloat(ethK[ethK.length - 1][1]);
                const ethOpen1h = parseFloat(ethK[ethK.length - 5][1]);

                const btcChg15 = ((btcClose - btcOpen15) / btcOpen15) * 100;
                const ethChg15 = ((ethClose - ethOpen15) / ethOpen15) * 100;
                const btcChg1h = ((btcClose - btcOpen1h) / btcOpen1h) * 100;
                const ethChg1h = ((ethClose - ethOpen1h) / ethOpen1h) * 100;

                domChange15m = parseFloat(((btcChg15 - ethChg15) * 0.45).toFixed(2));
                domChange1h = parseFloat(((btcChg1h - ethChg1h) * 0.45).toFixed(2));
            }
        } catch (e) {}
    }

    const isDomRisingFast = domChange15m >= 0.28 || domChange1h >= 0.45;
    const isDomFalling = domChange15m <= -0.15 || domChange1h <= -0.25;

    let regime = "NEUTRAL";
    let badge = `⚖️ Dengeli Akış (BTC.D: %${cachedGlobalDom.btcDom} | 1s: ${domChange1h >= 0 ? '+' : ''}%${domChange1h})`;
    let blockAltLongs = false;
    let boostAltLongs = false;
    let boostAltShorts = false;

    if (isDomRisingFast && btcTrend === "DUMP") {
        regime = "ALT_BLEED";
        blockAltLongs = true;
        boostAltShorts = true;
        badge = `🩸 Altcoin Kanama Kalkanı (BTC.D: %${cachedGlobalDom.btcDom} ⬆️ +%${domChange1h})`;
    } else if (isDomRisingFast) {
        regime = "BTC_SUCKING_LIQUIDITY";
        blockAltLongs = true;
        boostAltShorts = true;
        badge = `⚠️ BTC Likidite Emiyor / Alt Ezilmesi (BTC.D: %${cachedGlobalDom.btcDom} ⬆️ +%${domChange1h})`;
    } else if (isDomFalling && btcTrend !== "DUMP") {
        regime = "ALT_SEASON_FLOW";
        boostAltLongs = true;
        badge = `🚀 Altcoin Para Girişi (BTC.D: %${cachedGlobalDom.btcDom} ⬇️ %${domChange1h})`;
    }

    return {
        btcDom: cachedGlobalDom.btcDom,
        ethDom: cachedGlobalDom.ethDom,
        mcapChange24h: cachedGlobalDom.mcapChange24h,
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

// 9. KURUMSAL FİLTRE: 100 MUMLUK DOĞRUSAL REGRESYON KANALI (100, 2)
function calculateLinearRegressionChannel(closes, period = 100, devMult = 2.0) {
    const n = Math.min(Array.isArray(closes) ? closes.length : 0, period);
    if (n < 30) {
        return { mid: 0, upper: 0, lower: 0, slopePct: 0, posPct: 50, isFalling: false, isRising: false, blockLong: false, blockShort: false, boostLong: false, boostShort: false, badge: "Standart Kanal ⚙️" };
    }
    const slice = closes.slice(-n);
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += slice[i];
        sumXY += i * slice[i];
        sumXX += i * i;
    }
    const denom = (n * sumXX - sumX * sumX);
    const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;

    let sumSqErr = 0;
    for (let i = 0; i < n; i++) {
        const regVal = intercept + slope * i;
        const diff = slice[i] - regVal;
        sumSqErr += diff * diff;
    }
    const stdDev = Math.sqrt(sumSqErr / n);
    const currentMid = intercept + slope * (n - 1);
    const upper = currentMid + devMult * stdDev;
    const lower = currentMid - devMult * stdDev;
    const curPrice = slice[n - 1];

    const channelWidth = upper - lower;
    const posRatio = channelWidth > 0 ? (curPrice - lower) / channelWidth : 0.5;
    const posPct = Math.max(0, Math.min(100, Math.round(posRatio * 100)));
    const slopePct = currentMid > 0 ? ((slope * n) / currentMid) * 100 : 0;

    const isFalling = slopePct <= -0.85;
    const isRising = slopePct >= 0.85;

    // Düşen kanalın en tavanında (%78+) Long, yükselen kanalın en tabanında (%22-) Short açılmasını engeller
    const blockLong = (isFalling && posRatio >= 0.78) || posRatio >= 0.95;
    const blockShort = (isRising && posRatio <= 0.22) || posRatio <= 0.05;

    const boostLong = posRatio <= 0.35 && !isFalling;
    const boostShort = posRatio >= 0.65 && !isRising;

    const dirIcon = isRising ? "🟢↗️ Yükselen" : isFalling ? "🔴↘️ Düşen" : "⚪➡️ Yatay";
    const badge = `${dirIcon} Kanal (Konum: %${posPct} | Eğim: ${slopePct >= 0 ? '+' : ''}%${slopePct.toFixed(1)})`;

    return { mid: currentMid, upper, lower, slopePct, posPct, isFalling, isRising, blockLong, blockShort, boostLong, boostShort, badge };
}

// 10. KURUMSAL FİLTRE: GELENEKSEL PİVOT NOKTALARI (P, R1, R2, S1, S2)
function calculateTraditionalPivots(klines4h, currentPrice) {
    if (!klines4h || klines4h.length < 8 || !currentPrice) {
        return { P: 0, R1: 0, R2: 0, S1: 0, S2: 0, blockLong: false, blockShort: false, boostLong: false, boostShort: false, badge: "Pivot Nötr ⚙️" };
    }
    const prev6 = klines4h.slice(-7, -1);
    let high = -Infinity, low = Infinity;
    for (const c of prev6) {
        const h = parseFloat(c[2]);
        const l = parseFloat(c[3]);
        if (h > high) high = h;
        if (l < low) low = l;
    }
    const close = parseFloat(prev6[prev6.length - 1][4]);

    const P = (high + low + close) / 3;
    const R1 = (2 * P) - low;
    const S1 = (2 * P) - high;
    const R2 = P + (high - low);
    const S2 = P - (high - low);

    const distToR1Pct = ((R1 - currentPrice) / currentPrice) * 100;
    const distToR2Pct = ((R2 - currentPrice) / currentPrice) * 100;
    const distToS1Pct = ((currentPrice - S1) / currentPrice) * 100;
    const distToS2Pct = ((currentPrice - S2) / currentPrice) * 100;

    const blockLong = (distToR1Pct > 0 && distToR1Pct <= 0.28) || (distToR2Pct > 0 && distToR2Pct <= 0.28);
    const blockShort = (distToS1Pct > 0 && distToS1Pct <= 0.28) || (distToS2Pct > 0 && distToS2Pct <= 0.28);

    const boostLong = (Math.abs(distToS1Pct) <= 0.65) || (Math.abs(distToS2Pct) <= 0.75) || (currentPrice >= P && ((currentPrice - P) / P) * 100 <= 0.55);
    const boostShort = (Math.abs(distToR1Pct) <= 0.65) || (Math.abs(distToR2Pct) <= 0.75) || (currentPrice <= P && ((P - currentPrice) / P) * 100 <= 0.55);

    let zoneText = `P: $${formatPrice(P, currentPrice)}`;
    if (currentPrice >= R1) zoneText = `R1 Üzeri Güçlü (R2: $${formatPrice(R2, currentPrice)})`;
    else if (currentPrice >= P) zoneText = `Pivot Üzeri Pozitif (R1: $${formatPrice(R1, currentPrice)})`;
    else if (currentPrice >= S1) zoneText = `Pivot Altı Negatif (S1: $${formatPrice(S1, currentPrice)})`;
    else zoneText = `S1 Altı Dip Bölge (S2: $${formatPrice(S2, currentPrice)})`;

    return { P, R1, R2, S1, S2, blockLong, blockShort, boostLong, boostShort, badge: `🎯 ${zoneText}` };
}

// 11. KURUMSAL FİLTRE: SUPERTREND (ATR 10, ÇARPAN 1.5 - PUAN DESTEKLEYİCİ MOD)
function calculateSuperTrend(highs, lows, closes, period = 10, multiplier = 1.5) {
    if (!closes || closes.length < period + 5) {
        return { trend: "NEUTRAL", line: 0, isBull: true, isBear: true, nearFlipBull: false, nearFlipBear: false, badge: "SuperTrend Nötr" };
    }
    const tr = [highs[0] - lows[0]];
    for (let i = 1; i < closes.length; i++) {
        tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
    }

    const atr = new Array(closes.length).fill(0);
    let sumTr = 0;
    for (let i = 0; i < period; i++) sumTr += tr[i];
    atr[period - 1] = sumTr / period;
    for (let i = period; i < closes.length; i++) {
        atr[i] = ((atr[i - 1] * (period - 1)) + tr[i]) / period;
    }

    let finalUpper = 0, finalLower = 0;
    let trend = 1;
    let stLine = closes[0];

    for (let i = period; i < closes.length; i++) {
        const hl2 = (highs[i] + lows[i]) / 2;
        const basicUpper = hl2 + (multiplier * atr[i]);
        const basicLower = hl2 - (multiplier * atr[i]);

        if (i === period) {
            finalUpper = basicUpper;
            finalLower = basicLower;
            trend = closes[i] >= hl2 ? 1 : -1;
        } else {
            finalUpper = (basicUpper < finalUpper || closes[i - 1] > finalUpper) ? basicUpper : finalUpper;
            finalLower = (basicLower > finalLower || closes[i - 1] < finalLower) ? basicLower : finalLower;
            if (trend === 1 && closes[i] < finalLower) trend = -1;
            else if (trend === -1 && closes[i] > finalUpper) trend = 1;
        }
        stLine = trend === 1 ? finalLower : finalUpper;
    }

    const isBull = trend === 1;
    const isBear = trend === -1;
    const curPrice = closes[closes.length - 1];
    const distPct = curPrice > 0 ? (Math.abs(curPrice - stLine) / curPrice) * 100 : 1;
    const nearFlipBull = isBull || distPct <= 1.25;
    const nearFlipBear = isBear || distPct <= 1.25;

    const badge = isBull
        ? `🟢 SuperTrend AL ($${formatPrice(stLine, curPrice)})`
        : `🔴 SuperTrend SAT ($${formatPrice(stLine, curPrice)})`;

    return { trend: isBull ? "BULL" : "BEAR", line: stLine, isBull, isBear, nearFlipBull, nearFlipBear, badge };
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
            const blockLong = ratePct >= 0.055;
            const blockShort = ratePct <= -0.055;
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
                const isInflow = changePct >= 0.40;
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

    const isAlive = ratio >= 0.70;
    const isSpike = ratio >= 1.20;
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
    const isStrongTrend = roundedAdx >= 25;
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
        const nextIsStrongPump = nextClose > nextOpen && (nextClose - nextOpen) > Math.abs(close - open) * 1.4;
        const nextIsStrongDump = nextClose < nextOpen && (open - close) > Math.abs(nextOpen - nextClose) * 1.4;

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

function evaluateSignalQuality(side, stoch15m, volData, lsData, candleData, smc, adxData, sweepData, oiData, rsStrong, domData, regData, pivotData, stData) {
    let score = 0;
    if (volData.ratio >= 1.10) score++;
    if ((side === 'LONG' && stoch15m.k <= 20) || (side === 'SHORT' && stoch15m.k >= 80)) score++;
    if ((side === 'LONG' && lsData.longPct <= 58) || (side === 'SHORT' && lsData.shortPct <= 58)) score++;
    if (smc.hasOB || smc.hasFVG) score += 2;
    if ((side === 'LONG' && sweepData.bullSweep) || (side === 'SHORT' && sweepData.bearSweep)) score += 2;
    if (adxData.isStrongTrend) score++;
    if (oiData.isInflow) score++;
    if (rsStrong) score++;
    if ((side === 'LONG' && domData && domData.boostAltLongs) || (side === 'SHORT' && domData && domData.boostAltShorts)) score++;
    if ((side === 'LONG' && regData && regData.boostLong) || (side === 'SHORT' && regData && regData.boostShort)) score++;
    if ((side === 'LONG' && pivotData && pivotData.boostLong) || (side === 'SHORT' && pivotData && pivotData.boostShort)) score++;
    if ((side === 'LONG' && stData && stData.nearFlipBull) || (side === 'SHORT' && stData && stData.nearFlipBear)) score++;

    if (score >= 5) {
        return { stars: "🔥⭐⭐⭐⭐⭐", title: "A+ KURUMSAL QUANT & BALİNA SİNYALİ", score, qualityTier: 5 };
    } else if (score >= 4) {
        return { stars: "⭐⭐⭐⭐", title: "GÜÇLÜ MOMENTUM & SMC SİNYALİ", score, qualityTier: 4 };
    }
    return { stars: "⭐⭐⭐", title: "STANDART ONAYLI SİNYAL", score, qualityTier: 3 };
}

function analyze4HCandles(klines4h) {
    if (!klines4h || klines4h.length < 3) return { reportText: "⚠️ 4H Verisi Yetersiz", netGain: 0, lastCandleChange: 0, isBearDominance: false, isBullDominance: false, isRanging: true };
    const last3 = klines4h.slice(-3);
    const labels = ["Mum 1 (8-12s)", "Mum 2 (4-8s) ", "Mum 3 (Son 4s)"];
    const lines = [];
    let netGain = 0;
    let lastCandleChange = 0;
    for (let i = 0; i < 3; i++) {
        const open = parseFloat(last3[i][1]), high = parseFloat(last3[i][2]), low = parseFloat(last3[i][3]), close = parseFloat(last3[i][4]);
        const changePct = ((close - open) / open) * 100;
        netGain += changePct;
        if (i === 2) lastCandleChange = changePct;
        const rangePct = Math.abs(((high - low) / open) * 100);
        let barFill = Math.min(8, Math.max(1, Math.round(rangePct * 2)));
        lines.push(` ${labels[i]}: ${changePct >= 0 ? "🟢" : "🔴"} [${'█'.repeat(barFill) + '░'.repeat(8 - barFill)}] ${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}% | Genişlik: %${rangePct.toFixed(1)}`);
    }
    const isBullDominance = netGain >= 2.8 || lastCandleChange >= 1.50;
    const isBearDominance = netGain <= -2.8 || lastCandleChange <= -1.50;
    const isRanging = !isBullDominance && !isBearDominance;
    let netTrendText = isBullDominance ? "🟢 Güçlü Boğa Baskısı (4H)" : isBearDominance ? "🔴 Güçlü Ayı Baskısı (4H)" : "⚪ Yatay / Kararsız Seyir";
    return { reportText: `🕯️ <b>4H Makro Mum Yapısı (Bilgilendirme):</b>\n<pre>${lines.join('\n')}\n ↳ 4H Net Yön: ${netTrendText}</pre>`, netGain, lastCandleChange, isBullDominance, isBearDominance, isRanging };
}

function analyze1HMomentum(klines1h) {
    if (!klines1h || klines1h.length < 2) return { isWaterfall: false, isRocket: false, curChange: 0, prevChange: 0 };
    const cur = klines1h[klines1h.length - 1];
    const prev = klines1h[klines1h.length - 2];

    const curOpen = parseFloat(cur[1]), curClose = parseFloat(cur[4]);
    const prevOpen = parseFloat(prev[1]), prevClose = parseFloat(prev[4]);

    const curChange = ((curClose - curOpen) / curOpen) * 100;
    const prevChange = ((prevClose - prevOpen) / prevOpen) * 100;

    const isWaterfall = curChange <= -1.10 || (prevChange <= -1.25 && curChange < 0.10);
    const isRocket = curChange >= 1.10 || (prevChange >= 1.25 && curChange > -0.10);

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

    const bullCross = (k > d && k >= prevK + 1 && (prevK <= prevD + 3 || k - d >= 2));
    const bearCross = (k < d && k <= prevK - 1 && (prevK >= prevD - 3 || d - k >= 2));

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

// ==========================================
// 4 KATMANLI YEDEK VERİ HATTI + AKILLI ÖNBELLEK (RATE LIMIT KORUMASI)
// ==========================================
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

        if (attempt === 1) await sleep(200);
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
    if (changeCur <= -0.38 || changeTwo <= -0.48) btcTrend = "DUMP";
    else if (changeCur >= 0.38 || changeTwo >= 0.48) btcTrend = "PUMP";

    const shockDump = changeCur <= -0.48 || changeTwo <= -0.62;
    const shockPump = changeCur >= 0.48 || changeTwo >= 0.62;

    return { safe: Math.abs(worstChange) < 1.85, btcTrend, change15m: worstChange.toFixed(2), change1h: parseFloat(change1h.toFixed(2)), shockDump, shockPump };
}

// ==========================================
// 6. HIZLANDIRILMIŞ TELEGRAM KOMUTLARI
// ==========================================
async function sendDominanceReport(replyToId = null) {
    const btc = await checkBtcCondition();
    const dom = await checkDominanceCondition(btc.btcTrend);

    const othersDom = Math.max(0, parseFloat((100 - dom.btcDom - dom.ethDom).toFixed(2)));

    const makeBar = (pct, maxVal = 100) => {
        const filled = Math.min(12, Math.max(1, Math.round((pct / maxVal) * 12)));
        return '█'.repeat(filled) + '░'.repeat(12 - filled);
    };

    let btcDomComment = "";
    if (dom.btcDom >= 58) {
        btcDomComment = "⚠️ <i>(Yüksek Hakimiyet: Paranın büyük kısmı BTC'de, altcoinler seçici hareket eder)</i>";
    } else if (dom.btcDom >= 52) {
        btcDomComment = "⚖️ <i>(Dengeli Hakimiyet: BTC ve altcoinler arasında dengeli sermaye dağılımı)</i>";
    } else {
        btcDomComment = "🚀 <i>(Düşük Hakimiyet: Sermaye altcoinlere kaymış durumda, altcoin rallisine uygun)</i>";
    }

    let ethDomComment = "";
    if (dom.ethDom <= 12) {
        ethDomComment = "🥶 <i>(Zayıf Görünüm: ETH pazar payı düşük, majör altcoinlerde henüz tam güçlenme yok)</i>";
    } else if (dom.ethDom <= 16) {
        ethDomComment = "⚡ <i>(Normal Güç: Majör altcoinlere standart para girişi var)</i>";
    } else {
        ethDomComment = "🔥 <i>(Güçlü ETH: Altcoin piyasasına liderlik ediyor, Long iştahı yüksek)</i>";
    }

    let othersComment = othersDom >= 32
        ? "🟢 <i>(Altcoinlerde güçlü para tutunması var, altcoin tahtaları canlı)</i>"
        : "🟡 <i>(BTC ve ETH dışındaki tüm altcoinlerin toplam pazar payı)</i>";

    const chg15Icon = dom.domChange15m > 0.05 ? "🔺" : dom.domChange15m < -0.05 ? "🔻" : "➖";
    const chg1hIcon = dom.domChange1h > 0.08 ? "🔺" : dom.domChange1h < -0.08 ? "🔻" : "➖";

    let domFlowMeaning = "";
    if (dom.domChange1h >= 0.30 || dom.domChange15m >= 0.20) {
        domFlowMeaning = "🩸 <b>Anlamı:</b> BTC dominansı hızla yükseliyor! BTC piyasadaki likiditeyi emiyor, altcoinlerde <b>SHORT</b> baskısı artar.";
    } else if (dom.domChange1h <= -0.20 || dom.domChange15m <= -0.15) {
        domFlowMeaning = "💸 <b>Anlamı:</b> Dominans düşüyor! Para BTC'den çıkıp altcoinlere akıyor, altcoinlerde <b>LONG</b> fırsatları güçlenir.";
    } else {
        domFlowMeaning = "🧘‍♂️ <b>Anlamı:</b> Dominans şu an yatay ve sakin. Altcoinler BTC baskısı olmadan kendi iç hacmi ve tekniğiyle hareket ediyor.";
    }

    let mcapIcon = "⚪";
    let mcapMeaning = "";
    if (dom.mcapChange24h <= -3.0) {
        mcapIcon = "🔴📉";
        mcapMeaning = "<i>(Son 24 saatte piyasadan sert para çıkışı / küçülme var — Seçici olunmalı)</i>";
    } else if (dom.mcapChange24h < 0) {
        mcapIcon = "🟠↘️";
        mcapMeaning = "<i>(Piyasada hafif kâr satışı / para çıkışı hakim)</i>";
    } else if (dom.mcapChange24h >= 2.5) {
        mcapIcon = "🟢🚀";
        mcapMeaning = "<i>(Kripto piyasasına güçlü taze para girişi var — Boğa iştahı yüksek)</i>";
    } else {
        mcapIcon = "🟢↗️";
        mcapMeaning = "<i>(Piyasaya pozitif para girişi devam ediyor)</i>";
    }

    const btcIcon = btc.btcTrend === "DUMP" ? "🔴 Satış Baskılı" : btc.btcTrend === "PUMP" ? "🟢 Alım Yönlü" : "⚪ Sakin / Dengeli";

    let strategyAdvice = "⚖️ <b>AKTİF BOT STRATEJİSİ (ÇİFT YÖNLÜ DENGE):</b>\n• Piyasada tek yönlü bir dominans ezilmesi yok.\n• Bot şu an 125 paritede hem <b>🟢 LONG</b> hem de <b>🔴 SHORT</b> yönlü kurumsal sinyalleri eşit ağırlıkla tarıyor.";
    if (dom.regime === "ALT_SEASON_FLOW") {
        strategyAdvice = "🟢🚀 <b>AKTİF BOT STRATEJİSİ (ALTCOİN RALLİ AKIŞI):</b>\n• Sermaye BTC'den altcoinlere akıyor!\n• Altcoin <b>🟢 LONG</b> işlemleri ekstra kalite puanı (+1⭐) alıyor, zayıf Short sinyalleri filtreleniyor.";
    } else if (dom.regime === "BTC_SUCKING_LIQUIDITY") {
        strategyAdvice = "⚠️🛡️ <b>AKTİF BOT STRATEJİSİ (LİKİDİTE EMİLİM KALKANI):</b>\n• BTC dominansı sert yükseldiği için altcoinler ezilme riskinde.\n• Sıradan altcoin <b>LONG</b> işlemleri durduruldu! Sadece A+ Dip Likidite Avı ve <b>🔴 SHORT</b> fırsatları açılıyor.";
    } else if (dom.regime === "ALT_BLEED") {
        strategyAdvice = "🩸🚨 <b>AKTİF BOT STRATEJİSİ (ALTCOİN KANAMA KALKANI):</b>\n• BTC düşerken Dominans yükseliyor (Altcoinler için en tehlikeli senaryo)!\n• Altcoin <b>LONG</b> sinyalleri tamamen kilitlendi, bot <b>🔴 SHORT</b> yönlü işlemlere odaklandı.";
    }

    const msg = `👑 <b>MAKRO DOMİNANS & PARA AKIŞI RAPORU</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🟠 <b>Bitcoin Dominansı (BTC.D):</b> <b>%${dom.btcDom}</b>\n` +
        `  ↳ <code>[${makeBar(dom.btcDom, 80)}]</code>\n` +
        `  ↳ 💬 ${btcDomComment}\n\n` +
        `🔵 <b>Ethereum Dominansı (ETH.D):</b> <b>%${dom.ethDom}</b>\n` +
        `  ↳ <code>[${makeBar(dom.ethDom, 30)}]</code>\n` +
        `  ↳ 💬 ${ethDomComment}\n\n` +
        `🟣 <b>Diğer Altcoinler (OTHERS.D):</b> <b>%${othersDom}</b>\n` +
        `  ↳ <code>[${makeBar(othersDom, 50)}]</code>\n` +
        `  ↳ 💬 ${othersComment}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 <b>BTCDOM Vadeli Endeksi:</b> <b>$${dom.domIndexPrice ? dom.domIndexPrice.toFixed(1) : '5650.0'}</b>\n` +
        `  • ⏱ <b>15 Dakikalık:</b> ${chg15Icon} <b>${dom.domChange15m >= 0 ? '+' : ''}%${dom.domChange15m}</b> <i>(Kısa vadeli anlık para yönü)</i>\n` +
        `  • 🕐 <b>1 Saatlik:</b> ${chg1hIcon} <b>${dom.domChange1h >= 0 ? '+' : ''}%${dom.domChange1h}</b> <i>(Saatlik ana likidite akışı)</i>\n` +
        `  ↳ ${domFlowMeaning}\n\n` +
        `🌍 <b>24S Toplam Market Cap:</b> ${mcapIcon} <b>${dom.mcapChange24h >= 0 ? '+' : ''}%${dom.mcapChange24h}</b>\n` +
        `  ↳ 💬 ${mcapMeaning}\n\n` +
        `⚡ <b>BTC 15D Durumu:</b> %${btc.change15m} (${btcIcon})\n` +
        `🧭 <b>Anlık Piyasa Rejimi:</b> ${dom.badge}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${strategyAdvice}\n\n` +
        `⏱ <i>Rapor Saati: ${getTurkishTimeString()}</i>`;

    await sendTelegramMessage(msg, replyToId);
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

        let targetInfo = "";
        if (!t.tp1Hit) {
            const distTp1 = t.side === 'LONG' ? Math.max(0, ((t.tp1 - livePrice) / livePrice) * 100) : Math.max(0, ((livePrice - t.tp1) / livePrice) * 100);
            targetInfo = `🎯 TP1'e Kalan: %${distTp1.toFixed(2)}`;
        } else {
            const distTp2 = t.side === 'LONG' ? Math.max(0, ((t.tp2 - livePrice) / livePrice) * 100) : Math.max(0, ((livePrice - t.tp2) / livePrice) * 100);
            targetInfo = `🚀 TP2'ye Kalan: %${distTp2.toFixed(2)}`;
        }

        const lockNote = t.shockProtected && !t.tp1Hit ? " (🛡️🟢 Kâr Kilitli)" : "";
        lines.push(`• <b>#${clean}</b> (${t.side === 'LONG' ? '🟢 LONG' : '🔴 SHORT'}) | 📝 [SİMÜLE] | ${t.stars || '⭐⭐⭐'}\n  ↳ Giriş: $${formatPrice(t.entry, t.entry)} ➔ <b>Anlık: $${formatPrice(livePrice, t.entry)}</b>\n  ↳ ${pnlIcon} <b>Anlık PNL: ${pnlSign}%${pnlPct.toFixed(2)}</b> (${t.leverage}x: <b>${pnlSign}%${levPnl}</b> | <b>${pnlSign}$${dollarPnl}</b> | Marjin: $${Number(t.margin).toFixed(2)})\n  ↳ 🛑 Stop: $${formatPrice(t.sl, t.entry)}${lockNote} | ${targetInfo}\n`);
    }
    lines.push(`💡 <i>Kapatmak için: <b>/kapat coinadı</b> veya <b>/kapat hepsi</b> | Limit: <b>/kalkan ${maxSameSideTrades} ${maxTotalActiveTrades}</b></i>`);
    await sendTelegramMessage(lines.join('\n'), replyToId);
}

async function closeManualTradeCommand(rawTarget, replyToId = null) {
    if (!rawTarget) {
        return sendTelegramMessage(`⚠️ Lütfen kapatmak istediğiniz coini yazın. Örnek: <b>/kapat gmx</b> veya <b>/kapat hepsi</b>`, replyToId);
    }
    const cleanArg = normalizeCommandText(rawTarget).toUpperCase();
    const oldBalance = calculateCurrentBalance();

    if (cleanArg === 'HEPSI' || cleanArg === 'TUMU' || cleanArg === 'ALL') {
        if (activeTrades.size === 0) return sendTelegramMessage(`ℹ️ Kapatılacak açık işlem bulunmuyor.`, replyToId);
        let closedSummary = [];
        const entries = Array.from(activeTrades.entries());
        await Promise.all(entries.map(async ([sym, t]) => {
            t.lastPrice = await fetchLivePrice(sym, t.lastPrice || t.entry);
        }));

        for (const [sym, t] of entries) {
            const livePrice = t.lastPrice || t.entry;
            const pnlPct = t.side === 'LONG' ? (((livePrice - t.entry) / t.entry) * 100) : (((t.entry - livePrice) / t.entry) * 100);
            
            let effectivePnlPct = pnlPct;
            if (t.tp1Hit) {
                const tp1Pct = t.side === 'LONG' ? (((t.tp1 - t.entry) / t.entry) * 100) : (((t.entry - t.tp1) / t.entry) * 100);
                effectivePnlPct = Math.max(0, pnlPct - tp1Pct);
            }
            const dollarImpact = t.margin * (effectivePnlPct / 100) * t.leverage;
            tradeHistory.push({ type: pnlPct >= 0 ? 'MANUAL_WIN' : 'MANUAL_LOSS', symbol: sym, dollarImpact: parseFloat(dollarImpact.toFixed(4)), time: Date.now() });
            handleTradeResult(sym, pnlPct >= 0 ? 'TP' : 'STOP');

            closedSummary.push(`• <b>#${sym.replace('USDT', '')}</b> (${t.side}): ${pnlPct >= 0 ? '+' : ''}%${pnlPct.toFixed(2)} (${dollarImpact >= 0 ? '+' : ''}$${dollarImpact.toFixed(2)})`);
            activeTrades.delete(sym);
        }
        saveWalletState();
        const newBalance = calculateCurrentBalance();
        const diff = newBalance - oldBalance;
        const diffSign = diff >= 0 ? "+" : "";
        return sendTelegramMessage(`🖐️ <b>TÜMÜ MANUEL KAPATILDI!</b>\n\n${closedSummary.join('\n')}\n\n💼 <b>Kasa Hareketi:</b> $${oldBalance.toFixed(2)} ➔ <b>$${newBalance.toFixed(2)}</b> (<b>${diffSign}$${diff.toFixed(2)}</b>)\n\n${getStatsText()}`, replyToId);
    }

    let sym = cleanArg.replace(/[^A-Z0-9]/g, '');
    if (FUZZY_MAP[sym]) sym = FUZZY_MAP[sym];
    if (!sym.endsWith('USDT')) sym += 'USDT';

    if (!activeTrades.has(sym) && activeTrades.has('1000' + sym)) sym = '1000' + sym;
    if (!activeTrades.has(sym)) {
        return sendTelegramMessage(`⚠️ <b>#${cleanArg}</b> adında açık işlem bulunamadı.`, replyToId);
    }

    const t = activeTrades.get(sym);
    const livePrice = await fetchLivePrice(sym, t.lastPrice || t.entry);
    const pnlPct = t.side === 'LONG' ? (((livePrice - t.entry) / t.entry) * 100) : (((t.entry - livePrice) / t.entry) * 100);

    let effectivePnlPct = pnlPct;
    if (t.tp1Hit) {
        const tp1Pct = t.side === 'LONG' ? (((t.tp1 - t.entry) / t.entry) * 100) : (((t.entry - t.tp1) / t.entry) * 100);
        effectivePnlPct = Math.max(0, pnlPct - tp1Pct);
    }

    const dollarImpact = t.margin * (effectivePnlPct / 100) * t.leverage;
    activeTrades.delete(sym);
    recordTradeEvent(pnlPct >= 0 ? 'MANUAL_WIN' : 'MANUAL_LOSS', sym, dollarImpact);
    handleTradeResult(sym, pnlPct >= 0 ? 'TP' : 'STOP');

    const newBalance = calculateCurrentBalance();
    const diff = newBalance - oldBalance;
    const diffSign = diff >= 0 ? "+" : "";
    const sign = pnlPct >= 0 ? "+" : "";

    await sendTelegramMessage(`🖐️ <b>İŞLEM KAPATILDI | #${sym.replace('USDT', '')}</b>\n\n🎯 <b>Yön:</b> ${t.side === 'LONG' ? '🟢 LONG' : '🔴 SHORT'}\n💰 <b>PNL:</b> <b>${sign}%${pnlPct.toFixed(2)}</b> (${t.leverage}x: ${sign}%${(pnlPct * t.leverage).toFixed(1)})\n💵 <b>Net Dolar Etkisi:</b> <b>${diffSign}$${dollarImpact.toFixed(2)}</b>\n💼 <b>Kasa Hareketi:</b> $${oldBalance.toFixed(2)} ➔ <b>$${newBalance.toFixed(2)}</b>\n\n${getStatsText()}`, replyToId);
}

async function sendCoinPerformanceReport(replyToId = null) {
    if (tradeHistory.length === 0) {
        return sendTelegramMessage(`🏆 <b>COİN PERFORMANS KARNESİ</b>\n\nHenüz sonuçlanmış işlem verisi yok.`, replyToId);
    }
    const stats = new Map();
    for (const item of tradeHistory) {
        if (!item.symbol) continue;
        const clean = item.symbol.replace('USDT', '');
        if (!stats.has(clean)) stats.set(clean, { wins: 0, stops: 0, tp2s: 0 });
        const st = stats.get(clean);
        if (item.type === 'TP1' || item.type === 'MANUAL_WIN' || item.type === 'LOCKED_PROFIT') st.wins++;
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
        msg += `🌟 <b>En Çok Kazandıranlar:</b>\n`;
        for (const b of best) msg += `• <b>#${b.coin}:</b> ${b.wins} Kâr (${b.tp2s} TP2) | ${b.stops} Stop\n`;
        msg += `\n`;
    }
    if (worst.length > 0) {
        msg += `⚠️ <b>En Çok Stop Edenler:</b>\n`;
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
            risky.push(`• ⚠️ <b>#${clean}:</b> Peş peşe ${prof.consecutiveStops} Stop`);
        }
    }
    let text = `🛡️ <b>KARANTİNA VE RİSK DURUMU</b>\n\n`;
    if (quarantined.length === 0 && risky.length === 0) {
        text += `✅ Karantinada hiçbir parite yok. Tüm ${TARGET_COINS.length} parite aktif.`;
    } else {
        if (quarantined.length > 0) text += `<b>Karantinadakiler:</b>\n${quarantined.join('\n')}\n\n`;
        if (risky.length > 0) text += `<b>Sıkılaştırılmışlar:</b>\n${risky.join('\n')}`;
    }
    await sendTelegramMessage(text, replyToId);
}

async function sendWalletReport(replyToId = null) {
    const startStr = getTurkishDateTimeString(walletStartTime);
    const currentBal = calculateCurrentBalance();
    const msg = `💰 <b>KALICI BİLEŞİK KASA RAPORU (SABİT RİSK MOTORU)</b>\n\n🗓️ <b>Başlangıç Tarihi:</b> ${startStr}\n💵 <b>İlk Başlangıç Bakiyesi:</b> $${customStartingBalance}\n💵 <b>Güncel Bileşik Bakiye:</b> <b>$${currentBal.toFixed(2)}</b>\n🛡️ <b>İşlem Başı Maksimum Stop Riski (ATR Bazlı):</b>\n  • 3⭐ Standart (%1.1 Kasa Riski): <b>-$${(currentBal * 0.011).toFixed(2)}</b>\n  • 4⭐ Güçlü (%1.35 Kasa Riski): <b>-$${(currentBal * 0.0135).toFixed(2)}</b>\n  • 5⭐ VIP (%1.6 Kasa Riski): <b>-$${(currentBal * 0.016).toFixed(2)}</b>\n📂 <b>Açık İşlem:</b> ${activeTrades.size} / ${maxTotalActiveTrades} (Tek Yön Limiti: ${maxSameSideTrades})\n🪙 <b>Taranan Sepet:</b> ${TARGET_COINS.length} Vadeli Parite\n☁️ <b>Bulut Senkronizasyon:</b> Aktif ✅\n\n${getStatsText()}`;
    await sendTelegramMessage(msg, replyToId);
}

async function analyzeSpecificCoin(rawSymbol, replyToId = null) {
    let clean = normalizeCommandText(rawSymbol).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if ( clean.endsWith('USDT') ) clean = clean.replace(/USDT$/, '');
    if (FUZZY_MAP[clean]) clean = FUZZY_MAP[clean];
    const baseSym = clean + 'USDT';

    let symbol = baseSym;
    let klines15m = await fetchUniversalKlines(symbol, "15", 105, true);
    if ((!klines15m || klines15m.length < 25) && !symbol.startsWith('1000')) {
        symbol = '1000' + baseSym;
        klines15m = await fetchUniversalKlines(symbol, "15", 105, true);
    }
    if (!klines15m || klines15m.length < 25) {
        return sendTelegramMessage(`⚠️ <b>#${baseSym}</b> için borsalardan şu an yanıt alınamadı, lütfen 5 saniye sonra tekrar deneyin.`, replyToId);
    }
    
    const currentPrice = parseFloat(klines15m[klines15m.length - 1][4]);

    const [klines1h, klines4h, fundingData, lsSizeData, oiData, domData] = await Promise.all([
        fetchUniversalKlines(symbol, "60", 55, true),
        fetchUniversalKlines(symbol, "240", 55, true),
        fetchFundingRate(symbol),
        fetchLongShortSizeData(symbol, currentPrice),
        fetchOpenInterestData(symbol),
        checkDominanceCondition()
    ]);

    const highs15 = klines15m.map(k => parseFloat(k[2]));
    const lows15 = klines15m.map(k => parseFloat(k[3]));
    const closes15 = klines15m.map(k => parseFloat(k[4]));
    const stoch15m = calculateStochRSI(closes15);
    const volData = analyze15MVolume(klines15m);
    const smc = detectSmartMoneyStructure(klines15m);
    const adxData = calculateADX(highs15, lows15, closes15);
    const sweepData = detectLiquiditySweep(klines15m);
    const regData = calculateLinearRegressionChannel(closes15, 100, 2.0);
    const pivotData = calculateTraditionalPivots(klines4h, currentPrice);
    const stData = calculateSuperTrend(highs15, lows15, closes15, 10, 1.5);
    
    let rsi1h = 50, ema50_1h = currentPrice;
    if (klines1h && klines1h.length >= 20) {
        const closes1h = klines1h.map(k => parseFloat(k[4]));
        rsi1h = Math.round(calculateRSI(closes1h, 14));
        ema50_1h = calculateEMA(closes1h, 50) || calculateEMA(closes1h, 20) || currentPrice;
    }

    const isBull1H = (currentPrice >= ema50_1h * 0.992 && rsi1h >= 44);
    const isBear1H = (currentPrice <= ema50_1h * 1.008 && rsi1h <= 56);
    let trendText = isBull1H ? "🟢 Yükseliş / EMA50 Üzeri" : isBear1H ? "🔴 Düşüş Eğilimi / EMA50 Altı" : "⚪ Yatay / Kararsız";
    
    const candleData = analyze4HCandles(klines4h);
    let crossText = stoch15m.bullCross ? "🟢 Yukarı Kesişim" : stoch15m.bearCross ? "🔴 Aşağı Kesişim" : "⏳ Kesişim Bekleniyor";

    let openTradeNote = "";
    if (activeTrades.has(symbol)) {
        const t = activeTrades.get(symbol);
        const pnlPct = t.side === 'LONG' ? (((currentPrice - t.entry) / t.entry) * 100) : (((t.entry - currentPrice) / t.entry) * 100);
        const sign = pnlPct >= 0 ? "+" : "";
        openTradeNote = `\n📂 <b>Açık İşlem Durumu:</b> ${t.side} | Giriş: $${formatPrice(t.entry, t.entry)} | PNL: <b>${sign}%${pnlPct.toFixed(2)}</b> (Marjin: $${Number(t.margin).toFixed(2)})\n`;
    }

    const reportMsg = `👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n🔍 <b>ÖZEL COİN ANALİZİ | #${symbol.replace('USDT', '')}</b>${openTradeNote}\n💵 <b>Anlık Fiyat:</b> $${formatPrice(currentPrice, currentPrice)}\n🧭 <b>1H Trend:</b> ${trendText} (RSI: ${rsi1h})\n⚡ <b>SuperTrend (10,1.5):</b> ${stData.badge}\n📐 <b>Trend Gücü (ADX):</b> ${adxData.badge}\n📏 <b>Regresyon Kanalı (100,2):</b> ${regData.badge}\n🎯 <b>Kurumsal Pivot:</b> ${pivotData.badge}\n📊 <b>15M Stoch:</b> %K: ${stoch15m.k} | %D: ${stoch15m.d} (${crossText})\n📈 <b>Hacim:</b> ${volData.badge}\n🐋 <b>Açık Pozisyon (OI):</b> ${oiData.badge}\n🏛️ <b>SMC:</b> ${smc.smcBadge}\n🧲 <b>Likidite:</b> ${sweepData.badge}\n👑 <b>Dominans Akışı:</b> ${domData.badge}\n💸 <b>Funding:</b> ${fundingData.text}\n\n${lsSizeData.text}\n\n${candleData.reportText}\n\n⚠️ <i>"YTD" HEPSİ.</i>`;
    await sendTelegramMessage(reportMsg, replyToId);
}

async function scanExtremes(type, replyToId = null) {
    await sendTelegramMessage(`🔍 <b>${type === 'DIP' ? 'Stoch Dip (%K <= 35)' : 'Stoch Tepe (%K >= 65)'} Pariteler Taranıyor...</b>`, replyToId);
    const valid = [];
    for (const sym of TARGET_COINS.slice(0, 60)) {
        try {
            const k15 = await fetchUniversalKlines(sym, "15", 50, true);
            await sleep(15);
            if (!k15 || k15.length < 30) continue;
            const closes = k15.map(k => parseFloat(k[4]));
            const stoch = calculateStochRSI(closes);
            const cur = closes[closes.length - 1];
            if (type === 'DIP' && stoch.k <= 35) valid.push({ sym: sym.replace('USDT', ''), k: stoch.k, d: stoch.d, price: cur });
            else if (type === 'TEPE' && stoch.k >= 65) valid.push({ sym: sym.replace('USDT', ''), k: stoch.k, d: stoch.d, price: cur });
        } catch (e) {}
    }
    valid.sort((a, b) => type === 'DIP' ? a.k - b.k : b.k - a.k);
    if (valid.length === 0) return sendTelegramMessage(`ℹ️ Uygun parite bulunamadı.`, replyToId);

    let text = `🎯 <b>${type === 'DIP' ? '🟢 DİPTEKİ PARİTELER' : '🔴 TEPEDEKİ PARİTELER'}</b>\n\n`;
    for (const r of valid.slice(0, 10)) {
        text += `• <b>#${r.sym}:</b> %K:${r.k} / %D:${r.d} | $${formatPrice(r.price, r.price)}\n`;
    }
    await sendTelegramMessage(text, replyToId);
}

async function handleSingleTelegramCommand(message) {
    const rawTxt = (message.text || "").trim();
    const normTxt = normalizeCommandText(rawTxt);
    const msgId = message.message_id;

    if (normTxt === 'acik' || normTxt === '/acik') return sendOpenTradesReport(msgId);
    if (normTxt === 'kasa' || normTxt === '/kasa') return sendWalletReport(msgId);
    if (normTxt === 'dominans' || normTxt === '/dominans' || normTxt === 'dom' || normTxt === '/dom') return sendDominanceReport(msgId);
    if (normTxt === 'karantina' || normTxt === '/karantina') return sendQuarantineReport(msgId);
    if (normTxt === 'karne' || normTxt === '/karne') return sendCoinPerformanceReport(msgId);
    if (normTxt === 'dip' || normTxt === '/dip') return scanExtremes('DIP', msgId);
    if (normTxt === 'tepe' || normTxt === '/tepe') return scanExtremes('TEPE', msgId);

    if (normTxt.startsWith('/kalkan') || normTxt.startsWith('kalkan')) {
        const parts = rawTxt.trim().split(/\s+/);
        const n1 = parseInt(parts[1], 10);
        const n2 = parseInt(parts[2], 10);

        if (!isNaN(n1) && !isNaN(n2) && n1 > 0 && n2 > 0) {
            maxSameSideTrades = Math.min(n1, n2);
            maxTotalActiveTrades = Math.max(n1, n2);
            saveWalletState();
            return sendTelegramMessage(`🛡️ <b>RİSK KALKANI LİMİTLERİ GÜNCELLENDİ!</b>\n\n• <b>Toplam Maksimum Açık İşlem:</b> ${maxTotalActiveTrades} adet\n• <b>Tek Yön (Long/Short) Limiti:</b> ${maxSameSideTrades} adet\n☁️ <i>Yeni limitler bulut hafızaya kaydedildi.</i>`, msgId);
        } else if (!isNaN(n1) && n1 > 0) {
            maxTotalActiveTrades = n1;
            maxSameSideTrades = Math.max(1, Math.ceil(n1 * 0.65));
            saveWalletState();
            return sendTelegramMessage(`🛡️ <b>RİSK KALKANI LİMİTLERİ GÜNCELLENDİ!</b>\n\n• <b>Toplam Maksimum Açık İşlem:</b> ${maxTotalActiveTrades} adet\n• <b>Tek Yön (Long/Short) Limiti:</b> ${maxSameSideTrades} adet\n☁️ <i>Yeni limitler bulut hafızaya kaydedildi.</i>`, msgId);
        } else {
            return sendTelegramMessage(`🛡️ <b>AKTİF KALKAN LİMİTLERİ</b>\n\n• <b>Toplam Maksimum İşlem:</b> ${maxTotalActiveTrades}\n• <b>Tek Yön Limiti:</b> ${maxSameSideTrades}\n\n💡 <i>Değiştirmek için: <b>/kalkan 8 12</b> veya <b>/kalkan 10 15</b> yazabilirsiniz.</i>`, msgId);
        }
    }

    if (normTxt === 'yedek' || normTxt === '/yedek') {
        await syncStateToTelegramCloud();
        const code = encodeCloudState();
        return sendTelegramMessage(`☁️ <b>BULUT YEDEK GÜNCELLENDİ!</b>\nSabitlenmiş mesaja otomatik kaydedildi.\n\nManuel Yedek Kodu:\n<code>/yukle ${code}</code>`, msgId);
    }

    if (normTxt.startsWith('/yukle ') || normTxt.startsWith('yukle ')) {
        const base64Part = rawTxt.split(/\s+/)[1];
        if (base64Part && decodeAndApplyCloudState(base64Part)) {
            return sendTelegramMessage(`✅ <b>YEDEK BAŞARIYLA GERİ YÜKLENDİ!</b>\nAçık İşlem: ${activeTrades.size} | Güncel Kasa: $${calculateCurrentBalance().toFixed(2)}`, msgId);
        } else {
            return sendTelegramMessage(`⚠️ Geçersiz yedek kodu.`, msgId);
        }
    }

    if (normTxt.startsWith('/bakiye') || normTxt.startsWith('bakiye') || normTxt.startsWith('/kasaguncelle')) {
        const parts = rawTxt.split(/\s+/);
        const val = parseFloat(parts[1]);
        if (!isNaN(val) && val > 0) {
            resetPermanentWallet(val);
            return sendTelegramMessage(`💰 <b>KASA BAKİYESİ BAŞARIYLA GÜNCELLENDİ!</b>\n\nSimüle kasa bütçesi <b>$${val.toFixed(2)}</b> olarak ayarlandı ve buluta kaydedildi.\n⏱ <b>${getTurkishTimeString()}</b>`, msgId);
        } else {
            return sendTelegramMessage(`⚠️ Lütfen geçerli bir tutar yazın. Örnek: <b>/bakiye 1000</b>`, msgId);
        }
    }

    if (normTxt.startsWith('/kapat') || normTxt.startsWith('kapat ')) {
        const arg = rawTxt.split(/\s+/)[1];
        return closeManualTradeCommand(arg, msgId);
    }

    if (normTxt === 'sifirla' || normTxt === '/sifirla') {
        resetPermanentWallet(1000);
        return sendTelegramMessage(`🔄 <b>SİMÜLE KASA $1000 OLARAK SIFIRLANDI!</b>\nGeçmiş hatalı istatistikler temizlendi.\n⏱ <b>${getTurkishTimeString()}</b>`, msgId);
    }

    if (normTxt === 'yardim' || normTxt === '/yardim' || normTxt === 'komutlar' || normTxt === '/komutlar') {
        return sendTelegramMessage(`🤖 <b>KOMUT LİSTESİ:</b>\n\n• <b>/acik</b> : Açık işlemleri anında listeler.\n• <b>/dominans</b> : Canlı BTC.D, ETH.D ve Altcoin Para Akışı raporunu gösterir.\n• <b>/kalkan 8 12</b> : Tek yön ve toplam açık işlem sınırını günceller.\n• <b>/kapat coin</b> : İşlemi kapatır ve kasaya ekler (Örn: <code>/kapat gmx</code> veya <code>/kapat hepsi</code>).\n• <b>/bakiye 1000</b> : Kasayı istediğiniz tutara günceller.\n• <b>/kasa</b> : Bileşik kasa raporunu ve sabit risk oranlarını gösterir.\n• <b>/yedek</b> : Açık işlemleri ve kasayı buluta yedekler.\n• <b>/karne</b> : Coin performans karnesini gösterir.\n• <b>/karantina</b> : Cezalı coinleri gösterir.\n• <b>/sifirla</b> : Kasayı $1000 yapar.\n• <b>/dip /tepe</b> : Taramalar.`, msgId);
    }

    let targetCoin = null;
    if (normTxt.startsWith('/analiz')) targetCoin = rawTxt.split(/\s+/)[1];
    else if (rawTxt.length >= 2 && rawTxt.length <= 12 && !rawTxt.includes(' ') && !rawTxt.startsWith('/')) targetCoin = rawTxt;
    
    if (targetCoin) {
        return analyzeSpecificCoin(targetCoin, msgId);
    }
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

// ==========================================
// 7. CANLI FİYAT (LIVE PRICE) İŞLEM TAKİBİ (+0.30R KÂRLI BAŞABAŞ KİLİDİ)
// ==========================================
async function checkActiveTrades(symbol, currentPrice, btc) {
    if (tradeCheckLocks.has(symbol)) return;
    const trade = activeTrades.get(symbol);
    if (!trade) return;

    tradeCheckLocks.add(symbol);
    try {
        trade.lastPrice = currentPrice;
        if (!trade.highestSeen || currentPrice > trade.highestSeen) trade.highestSeen = currentPrice;
        if (!trade.lowestSeen || currentPrice < trade.lowestSeen) trade.lowestSeen = currentPrice;

        if (Date.now() - trade.time < 15000) return;

        const cleanSymbol = symbol.replace('USDT', '');
        const nowTime = getTurkishTimeString();

        if (trade.side === 'LONG') {
            const curProfitPct = ((currentPrice - trade.entry) / trade.entry) * 100;
            const tp1TargetPct = ((trade.tp1 - trade.entry) / trade.entry) * 100;

            if (!trade.tp1Hit && !trade.shockProtected && ((tp1TargetPct > 0 && curProfitPct >= tp1TargetPct * 0.72) || (curProfitPct >= 0.55 && (btc.btcTrend === 'DUMP' || btc.shockDump)))) {
                trade.shockProtected = true;
                const lockPrice = trade.entry + ((trade.tp1 - trade.entry) * 0.30);
                trade.sl = lockPrice < currentPrice ? lockPrice : trade.entry;
                const lockedPct = ((trade.sl - trade.entry) / trade.entry) * 100;
                const lockedDollar = trade.margin * (lockedPct / 100) * trade.leverage;
                saveWalletState();
                await sendTelegramMessage(`⚡🛡️🟢 <b>KÂRLI BAŞABAŞ (+0.30R) KİLİTLENDİ | #${cleanSymbol}/USDT</b>\nFiyat hedefe yaklaştı (+%${curProfitPct.toFixed(2)}), stop kârlı bölgeye ($${formatPrice(trade.sl, trade.entry)} | Garanti Kâr: <b>+$${lockedDollar.toFixed(2)}</b>) çekildi!`);
                return;
            }

            if (currentPrice >= trade.tp2) {
                const prevBal = calculateCurrentBalance();
                const tp2GainPct = ((trade.tp2 - trade.entry) / trade.entry) * 100;
                const prevTp1Pct = trade.tp1Hit ? (((trade.tp1 - trade.entry) / trade.entry) * 100) : 0;
                const remainingPct = Math.max(0, tp2GainPct - prevTp1Pct);
                const dollarImpact = trade.margin * (remainingPct / 100) * trade.leverage;

                activeTrades.delete(symbol);
                recordTradeEvent('TP2', symbol, dollarImpact);
                handleTradeResult(symbol, 'TP2');
                const newBal = calculateCurrentBalance();

                await sendTelegramMessage(`👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n✅✅ <b>TP2 TAMAMLANDI! | #${cleanSymbol}/USDT</b>\n🚀 <b>Net Ek Kazanım:</b> +$${dollarImpact.toFixed(2)} (Toplam Hedef: +%${tp2GainPct.toFixed(2)})\n💼 <b>Kasa Hareketi:</b> $${prevBal.toFixed(2)} ➔ <b>$${newBal.toFixed(2)}</b>\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
                return;
            }

            if (!trade.tp1Hit && currentPrice >= trade.tp1) {
                trade.tp1Hit = true;
                trade.tp1HitTime = Date.now();
                trade.sl = trade.entry + ((trade.tp1 - trade.entry) * 0.25);
                const prevBal = calculateCurrentBalance();
                const tp1GainPct = ((trade.tp1 - trade.entry) / trade.entry) * 100;
                const dollarImpact = trade.margin * (tp1GainPct / 100) * trade.leverage;
                recordTradeEvent('TP1', symbol, dollarImpact);
                handleTradeResult(symbol, 'TP');
                const newBal = calculateCurrentBalance();

                await sendTelegramMessage(`👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n✅ <b>TP1 ALINDI! | #${cleanSymbol}/USDT</b>\n💰 <b>Kazanılan:</b> +%${tp1GainPct.toFixed(2)} (<b>+$${dollarImpact.toFixed(2)}</b> | Marjin: $${Number(trade.margin).toFixed(2)})\n💼 <b>Kasa Hareketi:</b> $${prevBal.toFixed(2)} ➔ <b>$${newBal.toFixed(2)}</b>\n🛡️ Stop kârlı giriş üstüne çekildi. İşlem TP2 için devam ediyor!\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
                return;
            }

            const midTargetLong = trade.tp1 + ((trade.tp2 - trade.tp1) * 0.5);
            if (trade.tp1Hit && !trade.trailingHit && currentPrice >= midTargetLong) {
                trade.trailingHit = true;
                trade.sl = trade.tp1;
                saveWalletState();
                await sendTelegramMessage(`🔒 <b>KÂR KİLİTLENDİ (İZ SÜREN) | #${cleanSymbol}/USDT</b>\nStop TP1 seviyesine ($${formatPrice(trade.tp1, trade.entry)}) çekildi.`);
                return;
            }

            if (currentPrice <= trade.sl) {
                if (trade.tp1Hit && trade.tp1HitTime && (Date.now() - trade.tp1HitTime < 20000)) return;
                const prevBal = calculateCurrentBalance();
                activeTrades.delete(symbol);
                if (trade.trailingHit) {
                    saveWalletState();
                    await sendTelegramMessage(`🔒✅ <b>İZ SÜREN STOP (TP1 SEVİYESİNDE) KAPANDI | #${cleanSymbol}/USDT</b>\nTP1 kârı korunarak işlem tamamlandı (Kasa: $${prevBal.toFixed(2)}).\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
                } else if (trade.tp1Hit) {
                    recordTradeEvent('RISK_FREE_CLOSE', symbol, 0);
                    await sleep(Math.floor(Math.random() * 1200));
                    saveWalletState();
                    await sendTelegramMessage(`🛡️ <b>TP1 SONRASI KORUNARAK KAPANDI | #${cleanSymbol}/USDT</b> (TP1 Kârı Kasada | Kasa: $${prevBal.toFixed(2)})\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
                } else if (trade.shockProtected) {
                    const lockedGainPct = Math.max(0, ((trade.sl - trade.entry) / trade.entry) * 100);
                    const lockedDollar = trade.margin * (lockedGainPct / 100) * trade.leverage;
                    if (lockedDollar > 0.01) {
                        recordTradeEvent('LOCKED_PROFIT', symbol, lockedDollar);
                        handleTradeResult(symbol, 'LOCKED_PROFIT');
                    } else {
                        recordTradeEvent('RISK_FREE_CLOSE', symbol, 0);
                    }
                    const newBal = calculateCurrentBalance();
                    await sleep(Math.floor(Math.random() * 1200));
                    saveWalletState();
                    await sendTelegramMessage(`🛡️🟢 <b>KÂRLI BAŞABAŞ KORUMASIYLA KAPANDI | #${cleanSymbol}/USDT</b>\n💰 <b>Kilitlenen Net Kâr:</b> +%${lockedGainPct.toFixed(2)} (<b>+$${lockedDollar.toFixed(2)}</b>)\n💼 <b>Kasa Hareketi:</b> $${prevBal.toFixed(2)} ➔ <b>$${newBal.toFixed(2)}</b>\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
                } else {
                    const slLossPct = ((trade.sl - trade.entry) / trade.entry) * 100;
                    const dollarImpact = trade.margin * (slLossPct / 100) * trade.leverage;
                    recordTradeEvent('STOP', symbol, dollarImpact);
                    handleTradeResult(symbol, 'STOP');
                    const newBal = calculateCurrentBalance();
                    await sendTelegramMessage(`❌ <b>STOP TETİKLENDİ | #${cleanSymbol}/USDT</b>\nZarar: %${slLossPct.toFixed(2)} (<b>-$${Math.abs(dollarImpact).toFixed(2)}</b> | Marjin: $${Number(trade.margin).toFixed(2)})\n💼 <b>Kasa Hareketi:</b> $${prevBal.toFixed(2)} ➔ <b>$${newBal.toFixed(2)}</b>\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
                }
                return;
            }
        }

        if (trade.side === 'SHORT') {
            const curProfitPct = ((trade.entry - currentPrice) / trade.entry) * 100;
            const tp1TargetPct = ((trade.entry - trade.tp1) / trade.entry) * 100;

            if (!trade.tp1Hit && !trade.shockProtected && ((tp1TargetPct > 0 && curProfitPct >= tp1TargetPct * 0.72) || (curProfitPct >= 0.55 && (btc.btcTrend === 'PUMP' || btc.shockPump)))) {
                trade.shockProtected = true;
                const lockPrice = trade.entry - ((trade.entry - trade.tp1) * 0.30);
                trade.sl = lockPrice > currentPrice ? lockPrice : trade.entry;
                const lockedPct = ((trade.entry - trade.sl) / trade.entry) * 100;
                const lockedDollar = trade.margin * (lockedPct / 100) * trade.leverage;
                saveWalletState();
                await sendTelegramMessage(`⚡🛡️🟢 <b>KÂRLI BAŞABAŞ (+0.30R) KİLİTLENDİ | #${cleanSymbol}/USDT</b>\nFiyat hedefe yaklaştı (+%${curProfitPct.toFixed(2)}), stop kârlı bölgeye ($${formatPrice(trade.sl, trade.entry)} | Garanti Kâr: <b>+$${lockedDollar.toFixed(2)}</b>) çekildi!`);
                return;
            }

            if (currentPrice <= trade.tp2) {
                const prevBal = calculateCurrentBalance();
                const tp2GainPct = ((trade.entry - trade.tp2) / trade.entry) * 100;
                const prevTp1Pct = trade.tp1Hit ? (((trade.entry - trade.tp1) / trade.entry) * 100) : 0;
                const remainingPct = Math.max(0, tp2GainPct - prevTp1Pct);
                const dollarImpact = trade.margin * (remainingPct / 100) * trade.leverage;

                activeTrades.delete(symbol);
                recordTradeEvent('TP2', symbol, dollarImpact);
                handleTradeResult(symbol, 'TP2');
                const newBal = calculateCurrentBalance();

                await sendTelegramMessage(`👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n✅✅ <b>TP2 TAMAMLANDI! | #${cleanSymbol}/USDT</b>\n🚀 <b>Net Ek Kazanım:</b> +$${dollarImpact.toFixed(2)} (Toplam Hedef: +%${tp2GainPct.toFixed(2)})\n💼 <b>Kasa Hareketi:</b> $${prevBal.toFixed(2)} ➔ <b>$${newBal.toFixed(2)}</b>\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
                return;
            }

            if (!trade.tp1Hit && currentPrice <= trade.tp1) {
                trade.tp1Hit = true;
                trade.tp1HitTime = Date.now();
                trade.sl = trade.entry - ((trade.entry - trade.tp1) * 0.25);
                const prevBal = calculateCurrentBalance();
                const tp1GainPct = ((trade.entry - trade.tp1) / trade.entry) * 100;
                const dollarImpact = trade.margin * (tp1GainPct / 100) * trade.leverage;
                recordTradeEvent('TP1', symbol, dollarImpact);
                handleTradeResult(symbol, 'TP');
                const newBal = calculateCurrentBalance();

                await sendTelegramMessage(`👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n✅ <b>TP1 ALINDI! | #${cleanSymbol}/USDT</b>\n💰 <b>Kazanılan:</b> +%${tp1GainPct.toFixed(2)} (<b>+$${dollarImpact.toFixed(2)}</b> | Marjin: $${Number(trade.margin).toFixed(2)})\n💼 <b>Kasa Hareketi:</b> $${prevBal.toFixed(2)} ➔ <b>$${newBal.toFixed(2)}</b>\n🛡️ Stop kârlı giriş altına çekildi. İşlem TP2 için devam ediyor!\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
                return;
            }

            const midTargetShort = trade.tp1 - ((trade.tp1 - trade.tp2) * 0.5);
            if (trade.tp1Hit && !trade.trailingHit && currentPrice <= midTargetShort) {
                trade.trailingHit = true;
                trade.sl = trade.tp1;
                saveWalletState();
                await sendTelegramMessage(`🔒 <b>KÂR KİLİTLENDİ (İZ SÜREN) | #${cleanSymbol}/USDT</b>\nStop TP1 seviyesine ($${formatPrice(trade.tp1, trade.entry)}) çekildi.`);
                return;
            }

            if (currentPrice >= trade.sl) {
                if (trade.tp1Hit && trade.tp1HitTime && (Date.now() - trade.tp1HitTime < 20000)) return;
                const prevBal = calculateCurrentBalance();
                activeTrades.delete(symbol);
                if (trade.trailingHit) {
                    saveWalletState();
                    await sendTelegramMessage(`🔒✅ <b>İZ SÜREN STOP (TP1 SEVİYESİNDE) KAPANDI | #${cleanSymbol}/USDT</b>\nTP1 kârı korunarak işlem tamamlandı (Kasa: $${prevBal.toFixed(2)}).\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
                } else if (trade.tp1Hit) {
                    recordTradeEvent('RISK_FREE_CLOSE', symbol, 0);
                    await sleep(Math.floor(Math.random() * 1200));
                    saveWalletState();
                    await sendTelegramMessage(`🛡️ <b>TP1 SONRASI KORUNARAK KAPANDI | #${cleanSymbol}/USDT</b> (TP1 Kârı Kasada | Kasa: $${prevBal.toFixed(2)})\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
                } else if (trade.shockProtected) {
                    const lockedGainPct = Math.max(0, ((trade.entry - trade.sl) / trade.entry) * 100);
                    const lockedDollar = trade.margin * (lockedGainPct / 100) * trade.leverage;
                    if (lockedDollar > 0.01) {
                        recordTradeEvent('LOCKED_PROFIT', symbol, lockedDollar);
                        handleTradeResult(symbol, 'LOCKED_PROFIT');
                    } else {
                        recordTradeEvent('RISK_FREE_CLOSE', symbol, 0);
                    }
                    const newBal = calculateCurrentBalance();
                    await sleep(Math.floor(Math.random() * 1200));
                    saveWalletState();
                    await sendTelegramMessage(`🛡️🟢 <b>KÂRLI BAŞABAŞ KORUMASIYLA KAPANDI | #${cleanSymbol}/USDT</b>\n💰 <b>Kilitlenen Net Kâr:</b> +%${lockedGainPct.toFixed(2)} (<b>+$${lockedDollar.toFixed(2)}</b>)\n💼 <b>Kasa Hareketi:</b> $${prevBal.toFixed(2)} ➔ <b>$${newBal.toFixed(2)}</b>\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
                } else {
                    const slLossPct = ((trade.entry - trade.sl) / trade.entry) * 100;
                    const dollarImpact = trade.margin * (slLossPct / 100) * trade.leverage;
                    recordTradeEvent('STOP', symbol, dollarImpact);
                    handleTradeResult(symbol, 'STOP');
                    const newBal = calculateCurrentBalance();
                    await sendTelegramMessage(`❌ <b>STOP TETİKLENDİ | #${cleanSymbol}/USDT</b>\nZarar: %${slLossPct.toFixed(2)} (<b>-$${Math.abs(dollarImpact).toFixed(2)}</b> | Marjin: $${Number(trade.margin).toFixed(2)})\n💼 <b>Kasa Hareketi:</b> $${prevBal.toFixed(2)} ➔ <b>$${newBal.toFixed(2)}</b>\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
                }
                return;
            }
        }

        if (Date.now() - trade.time > 6 * 60 * 60 * 1000) {
            const prevBal = calculateCurrentBalance();
            const pnlPct = trade.side === 'LONG' ? (((currentPrice - trade.entry) / trade.entry) * 100) : (((trade.entry - currentPrice) / trade.entry) * 100);
            activeTrades.delete(symbol);
            if (!trade.tp1Hit) {
                const dollarImpact = trade.margin * (pnlPct / 100) * trade.leverage;
                recordTradeEvent(pnlPct >= 0 ? 'MANUAL_WIN' : 'MANUAL_LOSS', symbol, dollarImpact);
            } else {
                saveWalletState();
            }
            const newBal = calculateCurrentBalance();
            await sendTelegramMessage(`⌛ <b>ZAMAN AŞIMI (6 SAAT) | #${cleanSymbol}/USDT</b> güncel fiyattan kapatıldı.\n💼 <b>Kasa Hareketi:</b> $${prevBal.toFixed(2)} ➔ <b>$${newBal.toFixed(2)}</b>\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
        }
    } finally {
        tradeCheckLocks.delete(symbol);
    }
}

// 125 Coin taranırken açık pozisyonları hiç bekletmeden 4 saniyede bir kontrol eden bağımsız hızlı döngü
async function fastMonitorActiveTrades() {
    if (activeTrades.size === 0) return;
    try {
        const btc = await checkBtcCondition();
        const symbols = Array.from(activeTrades.keys());
        for (const sym of symbols) {
            const t = activeTrades.get(sym);
            if (!t) continue;
            const livePrice = await fetchLivePrice(sym, t.lastPrice || t.entry);
            if (livePrice && !isNaN(livePrice)) {
                await checkActiveTrades(sym, livePrice, btc);
            }
            await sleep(60);
        }
    } catch (e) {}
}

function canOpenNewTrade(side) {
    if (activeTrades.size >= maxTotalActiveTrades) return false;
    let sameSideCount = 0;
    for (const t of activeTrades.values()) {
        if (t.side === side) sameSideCount++;
    }
    return sameSideCount < maxSameSideTrades;
}

// ==========================================
// 8. QUANT V6.6 ULTRA TARAMA MOTORU (125 PARİTE + DENGELİ 11 FİLTRE)
// ==========================================
async function scanMarket() {
    try {
        const session = getActiveSessionName();
        const btc = await checkBtcCondition();
        if (!btc.safe) return;

        const domData = await checkDominanceCondition(btc.btcTrend);
        let signalSentInThisCycle = false;
        let signalsInThisCycle = 0;
        let scannedCount = 0;

        for (const symbol of TARGET_COINS) {
            const prof = getCoinProfile(symbol);
            const hasOpenTrade = activeTrades.has(symbol);
            if (!hasOpenTrade && prof.quarantineUntil > Date.now()) continue;

            const klines15m = await fetchUniversalKlines(symbol, "15", 105, true);
            await sleep(28);
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

            // Her tarama turunda en fazla 2 seçkin sinyal açılır
            if (signalsInThisCycle >= 2) continue;

            const stoch15m = calculateStochRSI(closes15);

            // DENGELENMİŞ DÖNÜŞ MUMU & FİTİL ONAYI
            const prevOpen = opens15[opens15.length - 2];
            const prevClose = closes15[closes15.length - 2];

            const curBody = Math.abs(currentPrice - currentOpen);
            const curLowerWick = Math.min(currentOpen, currentPrice) - currentLow;
            const curUpperWick = currentHigh - Math.max(currentOpen, currentPrice);

            const hasBullReversalCandle = (currentPrice > currentOpen && curUpperWick <= curBody * 1.85) || (prevClose > prevOpen && currentPrice >= prevClose * 0.999) || (curLowerWick > curBody * 1.1 && currentPrice >= currentOpen);
            const hasBearReversalCandle = (currentPrice < currentOpen && curLowerWick <= curBody * 1.85) || (prevClose < prevOpen && currentPrice <= prevClose * 1.001) || (curUpperWick > curBody * 1.1 && currentPrice <= currentOpen);

            const isPotentialLong = (stoch15m.k <= prof.stochLong && stoch15m.bullCross && hasBullReversalCandle && btc.btcTrend !== "DUMP");
            const isPotentialShort = (stoch15m.k >= prof.stochShort && stoch15m.bearCross && hasBearReversalCandle && btc.btcTrend !== "PUMP");

            if (!isPotentialLong && !isPotentialShort) continue;

            const volData = analyze15MVolume(klines15m);
            if (!volData.isAlive) continue;

            const adxData = calculateADX(highs15, lows15, closes15);
            const smc = detectSmartMoneyStructure(klines15m);
            const sweepData = detectLiquiditySweep(klines15m);
            const regData = calculateLinearRegressionChannel(closes15, 100, 2.0);
            const stData = calculateSuperTrend(highs15, lows15, closes15, 10, 1.5);

            // YÖNLÜ ZAMAN KİLİDİ (3.5 Dakika Cooldown - A+ Likidite Avı veya SMC OB varsa beklemez)
            if (isPotentialLong && (Date.now() - lastLongSignalTime < 3.5 * 60 * 1000) && !sweepData.bullSweep && !smc.hasOB) continue;
            if (isPotentialShort && (Date.now() - lastShortSignalTime < 3.5 * 60 * 1000) && !sweepData.bearSweep && !smc.hasOB) continue;

            // 9. Filtre: Regresyon Kanalı Ekstrem Ters Uç Engeli
            if (isPotentialLong && regData.blockLong && !sweepData.bullSweep && !stData.isBull) continue;
            if (isPotentialShort && regData.blockShort && !sweepData.bearSweep && !stData.isBear) continue;

            const isAltcoin = symbol !== "BTCUSDT" && symbol !== "ETHUSDT";
            if (isAltcoin && isPotentialLong && domData.blockAltLongs) {
                const hasAPlusReversal = (sweepData.bullSweep || smc.hasOB || smc.hasFVG) && volData.ratio >= 1.05;
                if (!hasAPlusReversal) continue;
            }

            if (adxData.isChoppy) {
                const hasInstitutionalSetup = (isPotentialLong && (sweepData.bullSweep || regData.boostLong)) || (isPotentialShort && (sweepData.bearSweep || regData.boostShort)) || (smc.hasOB || smc.hasFVG);
                if (!hasInstitutionalSetup) continue;
            }

            const desiredSide = isPotentialLong ? 'LONG' : 'SHORT';
            if (!canOpenNewTrade(desiredSide)) continue;

            const klines1h = await fetchUniversalKlines(symbol, "60", 55, true);
            const klines4h = await fetchUniversalKlines(symbol, "240", 55, true);
            if (!klines1h || klines1h.length < 25) continue;

            const pivotData = calculateTraditionalPivots(klines4h, currentPrice);

            // 10. Filtre: Kurumsal Pivot Direnç/Destek Engeli
            if (isPotentialLong && pivotData.blockLong && !volData.isSpike && !stData.isBull) continue;
            if (isPotentialShort && pivotData.blockShort && !volData.isSpike && !stData.isBear) continue;

            const closes1h = klines1h.map(k => parseFloat(k[4]));
            const rsi1h = Math.round(calculateRSI(closes1h, 14));
            const ema50_1h = calculateEMA(closes1h, 50) || calculateEMA(closes1h, 20);
            const currentPrice1h = closes1h[closes1h.length - 1];
            const mom1h = analyze1HMomentum(klines1h);

            const rsDiff = mom1h.curChange - btc.change1h;
            const rsStrong = (isPotentialLong && rsDiff >= 0.12) || (isPotentialShort && rsDiff <= -0.12);
            const rsBadge = isPotentialLong
                ? (rsDiff >= 0 ? `💪 BTC'den Güçlü (+%${rsDiff.toFixed(2)})` : `⚪ Nötr Korelasyon (%${rsDiff.toFixed(2)})`)
                : (rsDiff <= 0 ? `📉 BTC'den Zayıf (%${rsDiff.toFixed(2)})` : `⚪ Nötr Korelasyon (+%${rsDiff.toFixed(2)})`);

            if ((isPotentialLong && rsDiff < -1.05 && !sweepData.bullSweep) || (isPotentialShort && rsDiff > 1.05 && !sweepData.bearSweep)) continue;

            const canLong1H = ((currentPrice1h >= ema50_1h * 0.992 && rsi1h >= 44 && rsi1h <= 74) || (sweepData.bullSweep && rsi1h >= 38) || (regData.boostLong && rsi1h >= 42)) && !mom1h.isWaterfall;
            const canShort1H = ((currentPrice1h <= ema50_1h * 1.008 && rsi1h <= 56 && rsi1h >= 26) || (sweepData.bearSweep && rsi1h <= 62) || (regData.boostShort && rsi1h <= 58)) && !mom1h.isRocket;

            let candleData = { reportText: "⚠️ 4H Verisi Alınamadı", netGain: 0, lastCandleChange: 0, isBearDominance: false, isBullDominance: false, isRanging: true };
            if (klines4h && klines4h.length >= 20) candleData = analyze4HCandles(klines4h);

            if (isPotentialLong && (!canLong1H || candleData.isBearDominance || candleData.lastCandleChange <= -1.45)) continue;
            if (isPotentialShort && (!canShort1H || candleData.isBullDominance || candleData.lastCandleChange >= 1.45)) continue;

            const [lsSizeData, fundingData, oiData] = await Promise.all([
                fetchLongShortSizeData(symbol, currentPrice),
                fetchFundingRate(symbol),
                fetchOpenInterestData(symbol)
            ]);

            if ((isPotentialLong && fundingData.blockLong) || (isPotentialShort && fundingData.blockShort)) continue;

            const atr15 = calculateATR(highs15, lows15, closes15, 14);
            const cleanSymbol = symbol.replace('USDT', '');
            let signal = null;

            // POZİTİF R:R BEKLENTİSİ: TP1 her zaman Stop mesafesinden büyüktür (1.12R - 1.25R)
            const isFastRiskFreeMode = adxData.adx < 24 || candleData.isRanging;
            const tp1Mult = isFastRiskFreeMode ? 1.12 : (adxData.isStrongTrend ? 1.25 : 1.18);
            const tp2Mult = isFastRiskFreeMode ? 2.20 : (adxData.isStrongTrend ? 2.55 : 2.35);

            const rawAtrDist = atr15 ? (atr15 * prof.atrMultiplier) : (currentPrice * 0.014);
            const minSafeDist = currentPrice * 0.0095;
            const maxSafeDist = currentPrice * 0.0245;
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
                const quality = evaluateSignalQuality(signal.side, stoch15m, volData, lsSizeData, candleData, smc, adxData, sweepData, oiData, rsStrong, domData, regData, pivotData, stData);

                // Dengelenmiş Kalite Barajı (Minimum 3 Puan veya Kurumsal Likidite/OB Onayı)
                if (quality.score < 3 && !sweepData.bullSweep && !sweepData.bearSweep && !smc.hasOB) continue;

                // SABİT DOLAR RİSKİ DENKLEMİ
                const liveWalletBalance = calculateCurrentBalance();
                const slPctNum = Math.max(0.95, parseFloat(signal.slPct));
                let riskPctOfWallet = 1.10;
                let leverage = 10;

                if (quality.qualityTier === 5) {
                    riskPctOfWallet = 1.55;
                    leverage = 10;
                } else if (quality.qualityTier === 4) {
                    riskPctOfWallet = 1.30;
                    leverage = 10;
                } else {
                    riskPctOfWallet = 1.10;
                    leverage = 8;
                }

                const maxDollarRisk = liveWalletBalance * (riskPctOfWallet / 100);
                const targetNotional = maxDollarRisk / (slPctNum / 100);
                const rawMargin = targetNotional / leverage;
                const margin = parseFloat(Math.min(liveWalletBalance * 0.085, Math.max(liveWalletBalance * 0.035, rawMargin)).toFixed(2));
                const marginPct = parseFloat(((margin / liveWalletBalance) * 100).toFixed(1));
                const expectedTp1Dollar = (margin * (parseFloat(signal.tp1Pct) / 100) * leverage).toFixed(2);
                const actualStopDollar = (margin * (slPctNum / 100) * leverage).toFixed(2);

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
                    margin: margin,
                    marginPct: marginPct,
                    time: Date.now() 
                });
                alertedCoins.set(symbol, Date.now());
                if (signal.side === 'LONG') lastLongSignalTime = Date.now();
                else lastShortSignalTime = Date.now();
                saveWalletState();

                const modeBadge = isFastRiskFreeMode ? `⚡ Pozitif R:R (${tp1Mult}R)` : `🚀 Trend Takip (${tp1Mult}R)`;

                const msg = `👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n${quality.stars} <b>${quality.title}</b>\n\n🪙 <b>Coin:</b> #${cleanSymbol}/USDT\n🎯 <b>Yön:</b> ${signal.type}\n💵 <b>Giriş Fiyatı:</b> $${formatPrice(currentPrice, currentPrice)}\n🛑 <b>ATR Stop (-%${signal.slPct} | Risk: -$${actualStopDollar}):</b> $${signal.sl}\n\n💼 <b>Güncel Kasa:</b> $${liveWalletBalance.toFixed(2)}\n💵 <b>Sabit Riskli Marjin (Kasanın %${marginPct}'i):</b> <b>$${margin.toFixed(2)}</b>\n⚖️ <b>Kaldıraç:</b> <b>${leverage}x</b> (Pozisyon: $${(margin * leverage).toFixed(1)})\n\n🎯 <b>Kademeli Kâr Hedefleri (${modeBadge}):</b>\n• <b>TP1 (+%${signal.tp1Pct} | +$${expectedTp1Dollar}):</b> $${signal.tp1}\n• <b>TP2:</b> $${signal.tp2}\n\n⚙️ <b>Kurumsal Onaylar (11 Filtre | 125 Sepet):</b>\n• Profil: ${prof.category}\n• SuperTrend (10,1.5): ${stData.badge}\n• Regresyon Kanalı (100,2): ${regData.badge}\n• Kurumsal Pivot: ${pivotData.badge}\n• Dominans Akışı: ${domData.badge}\n• Trend Gücü: ${adxData.badge}\n• Likidite: ${sweepData.badge}\n• Açık Pozisyon (OI): ${oiData.badge}\n• Rölatif Güç: ${rsBadge}\n• 15M Hacim: ${volData.badge}\n• Smart Money (SMC): ${smc.smcBadge}\n\n${lsSizeData.text}\n\n${candleData.reportText}\n\n${getStatsText()}\n\n🔗 <a href="https://www.binance.com/tr/futures/${symbol}">Binance Futures'ta Aç</a>\n\n⚠️ <i>"YTD" HEPSİ.</i>`;
                await sendTelegramMessage(msg);
                signalSentInThisCycle = true;
                signalsInThisCycle++;
            }
        }

        if (!signalSentInThisCycle && (Date.now() - lastStatusReportTime >= 10 * 60 * 1000)) {
            const btcBadge = btc.btcTrend === "DUMP" ? "🔴 BTC Satışta" : btc.btcTrend === "PUMP" ? "🟢 BTC Alımda" : "⚪ Güvenli";
            await sendTelegramMessage(`👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n⏳ <b>[${getTurkishTimeString()}] TARAMA RAPORU</b>\n🌐 Seans: ${session} | Taranan: ${scannedCount}/${TARGET_COINS.length} | Açık: ${activeTrades.size}/${maxTotalActiveTrades}\n⚡ BTC Kalkanı: %${btc.change15m} (${btcBadge})\n👑 Dominans: ${domData.badge}\n☁️ 125 Parite & Sabit Risk (+0.30R Kâr Kilidi): Aktif ✅\n\n${getStatsText()}\n\n⌨️ <i>Komutlar: /acik | /dominans | /kalkan | /kapat | /bakiye [miktar] | /sifirla | /kasa | /karne</i>`);
            lastStatusReportTime = Date.now();
        }
    } catch (err) {}
}

// ==========================================
// 9. ANA ÇALIŞTIRICI & BAĞIMSIZ HIZLI TAKİP DÖNGÜSÜ
// ==========================================
async function runLoop() {
    console.log(`🚀 ScalpPro Quant V6.6 Ultra (${TARGET_COINS.length} Coins, 11 Filters, Profit-Lock & Fast Monitor) Başlatılıyor...`);
    await initTelegramOffset();
    const startupCloud = await restoreFromTelegramCloudOnStartup();
    const domInit = await checkDominanceCondition();

    if (startupCloud.restored) {
        const curBal = calculateCurrentBalance();
        await sendTelegramMessage(`☁️🔄 <b>QUANT V6.6 ULTRA (125 PARİTE & AKICI SİNYAL MODU) GÜNCELLENDİ!</b>\n\n🪙 <b>Taranan Sepet:</b> ${TARGET_COINS.length} Hacimli Vadeli Parite\n📂 <b>Korunan Açık İşlem:</b> ${activeTrades.size} / ${maxTotalActiveTrades} adet (Tek Yön: ${maxSameSideTrades})\n💼 <b>Korunan Bileşik Kasa:</b> <b>$${curBal.toFixed(2)}</b>\n👑 <b>Canlı Dominans Filtresi:</b> ${domInit.badge}\n🛡️ <b>Aktif Zırhlar:</b> +0.30R Kârlı Başabaş Kilidi, ATR Sabit Risk Denklemi, Dengelenmiş SuperTrend-StochRSI Uyumu ve 4 Saniyelik Hızlı Açık İşlem Takip Motoru aktif!`);
    } else if (!startupCloud.hadPinnedMessage) {
        await syncStateToTelegramCloud();
        await sendTelegramMessage(`💎⚡ <b>QUANT V6.6 ULTRA: 125 PARİTE & KÂR KİLİDİ AKTİF!</b>\n\n1️⃣ <b>125 Hacimli Parite & Hızlı Takip:</b> Açık işlemler ana taramayı beklemeden her 4 saniyede bir kontrol edilir.\n2️⃣ <b>+0.30R Kârlı Başabaş:</b> İşlemler TP1'e %72 yaklaştığında stop $0'a değil, net kâra çekilir.\n3️⃣ <b>Dengeli 11 Filtre:</b> SuperTrend-StochRSI çakışması giderildi, kaliteli dönüş sinyallerinin önü açıldı.`);
    } else {
        const curBal = calculateCurrentBalance();
        await sendTelegramMessage(`🛡️ <b>QUANT V6.6 ULTRA YENİDEN BAŞLATILDI (YEDEK KORUMA MODU)</b>\nSabit mesaj korunarak mevcut yerel durumla ($${curBal.toFixed(2)} | ${TARGET_COINS.length} Parite) devam ediliyor.`);
    }

    // 1. Döngü: Telegram Komut Dinleyici (1.2 saniye)
    (async () => { while (true) { await pollTelegramUpdates(); await sleep(1200); } })();

    // 2. Döngü: Bağımsız Hızlı Açık İşlem Takipçisi (4 saniye)
    (async () => { while (true) { await fastMonitorActiveTrades(); await sleep(4000); } })();

    // 3. Döngü: 125 Parite Ana Sinyal Tarayıcı
    while (true) { await scanMarket(); await sleep(8000); }
}

runLoop();
