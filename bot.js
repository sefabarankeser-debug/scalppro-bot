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
    res.end('ScalpPro 50-Coin Engine Active\n');
}).listen(PORT, '0.0.0.0', () => {
    console.log(`Sunucu ${PORT} portunda aktif.`);
});

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8930276912:AAE4xogVFRIqIjPuJ97RqHJFuHvFexNxt2k";
const CHAT_ID = process.env.CHAT_ID || "-1004412694884";

const alertedCoins = new Map();
const spikeAlertedCoins = new Map();
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

// Hem Binance Futures hem Bybit'te kesin bulunan en yüksek likiditeli 50 parite
const TARGET_COINS = [
    "SOLUSDT", "DOGEUSDT", "SUIUSDT", "1000PEPEUSDT", "AVAXUSDT",
    "NEARUSDT", "WIFUSDT", "APTUSDT", "1000SHIBUSDT", "TAOUSDT",
    "FETUSDT", "SEIUSDT", "ARKMUSDT", "RENDERUSDT", "INJUSDT",
    "ARBUSDT", "OPUSDT", "TIAUSDT", "NOTUSDT", "1000FLOKIUSDT",
    "1000BONKUSDT", "BCHUSDT", "PENDLEUSDT", "GALAUSDT", "STXUSDT",
    "ORDIUSDT", "RUNEUSDT", "AAVEUSDT", "LDOUSDT", "WLDUSDT",
    "JUPUSDT", "ENAUSDT", "ARUSDT", "CFXUSDT", "JTOUSDT",
    "CRVUSDT", "NEIROUSDT", "DYDXUSDT", "GMXUSDT", "UNIUSDT",
    "LINKUSDT", "FTMUSDT", "SANDUSDT", "MANAUSDT", "THETAUSDT",
    "LTCUSDT", "ATOMUSDT", "FILUSDT", "ETCUSDT", "ALGOUSDT"
];

const CRITICAL_KEYWORDS = [
    "sec", "fed", "powell", "binance", "tether", "etf", "interest rate",
    "inflation", "cpi", "hack", "liquidation", "ban", "lawsuit", "court", "war", "tariff"
];

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
    const twelveHoursAgo = Date.now() - (12 * 60 * 60 * 1000);
    while (tradeHistory.length > 0 && tradeHistory[0].time < twelveHoursAgo) {
        tradeHistory.shift();
    }

    const s1 = getPeriodStats(1);
    const s12 = getPeriodStats(12);

    let text1 = s1.total > 0
        ? `• ⚡ <b>Son 1 Saat:</b> ${s1.tps} TP | ${s1.stops} Stop (<b>%${s1.winRate} Win Rate</b>)`
        : `• ⚡ <b>Son 1 Saat:</b> İşlem yok`;

    let text12 = s12.total > 0
        ? `• 🌐 <b>Son 12 Saat:</b> ${s12.tps} TP | ${s12.stops} Stop (<b>%${s12.winRate} Win Rate</b>)`
        : `• 🌐 <b>Son 12 Saat:</b> Henüz sonuçlanan işlem yok`;

    return `📊 <b>Canlı Başarı Karnesi:</b>\n${text1}\n${text12}`;
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
            rsiShort: 68,
            rsiLong: 32,
            minVolMultiplier: 1.15,
            wallThreshold: 220000
        };
    }

    return {
        sessionName: "🗽 New York Seansı",
        rsiShort: 70,
        rsiLong: 30,
        minVolMultiplier: 1.20,
        wallThreshold: 250000
    };
}

async function sendTelegramMessage(text) {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: text,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        });
    } catch (e) {
        console.error("🔴 Telegram Hatası:", e.message);
    }
}

