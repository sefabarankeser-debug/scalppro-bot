process.on('uncaughtException', (err) => {
    console.error('Kritik Hata:', err.message);
});

process.on('unhandledRejection', (reason) => {
    console.error('Promise Hatasi:', reason);
});

const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ScalpPro Online\n');
}).listen(PORT, '0.0.0.0', () => {
    console.log(`Sunucu ${PORT} portunda dinlemede.`);
});

const TELEGRAM_TOKEN = "8930276912:AAE4xogVFRIqIjPuJ97RqHJFuHvFexNxt2k";
const CHAT_ID = "-1004412694884";

const BASE_PROFILES = {
    MAJOR: { category: "Majör", rsiLong: 40, rsiShort: 60, atrMultiplier: 1.3, maxLsRatio: 68 },
    MEME: { category: "Meme", rsiLong: 33, rsiShort: 68, atrMultiplier: 2.0, maxLsRatio: 64 },
    VOLATILE_ALT: { category: "Volatil", rsiLong: 35, rsiShort: 65, atrMultiplier: 1.8, maxLsRatio: 62 }
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
            sendTelegramMessage(`🛡️ <b>${symbol} 24 Saat Karantinaya Alindi!</b>\nUst uste 3 stop nedeniyle izlemeye alindi.`);
        }
    } else if (resultType === 'TP') {
        prof.totalTps++;
        prof.consecutiveStops = 0;
    }
}

let lastUpdateId = 0;
const alertedCoins = new Map();
const activeTrades = new Map();
const tradeHistory = [];
let lastStatusReportTime = 0;

const TARGET_COINS = Object.keys(COIN_ASSIGNMENTS);
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
    const s1 = getPeriodStats(1);
    const s12 = getPeriodStats(12);
    let t1 = s1.total > 0 ? `• Son 1 Saat: ${s1.tps} TP | ${s1.stops} Stop (%${s1.winRate})` : `• Son 1 Saat: Islem yok`;
    let t12 = s12.total > 0 ? `• Son 12 Saat: ${s12.tps} TP | ${s12.stops} Stop (%${s12.winRate})` : `• Son 12 Saat: Islem yok`;
    return `📊 <b>Canli Basari Karnesi:</b>\n${t1}\n${t12}`;
}

function getActiveSessionName() {
    const trHour = (new Date().getUTCHours() + 3) % 24;
    if (trHour >= 2 && trHour < 10) return "Asya Seansi";
    if (trHour >= 10 && trHour < 16) return "Londra Seansi";
    return "New York Seansi";
}

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'ScalpProClient/1.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

