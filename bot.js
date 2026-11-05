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
    res.end('ScalpPro Quant V6 Pro - Zero-Ban Architecture & Binance Auto-Trade Active\n');
}).listen(PORT, '0.0.0.0', () => {
    console.log(`Sunucu ${PORT} portunda dinlemede.`);
});

const TELEGRAM_TOKEN = "8930276912:AAE4xogVFRIqIjPuJ97RqHJFuHvFexNxt2k";
const CHAT_ID = "-1004412694884";

const MAX_TOTAL_ACTIVE_TRADES = 8;
const MAX_SAME_SIDE_TRADES = 5;

// ==========================================
// 1.5 BINANCE FUTURES OTOMATİK AL-SAT MOTORU (SIFIR BAN MİMARİSİ)
// ==========================================
const BINANCE_API_KEY = (process.env.BINANCE_API_KEY || "").trim();
const BINANCE_API_SECRET = (process.env.BINANCE_API_SECRET || "").trim();
const TRADE_AMOUNT_USDT = parseFloat(process.env.TRADE_AMOUNT) || 5;

const symbolPrecisionMap = new Map();

// fapi.binance.com'a başlangıçta dahi yük bindirmemek için 87 coinin hassasiyet (Ondalık) tablosu:
const STATIC_PRECISION = {
    "BTCUSDT": 3, "ETHUSDT": 3, "BCHUSDT": 3, "LTCUSDT": 3, "BNBUSDT": 2, "AAVEUSDT": 1, "TAOUSDT": 3, "ZECUSDT": 3, "GMXUSDT": 2,
    "SOLUSDT": 0, "AVAXUSDT": 0, "NEARUSDT": 0, "LINKUSDT": 2, "UNIUSDT": 0, "ETCUSDT": 2, "ATOMUSDT": 2, "FILUSDT": 1,
    "ALGOUSDT": 1, "XRPUSDT": 1, "ADAUSDT": 0, "ICPUSDT": 0, "TRXUSDT": 0, "HYPEUSDT": 2, "DOGEUSDT": 0, "1000PEPEUSDT": 0,
    "WIFUSDT": 1, "1000SHIBUSDT": 0, "1000FLOKIUSDT": 0, "1000BONKUSDT": 0, "NEIROUSDT": 0, "NOTUSDT": 0, "POPCATUSDT": 0, "BOMEUSDT": 0,
    "DYMUSDT": 1, "STRKUSDT": 1, "WLDUSDT": 0, "SUIUSDT": 1, "APTUSDT": 1, "FETUSDT": 0, "SEIUSDT": 0, "ARKMUSDT": 0,
    "RENDERUSDT": 1, "INJUSDT": 1, "ARBUSDT": 1, "OPUSDT": 1, "TIAUSDT": 0, "PENDLEUSDT": 0, "GALAUSDT": 0, "STXUSDT": 0,
    "ORDIUSDT": 1, "RUNEUSDT": 0, "LDOUSDT": 0, "JUPUSDT": 0, "ENAUSDT": 0, "ARUSDT": 1, "CFXUSDT": 0, "JTOUSDT": 0,
    "CRVUSDT": 1, "DYDXUSDT": 1, "FTMUSDT": 0, "SANDUSDT": 0, "MANAUSDT": 0, "THETAUSDT": 1, "ZROUSDT": 1, "PYTHUSDT": 0,
    "WUSDT": 1, "POLUSDT": 0, "HBARUSDT": 0, "SANTOSUSDT": 1, "OMUSDT": 1, "IMXUSDT": 0, "AXSUSDT": 0, "CHZUSDT": 0,
    "GMTUSDT": 0, "KASUSDT": 0, "MANTAUSDT": 1, "ALTUSDT": 0, "NTRNUSDT": 0, "PORTALUSDT": 1, "SAGAUSDT": 1, "TNSRUSDT": 1,
    "BBUSDT": 0, "IOUSDT": 1, "ZKUSDT": 0, "REZUSDT": 0
};

function signBinanceQuery(queryString) {
    return crypto.createHmac('sha256', BINANCE_API_SECRET).update(queryString).digest('hex');
}

function binanceSignedRequest(apiPath, method = 'POST', params = {}) {
    return new Promise((resolve) => {
        if (!BINANCE_API_KEY || !BINANCE_API_SECRET) {
            return resolve({ code: -9999, msg: "Render'da BINANCE_API_KEY veya SECRET tanimli degil!" });
        }
        const timestamp = Date.now();
        const queryObj = { ...params, timestamp, recvWindow: 10000 };
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
                    if (parsed.code && parsed.code < 0 && parsed.code !== -4046) {
                        console.error(`❌ Binance API Hatası (${apiPath}): [${parsed.code}] ${parsed.msg}`);
                    }
                    resolve(parsed);
                } catch (e) {
                    resolve({ code: -9998, msg: "JSON Yanit Hatasi" });
                }
            });
        });
        req.on('timeout', () => { req.destroy(); resolve({ code: -9997, msg: "Baglanti Zaman Asimi" }); });
        req.on('error', (err) => { resolve({ code: -9996, msg: err.message }); });
        req.end();
    });
}