async function checkBreakingNews() {
    try {
        const now = Date.now();
        if (now - lastNewsCheckTime < 2 * 60 * 1000) return;
        lastNewsCheckTime = now;

        const res = await fetch('https://cryptopanic.com/api/free/v1/posts/?public=true');
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
                await sleep(1000);
            } else if (isMacroOrBtc) {
                const macroMsg = `👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n` +
                                 `🚨 <b>PİYASA GENELİ SICAK GELİŞME (BTC / MAKRO)</b>\n\n` +
                                 `📢 <b>Haber:</b> ${title}\n\n` +
                                 `🛑 Dalgalanma durumunda sinyaller kilitlenebilir.\n\n` +
                                 `⚠️ <i>"YTD" HEPSİ.</i>`;
                await sendTelegramMessage(macroMsg);
                await sleep(1000);
            }
        }
    } catch (e) {}
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
                    `• ETF işlemleri ve fonlar piyasaya girmek üzere.\n\n` +
                    `⚠️ <i>"YTD" HEPSİ.</i>`;
        await sendTelegramMessage(msg);
        lastNotifiedEvents.approachingNY = true;
    }

    if (trHour === 16 && trMinute >= 30 && trMinute < 40 && !lastNotifiedEvents.openNY) {
        const msg = `👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n` +
                    `🔥 <b>NEW YORK (WALL STREET) SEANSI RESMEN AÇILDI!</b>\n\n` +
                    `⚡ Günün en yüksek hacimli dönemi devrede.\n\n` +
                    `⚠️ <i>"YTD" HEPSİ.</i>`;
        await sendTelegramMessage(msg);
        lastNotifiedEvents.openNY = true;
    }

    if (trHour === 23 && trMinute >= 0 && trMinute < 10 && !lastNotifiedEvents.closeNY) {
        const msg = `👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n` +
                    `🌙 <b>NEW YORK SEANSI KAPANDI (PİYASA SAKİNLEŞİYOR)</b>\n\n` +
                    `💤 ABD borsaları kapandı, ana hacim dalgası sona erdi.\n\n` +
                    `⚠️ <i>"YTD" HEPSİ.</i>`;
        await sendTelegramMessage(msg);
        lastNotifiedEvents.closeNY = true;
    }
}