function sendTelegramMessage(text, replyToId = null) {
    return new Promise((resolve) => {
        const payloadObj = {
            chat_id: CHAT_ID,
            text: text,
            parse_mode: 'HTML',
            disable_web_page_preview: true
        };
        if (replyToId) payloadObj.reply_to_message_id = replyToId;

        const payload = JSON.stringify(payloadObj);
        const options = {
            hostname: 'api.telegram.org',
            port: 443,
            path: `/bot${TELEGRAM_TOKEN}/sendMessage`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.write(payload);
        req.end();
    });
}

async function fetchLongShortRatio(symbol) {
    try {
        const url = `https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=${symbol}&period=4h&limit=1`;
        const json = await fetchJSON(url);
        if (json.retCode === 0 && json.result?.list?.length > 0) {
            const item = json.result.list[0];
            const longPct = Math.round(parseFloat(item.buyRatio) * 100);
            const shortPct = Math.round(parseFloat(item.sellRatio) * 100);
            const bar = '█'.repeat(Math.round(longPct / 5)) + '░'.repeat(20 - Math.round(longPct / 5));
            return {
                longPct,
                shortPct,
                text: `⚖️ <b>Long / Short:</b> [${bar}] %${longPct} L | %${shortPct} S`
            };
        }
    } catch (e) {}
    return {
        longPct: 50,
        shortPct: 50,
        text: `⚖️ <b>Long / Short:</b> %50 L | %50 S (Dengeli)`
    };
}

function analyze4HCandles(klines4h) {
    if (!klines4h || klines4h.length < 3) {
        return { reportText: "", netGain: 0, isBearDominance: false, isBullDominance: false };
    }
    const last3 = klines4h.slice(-3);
    let netGain = 0;
    const lines = [];

    for (let i = 0; i < 3; i++) {
        const open = parseFloat(last3[i][1]);
        const close = parseFloat(last3[i][4]);
        const chg = ((close - open) / open) * 100;
        netGain += chg;
        lines.push(` Mum ${i + 1}: ${chg >= 0 ? '🟢 +' : '🔴 '}${chg.toFixed(1)}%`);
    }

    const isBullDominance = netGain >= 2.5;
    const isBearDominance = netGain <= -2.5;
    const netTxt = isBullDominance ? "🟢 Boga Baskisi" : (isBearDominance ? "🔴 Ayi Baskisi" : "⚪ Dengeli");
    const reportText = `🕯️ <b>4H Mum Akisi:</b>\n<pre>${lines.join('\n')}\n Net: ${netTxt}</pre>`;

    return { reportText, netGain, isBullDominance, isBearDominance };
}

function calculateRSI(closes, period = 14) {
    if (!Array.isArray(closes) || closes.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) gains += diff; else losses += Math.abs(diff);
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    for (let i = period + 1; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
        avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
    }
    if (avgLoss === 0) return 100;
    return Math.round(100 - (100 / (1 + (avgGain / avgLoss))));
}

function calculateEMA(closes, period = 50) {
    if (!Array.isArray(closes) || closes.length < period) return null;
    const k = 2 / (period + 1);
    let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < closes.length; i++) {
        ema = (closes[i] * k) + (ema * (1 - k));
    }
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

async function fetchBybitKlines(symbol, interval, limit) {
    try {
        const url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&limit=${limit}`;
        const json = await fetchJSON(url);
        if (json.retCode !== 0 || !json.result?.list || json.result.list.length < 20) return null;
        return json.result.list.slice().reverse();
    } catch (e) {
        return null;
    }
}

async function checkBtcCondition() {
    const list = await fetchBybitKlines("BTCUSDT", "15", 30);
    if (!list || list.length < 3) return { safe: true, change15m: "0.00", btcTrend: "NEUTRAL" };
    const cur = parseFloat(list[list.length - 1][4]);
    const prev = parseFloat(list[list.length - 2][1]);
    const chg = ((cur - prev) / prev) * 100;
    return {
        safe: Math.abs(chg) < 1.8,
        change15m: chg.toFixed(2),
        btcTrend: chg <= -0.85 ? "DUMP" : (chg >= 0.85 ? "PUMP" : "NEUTRAL")
    };
}

async function checkActiveTrades(symbol, currentPrice) {
    const trade = activeTrades.get(symbol);
    if (!trade) return;
    const clean = symbol.replace('USDT', '');

    if (trade.side === 'LONG') {
        if (!trade.tp1Hit && currentPrice >= trade.tp1) {
            trade.tp1Hit = true;
            trade.sl = trade.entry;
            tradeHistory.push({ type: 'TP', time: Date.now() });
            handleTradeResult(symbol, 'TP');
            await sendTelegramMessage(`✅ <b>TP1 ALINDI | #${clean}</b>\nStop basabasa cekildi.`);
        }
        if (currentPrice >= trade.tp2) {
            tradeHistory.push({ type: 'TP', time: Date.now() });
            handleTradeResult(symbol, 'TP');
            await sendTelegramMessage(`✅✅ <b>TP2 ALINDI | #${clean}</b>\nPozisyon kapandi.`);
            activeTrades.delete(symbol);
            return;
        }
        if (currentPrice <= trade.sl) {
            tradeHistory.push({ type: 'STOP', time: Date.now() });
            handleTradeResult(symbol, 'STOP');
            await sendTelegramMessage(`❌ <b>STOP | #${clean}</b>`);
            activeTrades.delete(symbol);
            return;
        }
    } else if (trade.side === 'SHORT') {
        if (!trade.tp1Hit && currentPrice <= trade.tp1) {
            trade.tp1Hit = true;
            trade.sl = trade.entry;
            tradeHistory.push({ type: 'TP', time: Date.now() });
            handleTradeResult(symbol, 'TP');
            await sendTelegramMessage(`✅ <b>TP1 ALINDI | #${clean}</b>\nStop basabasa cekildi.`);
        }
        if (currentPrice <= trade.tp2) {
            tradeHistory.push({ type: 'TP', time: Date.now() });
            handleTradeResult(symbol, 'TP');
            await sendTelegramMessage(`✅✅ <b>TP2 ALINDI | #${clean}</b>\nPozisyon kapandi.`);
            activeTrades.delete(symbol);
            return;
        }
        if (currentPrice >= trade.sl) {
            tradeHistory.push({ type: 'STOP', time: Date.now() });
            handleTradeResult(symbol, 'STOP');
            await sendTelegramMessage(`❌ <b>STOP | #${clean}</b>`);
            activeTrades.delete(symbol);
            return;
        }
    }
}