function formatQuantity(symbol, qty) {
    const meta = symbolPrecisionMap.get(symbol);
    if (meta) {
        const step = meta.stepSize;
        const rounded = Math.floor((qty + 1e-9) / step) * step;
        return Number(rounded.toFixed(meta.quantityPrecision));
    }
    const prec = STATIC_PRECISION[symbol] !== undefined ? STATIC_PRECISION[symbol] : 0;
    const factor = Math.pow(10, prec);
    return Number((Math.floor(qty * factor) / factor).toFixed(prec));
}

async function openBinanceOrder(symbol, side, leverage, currentPrice) {
    if (!BINANCE_API_KEY || !BINANCE_API_SECRET) {
        return { ok: false, qty: 0, err: "Render Environment'ta API Key/Secret Eksik" };
    }
    try {
        // 1. İzole marjin ayarla (-4046 zaten izole demektir)
        const marginRes = await binanceSignedRequest('/fapi/v1/marginType', 'POST', { symbol, marginType: 'ISOLATED' });
        if (marginRes && marginRes.code === -1003) {
            return { ok: false, qty: 0, err: "Sunucu IP Baninda! Render'da 'Clear build cache & deploy' yapin." };
        }

        // 2. Kaldıraç ayarla
        const levRes = await binanceSignedRequest('/fapi/v1/leverage', 'POST', { symbol, leverage });
        if (levRes && levRes.code && levRes.code < 0) {
            return { ok: false, qty: 0, err: `[${levRes.code}] ${levRes.msg}` };
        }

        // 3. Miktarı hesapla ve emri gönder
        const positionSizeUsd = TRADE_AMOUNT_USDT * leverage;
        const rawQty = positionSizeUsd / currentPrice;
        let finalQty = formatQuantity(symbol, rawQty);
        if (finalQty <= 0 && rawQty > 0) finalQty = Number(rawQty.toFixed(3));

        if (!finalQty || finalQty <= 0) {
            return { ok: false, qty: 0, err: `Miktar çok küçük (${rawQty.toFixed(6)})` };
        }

        const orderSide = side === 'LONG' ? 'BUY' : 'SELL';
        let orderRes = await binanceSignedRequest('/fapi/v1/order', 'POST', {
            symbol,
            side: orderSide,
            type: 'MARKET',
            quantity: finalQty
        });

        // Eğer hassasiyet (Precision) hatası dönerse 0 ondalık (tam sayı) ile anında tekrar dene
        if (orderRes && orderRes.code === -1111) {
            finalQty = Math.floor(rawQty);
            if (finalQty > 0) {
                orderRes = await binanceSignedRequest('/fapi/v1/order', 'POST', {
                    symbol,
                    side: orderSide,
                    type: 'MARKET',
                    quantity: finalQty
                });
            }
        }

        // Eğer hesapta Hedge Mode (Çift Yönlü Mod) açıksa positionSide ekleyip tekrar dene
        if (orderRes && orderRes.code === -4061) {
            const hedgeRes = await binanceSignedRequest('/fapi/v1/order', 'POST', {
                symbol,
                side: orderSide,
                positionSide: side,
                type: 'MARKET',
                quantity: finalQty
            });
            if (hedgeRes && hedgeRes.orderId) {
                return { ok: true, qty: parseFloat(hedgeRes.executedQty || finalQty), isHedge: true, err: "" };
            }
            return { ok: false, qty: 0, err: `[${hedgeRes?.code}] ${hedgeRes?.msg}` };
        }

        if (orderRes && orderRes.orderId) {
            return { ok: true, qty: parseFloat(orderRes.executedQty || finalQty), isHedge: false, err: "" };
        }

        return { ok: false, qty: 0, err: `[${orderRes?.code || 'HATA'}] ${orderRes?.msg || 'Emir reddedildi'}` };
    } catch (e) {
        return { ok: false, qty: 0, err: e.message };
    }
}

async function closeBinancePosition(trade, symbol) {
    if (!trade || !trade.isLiveOrder || !trade.executedQty || trade.executedQty <= 0) return;
    try {
        const closeSide = trade.side === 'LONG' ? 'SELL' : 'BUY';
        const params = {
            symbol: symbol,
            side: closeSide,
            type: 'MARKET',
            quantity: trade.executedQty
        };
        if (trade.isHedge) {
            params.positionSide = trade.side;
        } else {
            params.reduceOnly = 'true';
        }
        await binanceSignedRequest('/fapi/v1/order', 'POST', params);
    } catch (e) {
        console.error(`Binance Kapatma Hatası (${symbol}):`, e.message);
    }
}