function calculateRSI(closes, period = 14) {
    if (!Array.isArray(closes) || closes.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
        const change = closes[i] - closes[i - 1];
        if (change > 0) gains += change;
        else losses += Math.abs(change);
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < closes.length; i++) {
        const change = closes[i] - closes[i - 1];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? Math.abs(change) : 0;

        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
    if (avgGain === 0) return 0;

    const rs = avgGain / avgLoss;
    return Math.round(100 - (100 / (1 + rs)));
}

function calculateBollinger(closes, period = 20, multiplier = 2) {
    if (!Array.isArray(closes) || closes.length < period) return null;
    const slice = closes.slice(-period);
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
        const url = `https://api.bybit.com/v5/market/orderbook?category=linear&symbol=${symbol}&limit=25`;
        const res = await fetch(url, { headers: { 'User-Agent': 'ScalpProBot/2.0' } });
        if (!res.ok) return null;
        const json = await res.json();
        if (json.retCode !== 0 || !json.result || !json.result.b || !json.result.a) return null;

        let maxAskWall = 0;
        let maxBidWall = 0;

        json.result.a.forEach(a => {
            const val = parseFloat(a[0]) * parseFloat(a[1]);
            if (val > maxAskWall) maxAskWall = val;
        });

        json.result.b.forEach(b => {
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

async function fetchBybitKlines(symbol) {
    try {
        const url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=1&limit=50`;
        const res = await fetch(url, { headers: { 'User-Agent': 'ScalpProBot/2.0' } });
        if (!res.ok) return null;
        const json = await res.json();
        if (json.retCode !== 0 || !json.result || !json.result.list || json.result.list.length < 25) return null;
        return json.result.list.slice().reverse();
    } catch (e) {
        return null;
    }
}

async function checkBtcCondition() {
    const list = await fetchBybitKlines("BTCUSDT");
    if (!list || list.length < 4) return { safe: true, btcTrend: "NEUTRAL", change3m: "0.00" };

    const currentPrice = parseFloat(list[list.length - 1][4]);
    const price3mAgo = parseFloat(list[list.length - 4][1]);
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
}

async function fetchAnalysis(symbol) {
    const list = await fetchBybitKlines(symbol);
    if (!list) return null;

    const closes = list.map(k => parseFloat(k[4]));
    const lastCandle = list[list.length - 1];
    const prevCandle = list[list.length - 2];

    const openPrice = parseFloat(lastCandle[1]);
    const highPrice = parseFloat(lastCandle[2]);
    const lowPrice = parseFloat(lastCandle[3]);
    const currentPrice = parseFloat(lastCandle[4]);

    const prevHigh = parseFloat(prevCandle[2]);
    const prevLow = parseFloat(prevCandle[3]);

    const rsi1m = calculateRSI(closes, 14);
    const bb = calculateBollinger(closes, 20, 2);

    const currentVol = parseFloat(lastCandle[5]);
    const pastVols = list.slice(-21, -1).map(k => parseFloat(k[5]));
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
            tradeHistory.push({ type: 'TP', time: Date.now() });

            const gainPct = (((trade.tp1 - trade.entry) / trade.entry) * 100).toFixed(2);
            const tp1Msg = `✅ <b>HEDEF GELDİ! (TP1 ALINDI) | #${cleanSymbol}/USDT</b>\n\n` +
                           `🎯 <b>Yön:</b> 🟢 LONG SCALP\n` +
                           `💵 <b>Giriş:</b> $${formatPrice(trade.entry, trade.entry)}\n` +
                           `🎯 <b>TP1 Fiyatı:</b> $${formatPrice(trade.tp1, trade.entry)}\n` +
                           `💰 <b>Kazanılan Kâr:</b> +%${gainPct} (10x Kaldıraç ile +%${(gainPct * 10).toFixed(1)})\n\n` +
                           `🛡️ <b>ÖNEMLİ:</b> Stop noktanız <b>GİRİŞ SEVİYESİNE ($${formatPrice(trade.entry, trade.entry)})</b> çekildi. Risk sıfırlandı!\n\n` +
                           `${getStatsText()}\n` +
                           `⏱ <b>${nowTime} (TSİ)</b>`;
            await sendTelegramMessage(tp1Msg);
        }

        if (currentPrice >= trade.tp2) {
            tradeHistory.push({ type: 'TP', time: Date.now() });
            const gainPct = (((trade.tp2 - trade.entry) / trade.entry) * 100).toFixed(2);
            const tp2Msg = `✅✅ <b>TÜM HEDEFLER TAMAMLANDI! (TP2) | #${cleanSymbol}/USDT</b>\n\n` +
                           `🎯 <b>Yön:</b> 🟢 LONG SCALP\n` +
                           `💵 <b>Giriş:</b> $${formatPrice(trade.entry, trade.entry)}\n` +
                           `🎯 <b>TP2 Fiyatı:</b> $${formatPrice(trade.tp2, trade.entry)}\n` +
                           `🚀 <b>Net Kazanç:</b> +%${gainPct} (10x Kaldıraç ile +%${(gainPct * 10).toFixed(1)})\n\n` +
                           `🎉 <i>Tebrikler! Pozisyon tamamen kârla kapatıldı.</i>\n\n` +
                           `${getStatsText()}\n` +
                           `⏱ <b>${nowTime} (TSİ)</b>`;
            await sendTelegramMessage(tp2Msg);
            activeTrades.delete(symbol);
            return;
        }

        if (currentPrice <= trade.sl) {
            tradeHistory.push({ type: 'STOP', time: Date.now() });
            const lossPct = (((trade.sl - trade.entry) / trade.entry) * 100).toFixed(2);
            const stopMsg = `❌ <b>STOP TETİKLENDİ | #${cleanSymbol}/USDT</b>\n\n` +
                            `🎯 <b>Yön:</b> 🟢 LONG SCALP\n` +
                            `💵 <b>Giriş:</b> $${formatPrice(trade.entry, trade.entry)}\n` +
                            `🛑 <b>Stop Fiyatı:</b> $${formatPrice(trade.sl, trade.entry)} (${lossPct}%)\n\n` +
                            `⚠️ <i>İşlem stop seviyesine temas etti, pozisyon kapatıldı.</i>\n\n` +
                            `${getStatsText()}\n` +
                            `⏱ <b>${nowTime} (TSİ)</b>`;
            await sendTelegramMessage(stopMsg);
            activeTrades.delete(symbol);
            return;
        }
    }

    if (trade.side === 'SHORT') {
        if (!trade.tp1Hit && currentPrice <= trade.tp1) {
            trade.tp1Hit = true;
            trade.sl = trade.entry;
            tradeHistory.push({ type: 'TP', time: Date.now() });

            const gainPct = (((trade.entry - trade.tp1) / trade.entry) * 100).toFixed(2);
            const tp1Msg = `✅ <b>HEDEF GELDİ! (TP1 ALINDI) | #${cleanSymbol}/USDT</b>\n\n` +
                           `🎯 <b>Yön:</b> 🔴 SHORT SCALP\n` +
                           `💵 <b>Giriş:</b> $${formatPrice(trade.entry, trade.entry)}\n` +
                           `🎯 <b>TP1 Fiyatı:</b> $${formatPrice(trade.tp1, trade.entry)}\n` +
                           `💰 <b>Kazanılan Kâr:</b> +%${gainPct} (10x Kaldıraç ile +%${(gainPct * 10).toFixed(1)})\n\n` +
                           `🛡️ <b>ÖNEMLİ:</b> Stop noktanız <b>GİRİŞ SEVİYESİNE ($${formatPrice(trade.entry, trade.entry)})</b> çekildi. Risk sıfırlandı!\n\n` +
                           `${getStatsText()}\n` +
                           `⏱ <b>${nowTime} (TSİ)</b>`;
            await sendTelegramMessage(tp1Msg);
        }

        if (currentPrice <= trade.tp2) {
            tradeHistory.push({ type: 'TP', time: Date.now() });
            const gainPct = (((trade.entry - trade.tp2) / trade.entry) * 100).toFixed(2);
            const tp2Msg = `✅✅ <b>TÜM HEDEFLER TAMAMLANDI! (TP2) | #${cleanSymbol}/USDT</b>\n\n` +
                           `🎯 <b>Yön:</b> 🔴 SHORT SCALP\n` +
                           `💵 <b>Giriş:</b> $${formatPrice(trade.entry, trade.entry)}\n` +
                           `🎯 <b>TP2 Fiyatı:</b> $${formatPrice(trade.tp2, trade.entry)}\n` +
                           `🚀 <b>Net Kazanç:</b> +%${gainPct} (10x Kaldıraç ile +%${(gainPct * 10).toFixed(1)})\n\n` +
                           `🎉 <i>Tebrikler! Pozisyon tamamen kârla kapatıldı.</i>\n\n` +
                           `${getStatsText()}\n` +
                           `⏱ <b>${nowTime} (TSİ)</b>`;
            await sendTelegramMessage(tp2Msg);
            activeTrades.delete(symbol);
            return;
        }

        if (currentPrice >= trade.sl) {
            tradeHistory.push({ type: 'STOP', time: Date.now() });
            const lossPct = (((trade.entry - trade.sl) / trade.entry) * 100).toFixed(2);
            const stopMsg = `❌ <b>STOP TETİKLENDİ | #${cleanSymbol}/USDT</b>\n\n` +
                            `🎯 <b>Yön:</b> 🔴 SHORT SCALP\n` +
                            `💵 <b>Giriş:</b> $${formatPrice(trade.entry, trade.entry)}\n` +
                            `🛑 <b>Stop Fiyatı:</b> $${formatPrice(trade.sl, trade.entry)} (${lossPct}%)\n\n` +
                            `⚠️ <i>İşlem stop seviyesine temas etti, pozisyon kapatıldı.</i>\n\n` +
                            `${getStatsText()}\n` +
                            `⏱ <b>${nowTime} (TSİ)</b>`;
            await sendTelegramMessage(stopMsg);
            activeTrades.delete(symbol);
            return;
        }
    }

    if (Date.now() - trade.time > 2 * 60 * 60 * 1000) {
        activeTrades.delete(symbol);
    }
}

async function scanMarket() {
    try {
        await checkSessionAlerts();
        await checkBreakingNews();

        const config = getMarketParameters();
        console.log(`50 Parite taranıyor [${config.sessionName}]...`, getTurkishTimeString());

        const btc = await checkBtcCondition();
        if (!btc.safe) {
            console.log(`⚠️ BTC son 3 dakikada sert dalgalandı (%${btc.change3m}). Bu tur sinyal kilitlendi.`);
            return;
        }

        let signalSentInThisCycle = false;

        let lowVolumeCount = 0;
        let neutralRsiCount = 0;
        let noBandTouchCount = 0;
        let scannedCount = 0;

        for (const symbol of TARGET_COINS) {
            const data = await fetchAnalysis(symbol);
            await sleep(150);

            if (!data || !data.bb) continue;
            scannedCount++;

            const {
                symbol: sym, currentPrice, openPrice, highPrice, lowPrice,
                prevHigh, prevLow, rsi1m, bb, volMultiplier
            } = data;

            await checkActiveTrades(sym, currentPrice);

            const now = Date.now();
            const cleanSymbol = sym.replace('USDT', '');
            const binanceUrl = `https://www.binance.com/tr/futures/${sym}`;

            let signal = null;

            // SHORT Kontrolü: Güvenli Stop (%0.95 marj) ve Hızlı TP1
            const touchedUpper = highPrice >= bb.upper * 0.999 || prevHigh >= bb.upper * 0.999;
            const hasUpperRejection = (currentPrice < highPrice) || (currentPrice < openPrice);

            if (rsi1m >= config.rsiShort && touchedUpper && hasUpperRejection && volMultiplier >= config.minVolMultiplier && btc.btcTrend !== "PUMP") {
                const highestPoint = Math.max(highPrice, prevHigh);
                const sl = highestPoint * 1.0095;
                const riskDist = sl - currentPrice;

                const tp1 = currentPrice - (riskDist * 1.0);
                const tp2 = Math.min(bb.lower, currentPrice - (riskDist * 2.2));

                const profitPercentTP1 = ((currentPrice - tp1) / currentPrice) * 100;

                if (profitPercentTP1 >= 0.45) {
                    signal = {
                        type: "🔴 SHORT SCALP",
                        rawEntry: currentPrice,
                        rawSl: sl,
                        rawTp1: tp1,
                        rawTp2: tp2,
                        sl: formatPrice(sl, currentPrice),
                        tp1: formatPrice(tp1, currentPrice),
                        tp2: formatPrice(tp2, currentPrice),
                        tp1Pct: profitPercentTP1.toFixed(2),
                        reason: `Bant Reddi / Tepe Fitili, Hacim ${volMultiplier}x (${config.sessionName})`
                    };
                }
            }

            // LONG Kontrolü: Güvenli Stop (%0.95 marj) ve Hızlı TP1
            const touchedLower = lowPrice <= bb.lower * 1.001 || prevLow <= bb.lower * 1.001;
            const hasLowerRejection = (currentPrice > lowPrice) || (currentPrice > openPrice);

            if (rsi1m <= config.rsiLong && touchedLower && hasLowerRejection && volMultiplier >= config.minVolMultiplier && btc.btcTrend !== "DUMP") {
                const lowestPoint = Math.min(lowPrice, prevLow);
                const sl = lowestPoint * 0.9905;
                const riskDist = currentPrice - sl;

                const tp1 = currentPrice + (riskDist * 1.0);
                const tp2 = Math.max(bb.upper, currentPrice + (riskDist * 2.2));

                const profitPercentTP1 = ((tp1 - currentPrice) / currentPrice) * 100;

                if (profitPercentTP1 >= 0.45) {
                    signal = {
                        type: "🟢 LONG SCALP",
                        rawEntry: currentPrice,
                        rawSl: sl,
                        rawTp1: tp1,
                        rawTp2: tp2,
                        sl: formatPrice(sl, currentPrice),
                        tp1: formatPrice(tp1, currentPrice),
                        tp2: formatPrice(tp2, currentPrice),
                        tp1Pct: profitPercentTP1.toFixed(2),
                        reason: `Dip Tepkisi / Destek Fitili, Hacim ${volMultiplier}x (${config.sessionName})`
                    };
                }
            }

            if (!signal) {
                if (rsi1m > config.rsiLong && rsi1m < config.rsiShort) {
                    neutralRsiCount++;
                } else if (!touchedUpper && !touchedLower) {
                    noBandTouchCount++;
                } else if (volMultiplier < config.minVolMultiplier) {
                    lowVolumeCount++;
                }
            }

            // Spike Radarı
            const candleChange = ((currentPrice - openPrice) / openPrice) * 100;
            const isSpike = Math.abs(candleChange) >= 1.0;
            const lastSpikeTime = spikeAlertedCoins.get(sym) || 0;

            if (isSpike && (now - lastSpikeTime >= 4 * 60 * 1000)) {
                if (!signal && !activeTrades.has(sym)) {
                    const isPump = candleChange > 0;
                    const changeIcon = isPump ? "🟢" : "🔴";

                    const infoMsg = `💰 <b>#${cleanSymbol}USDT</b> (Anlık Hacim Dalgası)\n` +
                                    `<b>Change:</b> ${changeIcon} %${candleChange.toFixed(2)}\n` +
                                    `<b>Last Price:</b> $${formatPrice(currentPrice, currentPrice)}\n` +
                                    `<b>Previous Price:</b> $${formatPrice(openPrice, currentPrice)}\n\n` +
                                    `ℹ️ <i>Not: Strateji dönüş teyitleri oluşmadı. Sadece bilgilendirme amaçlıdır.</i>\n\n` +
                                    `🔗 <a href="${binanceUrl}">Binance</a> | <a href="https://www.tradingview.com/symbols/${sym}">TV</a>\n` +
                                    `⏱ <b>${getTurkishTimeString()} (TSİ)</b>`;

                    await sendTelegramMessage(infoMsg);
                    spikeAlertedCoins.set(sym, now);
                }
            }

            // Sinyal İletimi
            const lastAlertTime = alertedCoins.get(sym) || 0;
            if (signal && !activeTrades.has(sym) && (now - lastAlertTime >= 15 * 60 * 1000)) {
                const wallInfo = await fetchOrderBookWall(sym, config.wallThreshold);
                const wallText = wallInfo ? `\n• ${wallInfo}` : '';

                const msg = `👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n` +
                            `⚡ <b>KÜRESEL SEANS SCALP SİNYALİ</b> ⚡\n\n` +
                            `🪙 <b>Coin:</b> #${cleanSymbol}/USDT\n` +
                            `🎯 <b>Yön:</b> ${signal.type}\n` +
                            `💵 <b>Giriş Fiyatı:</b> $${formatPrice(currentPrice, currentPrice)}\n` +
                            `🛑 <b>Önerilen Stop:</b> $${signal.sl}\n` +
                            `⚖️ <b>Önerilen Kaldıraç:</b> 5x – 10x Cross/İzole\n\n` +
                            `🎯 <b>Kademeli Kâr Hedefleri:</b>\n` +
                            `• <b>TP1 (İlk Kâr - %${signal.tp1Pct}):</b> $${signal.tp1}\n` +
                            `• <b>TP2 (Ana Hedef / Trend):</b> $${signal.tp2}\n` +
                            `<i>💡 TP1 alınınca Stop noktanızı Giriş Seviyesine taşıyınız.</i>\n\n` +
                            `📊 <b>Filtre Teyitleri:</b>\n` +
                            `• Aktif Seans: ${config.sessionName}\n` +
                            `• BTC 3dk Değişim: %${btc.change3m} (Stabil)\n` +
                            `• 1dk RSI: ${rsi1m}\n` +
                            `• Onay: ${signal.reason}${wallText}\n\n` +
                            `🔗 <a href="${binanceUrl}">Binance Futures'ta Aç</a>\n\n` +
                            `⚠️ <i>"YTD" HEPSİ.</i>`;

                await sendTelegramMessage(msg);
                alertedCoins.set(sym, now);

                activeTrades.set(sym, {
                    side: signal.type.includes('LONG') ? 'LONG' : 'SHORT',
                    entry: signal.rawEntry,
                    sl: signal.rawSl,
                    tp1: signal.rawTp1,
                    tp2: signal.rawTp2,
                    tp1Hit: false,
                    time: now
                });

                signalSentInThisCycle = true;
            }
        }

        // 10 Dakikalık Rapor
        const nowTime = Date.now();
        if (!signalSentInThisCycle && (nowTime - lastStatusReportTime >= 10 * 60 * 1000)) {
            const timeNow = getTurkishTimeString();
            const totalValid = Math.max(1, scannedCount);

            let primaryReason = "";
            if (scannedCount === 0) {
                primaryReason = "Veri akışı yenileniyor, bir sonraki döngüde güncellenecek.";
            } else if (neutralRsiCount >= (totalValid * 0.40)) {
                const pct = Math.round((neutralRsiCount / totalValid) * 100);
                primaryReason = `Paritelerin çoğunluğu (%${pct}) orta RSI bölgesinde (35–65 arası). Aşırılaşma yok.`;
            } else if (lowVolumeCount >= (totalValid * 0.30)) {
                const pct = Math.round((lowVolumeCount / totalValid) * 100);
                primaryReason = `Hacim yetersiz kaldı. Paritelerin %${pct}'si ${config.minVolMultiplier}x eşiğini geçemedi.`;
            } else {
                primaryReason = `Pariteler Bollinger bant sınırlarına yaklaşmadı, yatay dalgalanma sürüyor.`;
            }

            const noSignalMsg = `👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n` +
                                `⏳ <b>[${timeNow}] TARAMA DURUM RAPORU</b>\n\n` +
                                `🌐 <b>Aktif Seans:</b> ${config.sessionName}\n` +
                                `📊 <b>İncelenen:</b> ${scannedCount} Futures Paritesi\n` +
                                `⚡ <b>BTC Durumu:</b> %${btc.change3m} (Stabil)\n\n` +
                                `🔍 <b>Neden Sinyal Çıkmadı?</b>\n` +
                                `• <b>Piyasa Nedeni:</b> ${primaryReason}\n` +
                                `• <b>RSI Eşiği Dışı:</b> ${neutralRsiCount} Coin\n` +
                                `• <b>Yetersiz Hacim:</b> ${lowVolumeCount} Coin\n` +
                                `• <b>Bant Dışı Seyir:</b> ${noBandTouchCount} Coin\n\n` +
                                `${getStatsText()}\n\n` +
                                `🛡️ <i>Disiplinli scalp kuralı: Şartlar tam oturmadan sahte hareketlere işlem açılmaz. Tarama aralıksız sürüyor...</i>\n\n` +
                                `⚠️ <i>"YTD" HEPSİ.</i>`;

            await sendTelegramMessage(noSignalMsg);
            lastStatusReportTime = nowTime;
        }

    } catch (err) {
        console.error("Tarama hatası:", err.message);
    }
}

async function runLoop() {
    while (true) {
        await scanMarket();
        await sleep(15000);
    }
}

runLoop();