async function analyzeSpecificCoin(rawSymbol, replyToId = null) {
    let clean = rawSymbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!clean.endsWith('USDT')) clean += 'USDT';
    let symbol = clean;

    let klines15m = await fetchBybitKlines(symbol, "15", 50);
    if (!klines15m && !symbol.startsWith('1000')) {
        symbol = '1000' + clean;
        klines15m = await fetchBybitKlines(symbol, "15", 50);
    }
    if (!klines15m) {
        await sendTelegramMessage(`⚠️ #${clean} verisi alinamadi.`, replyToId);
        return;
    }

    const klines4h = await fetchBybitKlines(symbol, "240", 50);
    if (!klines4h) return;

    const closes15 = klines15m.map(k => parseFloat(k[4]));
    const cur = closes15[closes15.length - 1];
    const rsi15 = calculateRSI(closes15, 14);

    const closes4h = klines4h.map(k => parseFloat(k[4]));
    const rsi4h = calculateRSI(closes4h, 14);
    const ema50 = calculateEMA(closes4h, 50) || cur;

    const ls = await fetchLongShortRatio(symbol);
    const candle = analyze4HCandles(klines4h);
    const prof = getCoinProfile(symbol);

    let durum = "⚪ Notr";
    if (rsi15 <= prof.rsiLong && cur > ema50) durum = "🟢 LONG Firsat";
    else if (rsi15 >= prof.rsiShort && cur < ema50) durum = "🔴 SHORT Firsat";

    const msg = `🔍 <b>ANALIZ | #${symbol.replace('USDT', '')}</b>\n\n` +
                `💵 Fiyat: $${formatPrice(cur, cur)}\n` +
                `⚡ 15M RSI: ${rsi15} | 4H RSI: ${rsi4h}\n` +
                `🎯 Durum: <b>${durum}</b>\n\n` +
                `${ls.text}\n${candle.reportText}`;
    await sendTelegramMessage(msg, replyToId);
}