// ==========================================
// 2. ADAPTİF PROFİLLER VE SEÇİCİ SEPET (87 PARİTE)
// ==========================================
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

// ==========================================
// 3. KALICI BİLEŞİK KASA & TELEGRAM BULUT YEDEKLEME
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
            hist: tradeHistory.slice(-200),
            mem: memEntries,
            cMsgId: cloudMessageId
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
            cloudMessageId
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

// ==========================================
// 4. TELEGRAM API & BULUT SENKRONİZASYON MOTORU
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
        const cloudText = `☁️ <b>[SCALPPRO BULUT HAFIZA SİSTEMİ]</b>\n<i>Bu sabitlenmiş mesaj, bot güncellendiğinde açık işlemlerin ve kasanın silinmemesi için otomatik güncellenir.</i>\n\n💼 <b>Güncel Bileşik Kasa:</b> $${currentBal.toFixed(2)} | 📂 <b>Açık İşlem:</b> ${activeTrades.size}\n⏱ <b>Son Yedek:</b> ${getTurkishTimeString()}\n\n<pre>[CLOUD_STATE:${code}]</pre>`;

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
                    console.log(`☁️ Bulut Hafıza Başarıyla Geri Yüklendi! Açık İşlem: ${activeTrades.size}`);
                    return true;
                }
            }
        }
    } catch (e) {}
    return false;
}

// ==========================================
// 5. KURUMSAL İNDİKATÖRLER, L/S SIZE & MAKRO DOMİNANS MOTORU (FAPI KULLANMAZ - BAN YEMEZ)
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
    let domIndexPrice = cachedGlobalDom.btcDom * 100;

    // fapi.binance.com yerine Bybit/Vision üzerinden BTC-ETH rölatif akışı ile 0-Ban Dominans Momentum hesabı
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

            const btc15 = ((btcClose - btcOpen15) / btcOpen15) * 100;
            const eth15 = ((ethClose - ethOpen15) / ethOpen15) * 100;
            const btc1h = ((btcClose - btcOpen1h) / btcOpen1h) * 100;
            const eth1h = ((ethClose - ethOpen1h) / ethOpen1h) * 100;

            domChange15m = parseFloat(((btc15 - eth15) * 0.35).toFixed(2));
            domChange1h = parseFloat(((btc1h - eth1h) * 0.35).toFixed(2));
        }
    } catch (e) {}

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

// ==========================================
// SIFIR BAN VERİ HATTI (BYBIT + BINANCE VISION + CACHE)
// fapi.binance.com kota harcamaması için tarama listesinden çıkarıldı!
// ==========================================
async function fetchUniversalKlines(symbol, interval, limit, allowCacheFallback = true) {
    const cacheKey = `${symbol}_${interval}`;
    const minRequired = Math.min(limit, 20);
    const binanceInt = interval === "15" ? "15m" : (interval === "60" ? "1h" : (interval === "240" ? "4h" : interval));
    const spotSym = symbol.startsWith("1000") ? symbol.replace(/^1000/, "") : symbol;

    for (let attempt = 1; attempt <= 2; attempt++) {
        // 1. Katman: Bybit V5 Linear Futures
        try {
            const url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&limit=${limit}`;
            const json = await fetchJSON(url, {}, 5500);
            if (json && json.retCode === 0 && json.result?.list?.length >= minRequired) {
                const res = json.result.list.slice().reverse();
                klineCache.set(cacheKey, { data: res, ts: Date.now() });
                return res;
            }
        } catch (e) {}

        // 2. Katman: Binance Vision Resmi Veri Sunucusu (Bulut Sunuculara Asla Ban Atmaz)
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

    // 3. Katman: Akıllı Önbellek (Cache) Yedeği
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

// ==========================================
// 6. HIZLANDIRILMIŞ TELEGRAM KOMUTLARI
// ==========================================
async function sendDominanceReport(replyToId = null) {
    const btc = await checkBtcCondition();
    const dom = await checkDominanceCondition(btc.btcTrend);

    let strategyAdvice = "⚖️ <b>Strateji:</b> Hem Long hem Short yönlü kurumsal sinyaller dengeli çalışıyor.";
    if (dom.regime === "ALT_SEASON_FLOW") {
        strategyAdvice = "🟢 <b>Strateji (Altcoin Ralli Akışı):</b> Sermaye BTC'den altcoinlere akıyor! Altcoin <b>LONG</b> işlemleri ekstra puan alıyor.";
    } else if (dom.regime === "BTC_SUCKING_LIQUIDITY") {
        strategyAdvice = "⚠️ <b>Strateji (BTC Likidite Emiyor):</b> Dominans sert yükseliyor. Sıradan altcoin <b>LONG</b>'ları korumaya alındı, sadece A+ Likidite Avı ve <b>SHORT</b> fırsatları açık.";
    } else if (dom.regime === "ALT_BLEED") {
        strategyAdvice = "🩸 <b>Strateji (Altcoin Kanama Kalkanı):</b> BTC düşerken Dominans yükseliyor! Altcoin LONG'ları kilitlendi, <b>SHORT</b> yönlü işlemler öncelikli.";
    }

    const msg = `👑 <b>MAKRO DOMİNANS & PARA AKIŞI RAPORU</b>\n\n• <b>Bitcoin Dominansı (BTC.D):</b> <b>%${dom.btcDom}</b>\n• <b>Ethereum Dominansı (ETH.D):</b> <b>%${dom.ethDom}</b>\n• <b>Dominans Momentum:</b>\n  ↳ 15D Değişim: <b>${dom.domChange15m >= 0 ? '+' : ''}%${dom.domChange15m}</b> | 1S Değişim: <b>${dom.domChange1h >= 0 ? '+' : ''}%${dom.domChange1h}</b>\n• <b>24S Toplam Market Cap:</b> ${dom.mcapChange24h >= 0 ? '+' : ''}%${dom.mcapChange24h}\n• <b>Anlık Rejim:</b> ${dom.badge}\n\n${strategyAdvice}`;
    await sendTelegramMessage(msg, replyToId);
}

async function sendOpenTradesReport(replyToId = null) {
    if (activeTrades.size === 0) {
        return sendTelegramMessage(`📂 <b>AÇIK İŞLEMLER RAPORU</b>\n\nŞu anda takip edilen açık işlem bulunmuyor. (Kontenjan: 0/${MAX_TOTAL_ACTIVE_TRADES})`, replyToId);
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

    let lines = [`📂 <b>AKTİF AÇIK İŞLEMLER (${activeTrades.size}/${MAX_TOTAL_ACTIVE_TRADES})</b>\n↳ 🟢 Long: ${longCount}/${MAX_SAME_SIDE_TRADES} | 🔴 Short: ${shortCount}/${MAX_SAME_SIDE_TRADES}\n`];

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

        const liveBadge = t.isLiveOrder ? "🚀 [BİNANCE CANLI]" : "📝 [SİMÜLE]";
        lines.push(`• <b>#${clean}</b> (${t.side === 'LONG' ? '🟢 LONG' : '🔴 SHORT'}) | ${liveBadge} | ${t.stars || '⭐⭐⭐'}\n  ↳ Giriş: $${formatPrice(t.entry, t.entry)} ➔ <b>Anlık: $${formatPrice(livePrice, t.entry)}</b>\n  ↳ ${pnlIcon} <b>Anlık PNL: ${pnlSign}%${pnlPct.toFixed(2)}</b> (${t.leverage}x: <b>${pnlSign}%${levPnl}</b> | <b>${pnlSign}$${dollarPnl}</b> | Marjin: $${Number(t.margin).toFixed(2)})\n  ↳ 🛑 Stop: $${formatPrice(t.sl, t.entry)} | ${targetInfo}\n`);
    }
    lines.push(`💡 <i>Kapatmak için: <b>/kapat coinadı</b> veya <b>/kapat hepsi</b></i>`);
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
            await closeBinancePosition(t, sym);
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
    await closeBinancePosition(t, sym);

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
        text += `✅ Karantinada hiçbir parite yok. Tüm 87 parite aktif.`;
    } else {
        if (quarantined.length > 0) text += `<b>Karantinadakiler:</b>\n${quarantined.join('\n')}\n\n`;
        if (risky.length > 0) text += `<b>Sıkılaştırılmışlar:</b>\n${risky.join('\n')}`;
    }
    await sendTelegramMessage(text, replyToId);
}

async function sendWalletReport(replyToId = null) {
    const startStr = getTurkishDateTimeString(walletStartTime);
    const currentBal = calculateCurrentBalance();
    const msg = `💰 <b>KALICI BİLEŞİK KASA RAPORU</b>\n\n🗓️ <b>Başlangıç Tarihi:</b> ${startStr}\n💵 <b>İlk Başlangıç Bakiyesi:</b> $${customStartingBalance}\n💵 <b>Güncel Bileşik Bakiye:</b> <b>$${currentBal.toFixed(2)}</b>\n🚀 <b>Binance Canlı İşlem Marjini:</b> <b>$${TRADE_AMOUNT_USDT} USDT (İzole)</b>\n📈 <b>Yeni İşlem Marjinleri (Bileşik):</b>\n  • 3⭐ Standart (%5): <b>$${(currentBal * 0.05).toFixed(2)}</b>\n  • 4⭐ Güçlü (%7.5): <b>$${(currentBal * 0.075).toFixed(2)}</b>\n  • 5⭐ VIP (%10): <b>$${(currentBal * 0.10).toFixed(2)}</b>\n📂 <b>Açık İşlem:</b> ${activeTrades.size} / ${MAX_TOTAL_ACTIVE_TRADES}\n☁️ <b>Bulut Senkronizasyon:</b> Aktif ✅\n\n${getStatsText()}`;
    await sendTelegramMessage(msg, replyToId);
}