async function pollTelegramUpdates() {
    try {
        const res = await fetchJSON(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=3`);
        if (res.ok && Array.isArray(res.result)) {
            for (const upd of res.result) {
                lastUpdateId = upd.update_id;
                const msg = upd.message || upd.channel_post;
                if (!msg?.text) continue;
                let txt = msg.text.trim();
                let target = null;
                if (txt.startsWith('/analiz')) target = txt.split(' ')[1];
                else if (txt.length >= 2 && txt.length <= 10 && !txt.includes(' ')) target = txt;
                if (target) await analyzeSpecificCoin(target, msg.message_id);
            }
        }
    } catch (e) {}
}

async function scanMarket() {
    try {
        const btc = await checkBtcCondition();
        if (!btc.safe) return;

        let sentSignal = false;
        let blockedCount = 0;

        for (const symbol of TARGET_COINS) {
            const prof = getCoinProfile(symbol);
            if (prof.quarantineUntil > Date.now()) continue;

            const klines15m = await fetchBybitKlines(symbol, "15", 35);
            await sleep(60);
            if (!klines15m) continue;

            const closes15 = klines15m.map(k => parseFloat(k[4]));
            const highs15 = klines15m.map(k => parseFloat(k[2]));
            const lows15 = klines15m.map(k => parseFloat(k[3]));
            const opens15 = klines15m.map(k => parseFloat(k[1]));
            const cur = closes15[closes15.length - 1];

            await checkActiveTrades(symbol, cur);
            const rsi15 = calculateRSI(closes15, 14);

            const isLong = rsi15 <= prof.rsiLong;
            const isShort = rsi15 >= prof.rsiShort;
            if (!isLong && !isShort) continue;

            const klines4h = await fetchBybitKlines(symbol, "240", 40);
            await sleep(60);
            if (!klines4h) continue;

            const closes4h = klines4h.map(k => parseFloat(k[4]));
            const rsi4h = calculateRSI(closes4h, 14);
            const ema50 = calculateEMA(closes4h, 50) || cur;

            const ls = await fetchLongShortRatio(symbol);
            const candle = analyze4HCandles(klines4h);
            const atr = calculateATR(highs15, lows15, closes15, 14);
            const dist = atr ? Math.max(atr * prof.atrMultiplier, cur * 0.012) : cur * 0.015;

            let signal = null;
            if (isLong && cur > ema50 && rsi4h >= 48 && !candle.isBearDominance && ls.longPct < prof.maxLsRatio) {
                signal = {
                    type: "🟢 LONG",
                    entry: cur,
                    sl: cur - dist,
                    tp1: cur + (dist * 1.3),
                    tp2: cur + (dist * 2.5)
                };
            } else if (isShort && cur < ema50 && rsi4h <= 52 && !candle.isBullDominance && ls.shortPct < prof.maxLsRatio) {
                signal = {
                    type: "🔴 SHORT",
                    entry: cur,
                    sl: cur + dist,
                    tp1: cur - (dist * 1.3),
                    tp2: cur - (dist * 2.5)
                };
            }

            if (!signal) {
                blockedCount++;
                continue;
            }

            const lastAlert = alertedCoins.get(symbol) || 0;
            if (!activeTrades.has(symbol) && Date.now() - lastAlert >= 25 * 60 * 1000) {
                const clean = symbol.replace('USDT', '');
                const text = `🎯 <b>${signal.type} | #${clean}</b>\n\n` +
                             `💵 Giris: $${formatPrice(signal.entry, cur)}\n` +
                             `🛑 Stop: $${formatPrice(signal.sl, cur)}\n` +
                             `🎯 TP1: $${formatPrice(signal.tp1, cur)}\n` +
                             `🎯 TP2: $${formatPrice(signal.tp2, cur)}\n\n` +
                             `${ls.text}\n${candle.reportText}`;
                await sendTelegramMessage(text);
                alertedCoins.set(symbol, Date.now());
                activeTrades.set(symbol, {
                    side: isLong ? 'LONG' : 'SHORT',
                    entry: signal.entry,
                    sl: signal.sl,
                    tp1: signal.tp1,
                    tp2: signal.tp2,
                    tp1Hit: false,
                    time: Date.now()
                });
                sentSignal = true;
            }
        }

        const now = Date.now();
        if (!sentSignal && now - lastStatusReportTime >= 15 * 60 * 1000) {
            await sendTelegramMessage(`⏳ [${getTurkishTimeString()}] Tarama yapildi. Filtreye takilan: ${blockedCount}\n${getStatsText()}`);
            lastStatusReportTime = now;
        }
    } catch (e) {
        console.error("Tarama hatasi:", e.message);
    }
}

async function runLoop() {
    console.log("Bot baslatildi.");
    await sendTelegramMessage("🤖 <b>Bot Calisiyor:</b> Syntax temizlendi, motor baslatildi.");

    (async () => {
        while (true) {
            await pollTelegramUpdates();
            await sleep(1500);
        }
    })();

    while (true) {
        await scanMarket();
        await sleep(15000);
    }
}

runLoop();