async function analyzeSpecificCoin(rawSymbol, replyToId = null) {
    let clean = normalizeCommandText(rawSymbol).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if ( clean.endsWith('USDT') ) clean = clean.replace(/USDT$/, '');
    if (FUZZY_MAP[clean]) clean = FUZZY_MAP[clean];
    const baseSym = clean + 'USDT';

    let symbol = baseSym;
    let klines15m = await fetchUniversalKlines(symbol, "15", 55, true);
    if ((!klines15m || klines15m.length < 25) && !symbol.startsWith('1000')) {
        symbol = '1000' + baseSym;
        klines15m = await fetchUniversalKlines(symbol, "15", 55, true);
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
    
    let rsi1h = 50, ema50_1h = currentPrice;
    if (klines1h && klines1h.length >= 20) {
        const closes1h = klines1h.map(k => parseFloat(k[4]));
        rsi1h = Math.round(calculateRSI(closes1h, 14));
        ema50_1h = calculateEMA(closes1h, 50) || calculateEMA(closes1h, 20) || currentPrice;
    }

    const isBull1H = (currentPrice >= ema50_1h * 0.990 || rsi1h >= 42);
    const isBear1H = (currentPrice <= ema50_1h * 1.010 || rsi1h <= 58);
    let trendText = isBull1H ? "🟢 Yükseliş / V-Dönüş Uygun" : isBear1H ? "🔴 Düşüş Eğilimi (Ayı)" : "⚪ Esnek / Kararsız";
    
    const candleData = analyze4HCandles(klines4h);
    let crossText = stoch15m.bullCross ? "🟢 Yukarı Kesişim" : stoch15m.bearCross ? "🔴 Aşağı Kesişim" : "⏳ Kesişim Bekleniyor";

    let openTradeNote = "";
    if (activeTrades.has(symbol)) {
        const t = activeTrades.get(symbol);
        const pnlPct = t.side === 'LONG' ? (((currentPrice - t.entry) / t.entry) * 100) : (((t.entry - currentPrice) / t.entry) * 100);
        const sign = pnlPct >= 0 ? "+" : "";
        openTradeNote = `\n📂 <b>Açık İşlem Durumu:</b> ${t.side} | Giriş: $${formatPrice(t.entry, t.entry)} | PNL: <b>${sign}%${pnlPct.toFixed(2)}</b> (Marjin: $${Number(t.margin).toFixed(2)})\n`;
    }

    const reportMsg = `👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n🔍 <b>ÖZEL COİN ANALİZİ | #${symbol.replace('USDT', '')}</b>${openTradeNote}\n💵 <b>Anlık Fiyat:</b> $${formatPrice(currentPrice, currentPrice)}\n🧭 <b>1H Trend:</b> ${trendText} (RSI: ${rsi1h})\n📐 <b>Trend Gücü (ADX):</b> ${adxData.badge}\n⚡ <b>15M Stoch:</b> %K: ${stoch15m.k} | %D: ${stoch15m.d} (${crossText})\n📊 <b>Hacim:</b> ${volData.badge}\n🐋 <b>Açık Pozisyon (OI):</b> ${oiData.badge}\n🏛️ <b>SMC:</b> ${smc.smcBadge}\n🧲 <b>Likidite:</b> ${sweepData.badge}\n👑 <b>Dominans Akışı:</b> ${domData.badge}\n💸 <b>Funding:</b> ${fundingData.text}\n\n${lsSizeData.text}\n\n${candleData.reportText}\n\n⚠️ <i>"YTD" HEPSİ.</i>`;
    await sendTelegramMessage(reportMsg, replyToId);
}

async function scanExtremes(type, replyToId = null) {
    await sendTelegramMessage(`🔍 <b>${type === 'DIP' ? 'Stoch Dip (%K <= 35)' : 'Stoch Tepe (%K >= 65)'} Pariteler Taranıyor...</b>`, replyToId);
    const valid = [];
    for (const sym of TARGET_COINS.slice(0, 45)) {
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
    for (const r of valid.slice(0, 8)) {
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
        return sendTelegramMessage(`🤖 <b>KOMUT LİSTESİ:</b>\n\n• <b>/acik</b> : Açık işlemleri anında listeler.\n• <b>/dominans</b> : Canlı BTC.D, ETH.D ve Altcoin Para Akışı raporunu gösterir.\n• <b>/kapat coin</b> : İşlemi kapatır ve kasaya ekler (Örn: <code>/kapat gmx</code> veya <code>/kapat hepsi</code>).\n• <b>/bakiye 1000</b> : Kasayı istediğiniz tutara günceller.\n• <b>/kasa</b> : Bileşik kasa raporunu ve yeni marjin oranlarını gösterir.\n• <b>/yedek</b> : Açık işlemleri ve kasayı buluta yedekler.\n• <b>/karne</b> : Coin performans karnesini gösterir.\n• <b>/karantina</b> : Cezalı coinleri gösterir.\n• <b>/sifirla</b> : Kasayı $1000 yapar.\n• <b>/dip /tepe</b> : Taramalar.`, msgId);
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
// 7. CANLI FİYAT (LIVE PRICE) İŞLEM TAKİBİ
// ==========================================
async function checkActiveTrades(symbol, currentPrice, btc) {
    const trade = activeTrades.get(symbol);
    if (!trade) return;

    trade.lastPrice = currentPrice;
    if (!trade.highestSeen || currentPrice > trade.highestSeen) trade.highestSeen = currentPrice;
    if (!trade.lowestSeen || currentPrice < trade.lowestSeen) trade.lowestSeen = currentPrice;

    if (Date.now() - trade.time < 15000) return;

    const cleanSymbol = symbol.replace('USDT', '');
    const nowTime = getTurkishTimeString();

    if (trade.side === 'LONG') {
        const curProfitPct = ((currentPrice - trade.entry) / trade.entry) * 100;
        if (!trade.tp1Hit && !trade.shockProtected && curProfitPct >= 0.55 && (btc.btcTrend === 'DUMP' || btc.shockDump)) {
            trade.shockProtected = true;
            trade.sl = trade.entry;
            saveWalletState();
            await sendTelegramMessage(`⚡🛡️ <b>ACİL BTC ŞOK KORUMASI | #${cleanSymbol}/USDT</b>\nStop giriş seviyesine ($${formatPrice(trade.entry, trade.entry)}) çekildi!`);
            return;
        }

        if (currentPrice >= trade.tp2) {
            await closeBinancePosition(trade, symbol);
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
            trade.sl = trade.entry;
            const prevBal = calculateCurrentBalance();
            const tp1GainPct = ((trade.tp1 - trade.entry) / trade.entry) * 100;
            const dollarImpact = trade.margin * (tp1GainPct / 100) * trade.leverage;
            recordTradeEvent('TP1', symbol, dollarImpact);
            handleTradeResult(symbol, 'TP');
            const newBal = calculateCurrentBalance();

            await sendTelegramMessage(`👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n✅ <b>TP1 ALINDI! | #${cleanSymbol}/USDT</b>\n💰 <b>Kazanılan:</b> +%${tp1GainPct.toFixed(2)} (<b>+$${dollarImpact.toFixed(2)}</b> | Marjin: $${Number(trade.margin).toFixed(2)})\n💼 <b>Kasa Hareketi:</b> $${prevBal.toFixed(2)} ➔ <b>$${newBal.toFixed(2)}</b>\n🛡️ Stop girişe çekildi (Risk-Free). İşlem TP2 için devam ediyor!\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
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
            await closeBinancePosition(trade, symbol);
            let dollarImpact = 0;
            const prevBal = calculateCurrentBalance();
            activeTrades.delete(symbol);
            if (trade.trailingHit) {
                saveWalletState();
                await sendTelegramMessage(`🔒✅ <b>İZ SÜREN STOP (TP1 SEVİYESİNDE) KAPANDI | #${cleanSymbol}/USDT</b>\nTP1 kârı korunarak işlem tamamlandı (Kasa: $${prevBal.toFixed(2)}).\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
            } else if (trade.tp1Hit || trade.shockProtected) {
                saveWalletState();
                await sendTelegramMessage(`🛡️ <b>GİRİŞTEN KORUNARAK KAPANDI | #${cleanSymbol}/USDT</b> (0 Ek Zarar | Kasa: $${prevBal.toFixed(2)})\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
            } else {
                const slLossPct = ((trade.sl - trade.entry) / trade.entry) * 100;
                dollarImpact = trade.margin * (slLossPct / 100) * trade.leverage;
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
        if (!trade.tp1Hit && !trade.shockProtected && curProfitPct >= 0.55 && (btc.btcTrend === 'PUMP' || btc.shockPump)) {
            trade.shockProtected = true;
            trade.sl = trade.entry;
            saveWalletState();
            await sendTelegramMessage(`⚡🛡️ <b>ACİL BTC ŞOK KORUMASI | #${cleanSymbol}/USDT</b>\nStop giriş seviyesine çekildi.`);
            return;
        }

        if (currentPrice <= trade.tp2) {
            await closeBinancePosition(trade, symbol);
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
            trade.sl = trade.entry;
            const prevBal = calculateCurrentBalance();
            const tp1GainPct = ((trade.entry - trade.tp1) / trade.entry) * 100;
            const dollarImpact = trade.margin * (tp1GainPct / 100) * trade.leverage;
            recordTradeEvent('TP1', symbol, dollarImpact);
            handleTradeResult(symbol, 'TP');
            const newBal = calculateCurrentBalance();

            await sendTelegramMessage(`👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n✅ <b>TP1 ALINDI! | #${cleanSymbol}/USDT</b>\n💰 <b>Kazanılan:</b> +%${tp1GainPct.toFixed(2)} (<b>+$${dollarImpact.toFixed(2)}</b> | Marjin: $${Number(trade.margin).toFixed(2)})\n💼 <b>Kasa Hareketi:</b> $${prevBal.toFixed(2)} ➔ <b>$${newBal.toFixed(2)}</b>\n🛡️ Stop girişe çekildi (Risk-Free). İşlem TP2 için devam ediyor!\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
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
            await closeBinancePosition(trade, symbol);
            let dollarImpact = 0;
            const prevBal = calculateCurrentBalance();
            activeTrades.delete(symbol);
            if (trade.trailingHit) {
                saveWalletState();
                await sendTelegramMessage(`🔒✅ <b>İZ SÜREN STOP (TP1 SEVİYESİNDE) KAPANDI | #${cleanSymbol}/USDT</b>\nTP1 kârı korunarak işlem tamamlandı (Kasa: $${prevBal.toFixed(2)}).\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
            } else if (trade.tp1Hit || trade.shockProtected) {
                saveWalletState();
                await sendTelegramMessage(`🛡️ <b>GİRİŞTEN KORUNARAK KAPANDI | #${cleanSymbol}/USDT</b> (0 Ek Zarar | Kasa: $${prevBal.toFixed(2)})\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
            } else {
                const slLossPct = ((trade.entry - trade.sl) / trade.entry) * 100;
                dollarImpact = trade.margin * (slLossPct / 100) * trade.leverage;
                recordTradeEvent('STOP', symbol, dollarImpact);
                handleTradeResult(symbol, 'STOP');
                const newBal = calculateCurrentBalance();
                await sendTelegramMessage(`❌ <b>STOP TETİKLENDİ | #${cleanSymbol}/USDT</b>\nZarar: %${slLossPct.toFixed(2)} (<b>-$${Math.abs(dollarImpact).toFixed(2)}</b> | Marjin: $${Number(trade.margin).toFixed(2)})\n💼 <b>Kasa Hareketi:</b> $${prevBal.toFixed(2)} ➔ <b>$${newBal.toFixed(2)}</b>\n\n${getStatsText()}\n⏱ <b>${nowTime}</b>`);
            }
            return;
        }
    }

    if (Date.now() - trade.time > 6 * 60 * 60 * 1000) {
        await closeBinancePosition(trade, symbol);
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
// 8. QUANT V6 PRO TARAMA MOTORU
// ==========================================
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
            await sleep(45); // Rate limit koruması
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

                const liveWalletBalance = calculateCurrentBalance();
                let leverage = 10;
                let marginPct = 5;

                if (quality.qualityTier === 5) {
                    leverage = 14;
                    marginPct = 10;
                } else if (quality.qualityTier === 4) {
                    leverage = 12;
                    marginPct = 7.5;
                } else {
                    leverage = 9;
                    marginPct = 5;
                }

                // === BİNANCE OTOMATİK EMİR GÖNDERİMİ ===
                const binanceOrder = await openBinanceOrder(symbol, signal.side, leverage, currentPrice);

                const margin = parseFloat(((liveWalletBalance * marginPct) / 100).toFixed(2));
                const expectedTp1Dollar = (margin * (parseFloat(signal.tp1Pct) / 100) * leverage).toFixed(2);

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
                    isLiveOrder: binanceOrder.ok,
                    executedQty: binanceOrder.qty,
                    isHedge: binanceOrder.isHedge || false,
                    time: Date.now() 
                });
                alertedCoins.set(symbol, Date.now());
                saveWalletState();

                const modeBadge = isFastRiskFreeMode ? `⚡ Hızlı Risk-Free (${tp1Mult}R)` : `🚀 Trend Takip (${tp1Mult}R)`;
                const liveOrderBadge = binanceOrder.ok
                    ? `🚀 <b>BİNANCE GERÇEK EMİR AÇILDI (${TRADE_AMOUNT_USDT} USDT İZOLE | Adet: ${binanceOrder.qty})</b>`
                    : `⚠️ <b>BİNANCE EMİR AÇILAMADI:</b> <code>${binanceOrder.err}</code>`;

                const msg = `👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n${quality.stars} <b>${quality.title}</b>\n${liveOrderBadge}\n\n🪙 <b>Coin:</b> #${cleanSymbol}/USDT\n🎯 <b>Yön:</b> ${signal.type}\n💵 <b>Giriş Fiyatı:</b> $${formatPrice(currentPrice, currentPrice)}\n🛑 <b>Doğal ATR Stop (-%${signal.slPct}):</b> $${signal.sl}\n\n💼 <b>Güncel Kasa:</b> $${liveWalletBalance.toFixed(2)}\n💵 <b>Bileşik Marjin (Kasanın %${marginPct}'i):</b> <b>$${margin.toFixed(2)}</b>\n⚖️ <b>Dinamik Kaldıraç:</b> <b>${leverage}x</b> (Pozisyon: $${(margin * leverage).toFixed(1)})\n\n🎯 <b>Kademeli Kâr Hedefleri (${modeBadge}):</b>\n• <b>TP1 (+%${signal.tp1Pct} | +$${expectedTp1Dollar}):</b> $${signal.tp1}\n• <b>TP2:</b> $${signal.tp2}\n\n⚙️ <b>Kurumsal Onaylar (8 Filtre):</b>\n• Profil: ${prof.category}\n• Dominans Akışı: ${domData.badge}\n• Trend Gücü: ${adxData.badge}\n• Likidite: ${sweepData.badge}\n• Açık Pozisyon (OI): ${oiData.badge}\n• Rölatif Güç: ${rsBadge}\n• 15M Hacim: ${volData.badge}\n• Smart Money (SMC): ${smc.smcBadge}\n\n${lsSizeData.text}\n\n${candleData.reportText}\n\n${getStatsText()}\n\n🔗 <a href="https://www.binance.com/tr/futures/${symbol}">Binance Futures'ta Aç</a>\n\n⚠️ <i>"YTD" HEPSİ.</i>`;
                await sendTelegramMessage(msg);
                signalSentInThisCycle = true;
            }
        }

        if (!signalSentInThisCycle && (Date.now() - lastStatusReportTime >= 10 * 60 * 1000)) {
            const btcBadge = btc.btcTrend === "DUMP" ? "🔴 BTC Satışta" : btc.btcTrend === "PUMP" ? "🟢 BTC Alımda" : "⚪ Güvenli";
            await sendTelegramMessage(`👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n⏳ <b>[${getTurkishTimeString()}] TARAMA RAPORU</b>\n🌐 Seans: ${session} | Taranan: ${scannedCount} | Açık: ${activeTrades.size}/${MAX_TOTAL_ACTIVE_TRADES}\n⚡ BTC Kalkanı: %${btc.change15m} (${btcBadge})\n👑 Dominans: ${domData.badge}\n🛡️ Zero-Ban Mimari & Binance Emir: Aktif ✅\n\n${getStatsText()}\n\n⌨️ <i>Komutlar: /acik | /dominans | /kapat | /bakiye <miktar> | /sifirla | /kasa | /karne</i>`);
            lastStatusReportTime = Date.now();
        }
    } catch (err) {}
}

// ==========================================
// 9. ANA ÇALIŞTIRICI & OTOMATİK BULUT GERİ YÜKLEME
// ==========================================
async function runLoop() {
    console.log("🚀 ScalpPro Quant V6 Pro (Zero-Ban Architecture & Binance Auto-Trade) Başlatılıyor...");
    await initTelegramOffset();
    const restored = await restoreFromTelegramCloudOnStartup();
    const domInit = await checkDominanceCondition();

    const apiKeyStatus = (BINANCE_API_KEY && BINANCE_API_SECRET)
        ? `✅ Aktif (${TRADE_AMOUNT_USDT} USDT İzole - Zero-Ban Korumalı)`
        : `⚠️ Pasif (Render Environment'ta BINANCE_API_KEY / SECRET eksik!)`;

    if (restored) {
        const curBal = calculateCurrentBalance();
        await sendTelegramMessage(`☁️🔄 <b>QUANT V6 PRO GÜNCELLENDİ (ZERO-BAN MİMARİSİ AKTİF)!</b>\n\n📂 <b>Korunan Açık İşlem:</b> ${activeTrades.size} adet\n💼 <b>Korunan Bileşik Kasa:</b> <b>$${curBal.toFixed(2)}</b>\n🚀 <b>Binance Otomatik Al-Sat:</b> ${apiKeyStatus}\n👑 <b>Canlı Dominans Filtresi:</b> ${domInit.badge}\n🛡️ <b>IP Ban Kalkanı:</b> Piyasa taraması <code>fapi.binance.com</code>'dan ayrıldı, kota sadece gerçek emirler için korunuyor!`);
    } else {
        await syncStateToTelegramCloud();
        await sendTelegramMessage(`💎⚡ <b>QUANT V6 PRO: ZERO-BAN MİMARİSİ & BİNANCE OTOMATİK AL-SAT AKTİF!</b>\n\n1️⃣ <b>Binance Otomatik İşlem:</b> ${apiKeyStatus}\n2️⃣ <b>IP Ban Kalkanı:</b> Tüm taramalar Bybit & Binance Vision üzerinden yapılır, Binance Futures IP kotası %0'da tutulur.`);
    }

    (async () => { while (true) { await pollTelegramUpdates(); await sleep(1200); } })();
    while (true) { await scanMarket(); await sleep(10000); }
}

runLoop();
