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
    res.end('ScalpPro 15M High-WinRate Engine Active\n');
}).listen(PORT, '0.0.0.0', () => {
    console.log(`Sunucu ${PORT} portunda aktif.`);
});

const TELEGRAM_TOKEN = "8930276912:AAE4xogVFRIqIjPuJ97RqHJFuHvFexNxt2k";
const CHAT_ID = "-1004412694884";

// ==========================================
// 2. HAFIZA & DEĞİŞKENLER
// ==========================================
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

// 55 Yüksek Likiditeli Futures Paritesi
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
    "LTCUSDT", "ATOMUSDT", "FILUSDT", "ETCUSDT", "ALGOUSDT",
    "DYMUSDT", "ZROUSDT", "STRKUSDT", "PYTHUSDT", "WUSDT"
];

const COIN_ALIASES = {
    "CFX": ["conflux", "cfx"],
    "DYM": ["dymension", "dym"],
    "NOT": ["notcoin", "not"],
    "JUP": ["jupiter", "jup"],
    "INJ": ["injective", "inj"],
    "STX": ["stacks", "stx"],
    "PENDLE": ["pendle"],
    "GMX": ["gmx"],
    "STRK": ["starknet", "strk"],
    "PYTH": ["pyth network", "pyth"],
    "W": ["wormhole"],
    "ZRO": ["layerzero", "zro"],
    "SUI": ["sui network", "sui"],
    "SOL": ["solana", "sol"],
    "DOGE": ["dogecoin", "doge"],
    "PEPE": ["pepe"],
    "SHIB": ["shiba", "shiba inu", "shib"],
    "BONK": ["bonk"],
    "FLOKI": ["floki"],
    "AVAX": ["avalanche", "avax"],
    "NEAR": ["near protocol", "near"],
    "WIF": ["dogwifhat", "wif"],
    "APT": ["aptos", "apt"],
    "TAO": ["bittensor", "tao"],
    "FET": ["fetch.ai", "fet", "asi"],
    "SEI": ["sei network", "sei"],
    "RENDER": ["render", "rndr"],
    "ARB": ["arbitrum", "arb"],
    "OP": ["optimism", "op"]
};

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

    return `📊 <b>Canlı Başarı Karnesi (15M):</b>\n${text1}\n${text12}`;
}

function getActiveSessionName() {
    const now = new Date();
    const trHour = (now.getUTCHours() + 3) % 24;
    if (trHour >= 2 && trHour < 10) return "🌏 Asya Seansı";
    if (trHour >= 10 && trHour < 16) return "🇪🇺 Londra Seansı";
    return "🗽 New York Seansı";
}

// ==========================================
// 3. API & İLETİŞİM MOTORLARI
// ==========================================
function fetchJSON(url, customHeaders = {}) {
    return new Promise((resolve, reject) => {
        const headers = Object.assign({ 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, customHeaders);
        https.get(url, { headers }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

function sendTelegramMessage(text) {
    return new Promise((resolve) => {
        const payload = JSON.stringify({
            chat_id: CHAT_ID,
            text: text,
            parse_mode: 'HTML',
            disable_web_page_preview: true
        });

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
            let resData = '';
            res.on('data', chunk => resData += chunk);
            res.on('end', () => resolve(res.statusCode === 200));
        });

        req.on('error', (e) => {
            console.error('🔴 Telegram Hatası:', e.message);
            resolve(false);
        });

        req.write(payload);
        req.end();
    });
}

// ==========================================
// 4. HABER RADARI (CRYPTOPANIC)
// ==========================================
async function checkBreakingNews() {
    try {
        const now = Date.now();
        if (now - lastNewsCheckTime < 60 * 1000) return;
        lastNewsCheckTime = now;

        const data = await fetchJSON('https://cryptopanic.com/api/free/v1/posts/?public=true');
        if (!data || !data.results || !Array.isArray(data.results)) return;

        for (const item of data.results.slice(0, 15)) {
            const newsId = item.id.toString();
            if (processedNewsIds.has(newsId)) continue;
            processedNewsIds.add(newsId);

            if (processedNewsIds.size > 300) {
                const firstKey = processedNewsIds.values().next().value;
                processedNewsIds.delete(firstKey);
            }

            const title = (item.title || "").trim();
            const lowerTitle = title.toLowerCase();

            let matchedCoin = null;

            for (const [ticker, aliases] of Object.entries(COIN_ALIASES)) {
                if (aliases.some(alias => new RegExp(`\\b${alias}\\b`, 'i').test(lowerTitle))) {
                    matchedCoin = ticker;
                    break;
                }
            }

            if (!matchedCoin) {
                for (const sym of TARGET_COINS) {
                    const clean = sym.replace('USDT', '').replace('1000', '');
                    const regex = new RegExp(`\\b${clean}\\b`, 'i');
                    if (regex.test(lowerTitle)) {
                        matchedCoin = clean;
                        break;
                    }
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
    } catch (e) {
        console.error("Haber kontrol hatası:", e.message);
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

// ==========================================
// 5. TEKNİK İNDİKATÖR FONKSİYONLARI
// ==========================================
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

function calculateEMA(closes, period = 200) {
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
        const hl = highs[i] - lows[i];
        const hc = Math.abs(highs[i] - closes[i - 1]);
        const lc = Math.abs(lows[i] - closes[i - 1]);
        trs.push(Math.max(hl, hc, lc));
    }

    const recentTrs = trs.slice(-period);
    return recentTrs.reduce((a, b) => a + b, 0) / period;
}

async function fetchBybitKlines15m(symbol) {
    try {
        const url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=15&limit=210`;
        const json = await fetchJSON(url, { 'User-Agent': 'ScalpProBot/2.0' });
        if (json.retCode !== 0 || !json.result || !json.result.list || json.result.list.length < 50) return null;
        return json.result.list.slice().reverse();
    } catch (e) {
        return null;
    }
}

async function checkBtcCondition() {
    const list = await fetchBybitKlines15m("BTCUSDT");
    if (!list || list.length < 3) return { safe: true, btcTrend: "NEUTRAL", change15m: "0.00" };

    const currentPrice = parseFloat(list[list.length - 1][4]);
    const pricePrev = parseFloat(list[list.length - 2][1]);
    const change15m = ((currentPrice - pricePrev) / pricePrev) * 100;

    const isVolatile = Math.abs(change15m) >= 1.5;
    let btcTrend = "NEUTRAL";
    if (change15m <= -0.70) btcTrend = "DUMP";
    else if (change15m >= 0.70) btcTrend = "PUMP";

    return {
        safe: !isVolatile,
        btcTrend,
        change15m: change15m.toFixed(2)
    };
}

// ==========================================
// 6. CANLI İŞLEM TAKİBİ & KÂR/ZARAR YÖNETİMİ
// ==========================================
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
                           `🎯 <b>Yön:</b> 🟢 LONG (15dk Yüksek Win Rate)\n` +
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
                           `🎯 <b>Yön:</b> 🟢 LONG (15dk Yüksek Win Rate)\n` +
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
                            `🎯 <b>Yön:</b> 🟢 LONG (15dk Yüksek Win Rate)\n` +
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
                           `🎯 <b>Yön:</b> 🔴 SHORT (15dk Yüksek Win Rate)\n` +
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
                           `🎯 <b>Yön:</b> 🔴 SHORT (15dk Yüksek Win Rate)\n` +
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
                            `🎯 <b>Yön:</b> 🔴 SHORT (15dk Yüksek Win Rate)\n` +
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

    if (Date.now() - trade.time > 4 * 60 * 60 * 1000) {
        activeTrades.delete(symbol);
    }
}

// ==========================================
// 7. 15 DAKİKALIK PROFESYONEL TARAMA DÖNGÜSÜ
// ==========================================
async function scanMarket() {
    try {
        await checkSessionAlerts();
        await checkBreakingNews();

        const session = getActiveSessionName();
        console.log(`55 Parite (15dk Yüksek Win Rate) taranıyor [${session}]...`, getTurkishTimeString());

        const btc = await checkBtcCondition();
        if (!btc.safe) {
            console.log(`⚠️ BTC aşırı dalgalandı (%${btc.change15m}). Bu tur sinyaller kilitlendi.`);
            return;
        }

        let signalSentInThisCycle = false;
        let scannedCount = 0;
        let trendBlockedCount = 0;
        let rsiNeutralCount = 0;
        let lowVolumeCount = 0;

        for (const symbol of TARGET_COINS) {
            const list = await fetchBybitKlines15m(symbol);
            await sleep(120);

            if (!list || list.length < 50) continue;
            scannedCount++;

            const opens = list.map(k => parseFloat(k[1]));
            const highs = list.map(k => parseFloat(k[2]));
            const lows = list.map(k => parseFloat(k[3]));
            const closes = list.map(k => parseFloat(k[4]));
            const volumes = list.map(k => parseFloat(k[5]));

            const currentPrice = closes[closes.length - 1];
            const currentOpen = opens[opens.length - 1];
            const currentHigh = highs[highs.length - 1];
            const currentLow = lows[lows.length - 1];
            const currentVol = volumes[volumes.length - 1];

            await checkActiveTrades(symbol, currentPrice);

            const rsi15m = calculateRSI(closes, 14);
            const ema200 = calculateEMA(closes, 200) || calculateEMA(closes, 50);
            const atr = calculateATR(highs, lows, closes, 14);

            const avgVol = volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
            const volMultiplier = avgVol > 0 ? (currentVol / avgVol).toFixed(1) : "1.0";
            const hasVolumeSpike = currentVol >= avgVol * 1.35;

            const now = Date.now();
            const cleanSymbol = symbol.replace('USDT', '');
            const binanceUrl = `https://www.binance.com/tr/futures/${symbol}`;

            let signal = null;

            // SHORT KRİTERİ:
            // 1. RSI >= 75
            // 2. Fiyat EMA 200'ün altında (Ana Düşüş Trendi Teyidi)
            // 3. Tepe Satış Fitili (Fiyat güncel tepe noktasından geri çekilmiş olmalı)
            // 4. Hacim Tükenişi (En az 1.35x hacim)
            // 5. BTC Pump yapmıyor olmalı
            const hasUpperWick = (currentHigh - Math.max(currentOpen, currentPrice)) >= (Math.abs(currentPrice - currentOpen) * 0.4);
            const isShort = (rsi15m >= 75) &&
                            (ema200 ? currentPrice <= ema200 * 1.015 : true) &&
                            (hasUpperWick || currentPrice < currentHigh) &&
                            hasVolumeSpike &&
                            (btc.btcTrend !== "PUMP");

            // LONG KRİTERİ:
            // 1. RSI <= 25
            // 2. Fiyat EMA 200'ün üzerinde (Ana Yükseliş Trendi Teyidi)
            // 3. Dip Alış Fitili (Fiyat güncel dip noktasından yukarı tepki vermiş olmalı)
            // 4. Hacim Tükenişi (En az 1.35x hacim)
            // 5. BTC Dump yapmıyor olmalı
            const hasLowerWick = (Math.min(currentOpen, currentPrice) - currentLow) >= (Math.abs(currentPrice - currentOpen) * 0.4);
            const isLong = (rsi15m <= 25) &&
                           (ema200 ? currentPrice >= ema200 * 0.985 : true) &&
                           (hasLowerWick || currentPrice > currentLow) &&
                           hasVolumeSpike &&
                           (btc.btcTrend !== "DUMP");

            if (isShort) {
                const stopDist = atr ? Math.max(atr * 1.6, currentPrice * 0.012) : currentPrice * 0.015;
                const sl = currentPrice + stopDist;
                const tp1 = currentPrice - (stopDist * 1.25);
                const tp2 = currentPrice - (stopDist * 2.50);

                signal = {
                    type: "🔴 SHORT (15dk Pro Setup)",
                    rawEntry: currentPrice,
                    rawSl: sl,
                    rawTp1: tp1,
                    rawTp2: tp2,
                    sl: formatPrice(sl, currentPrice),
                    tp1: formatPrice(tp1, currentPrice),
                    tp2: formatPrice(tp2, currentPrice),
                    tp1Pct: (((currentPrice - tp1) / currentPrice) * 100).toFixed(2),
                    reason: `15dk Tepe Fitili Onayı, ${volMultiplier}x Hacim Climax, EMA Trend Teyidi`
                };
            } else if (isLong) {
                const stopDist = atr ? Math.max(atr * 1.6, currentPrice * 0.012) : currentPrice * 0.015;
                const sl = currentPrice - stopDist;
                const tp1 = currentPrice + (stopDist * 1.25);
                const tp2 = currentPrice + (stopDist * 2.50);

                signal = {
                    type: "🟢 LONG (15dk Pro Setup)",
                    rawEntry: currentPrice,
                    rawSl: sl,
                    rawTp1: tp1,
                    rawTp2: tp2,
                    sl: formatPrice(sl, currentPrice),
                    tp1: formatPrice(tp1, currentPrice),
                    tp2: formatPrice(tp2, currentPrice),
                    tp1Pct: (((tp1 - currentPrice) / currentPrice) * 100).toFixed(2),
                    reason: `15dk Dip Fitili Onayı, ${volMultiplier}x Hacim Climax, EMA Trend Teyidi`
                };
            } else {
                if (rsi15m > 25 && rsi15m < 75) rsiNeutralCount++;
                else if (!hasVolumeSpike) lowVolumeCount++;
                else trendBlockedCount++;
            }

            // Sinyal İletimi
            const lastAlertTime = alertedCoins.get(symbol) || 0;
            if (signal && !activeTrades.has(symbol) && (now - lastAlertTime >= 25 * 60 * 1000)) {
                const msg = `👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n` +
                            `🎯 <b>15M YÜKSEK KALİTE SİNYALİ (PRO SETUP)</b> 🎯\n\n` +
                            `🪙 <b>Coin:</b> #${cleanSymbol}/USDT\n` +
                            `🎯 <b>Yön:</b> ${signal.type}\n` +
                            `💵 <b>Giriş Fiyatı:</b> $${formatPrice(currentPrice, currentPrice)}\n` +
                            `🛑 <b>Önerilen Stop (ATR Dinamik):</b> $${signal.sl}\n` +
                            `⚖️ <b>Önerilen Kaldıraç:</b> 5x – 10x Cross/İzole\n\n` +
                            `🎯 <b>Kademeli Kâr Hedefleri:</b>\n` +
                            `• <b>TP1 (İlk Kâr - %${signal.tp1Pct}):</b> $${signal.tp1}\n` +
                            `• <b>TP2 (Ana Trend Kârı):</b> $${signal.tp2}\n` +
                            `<i>💡 TP1 alınınca Stop noktanızı Giriş Seviyesine taşıyınız.</i>\n\n` +
                            `📊 <b>Filtre Teyitleri:</b>\n` +
                            `• Aktif Seans: ${session}\n` +
                            `• BTC Trend: %${btc.change15m} (${btc.btcTrend === 'NEUTRAL' ? 'Stabil' : btc.btcTrend})\n` +
                            `• 15dk RSI: ${rsi15m}\n` +
                            `• Hacim: Ortalamanın ${volMultiplier}x Katı (Climax)\n` +
                            `• Teyit: ${signal.reason}\n\n` +
                            `🔗 <a href="${binanceUrl}">Binance Futures'ta Aç</a>\n\n` +
                            `⚠️ <i>"YTD" HEPSİ.</i>`;

                await sendTelegramMessage(msg);
                alertedCoins.set(symbol, now);

                activeTrades.set(symbol, {
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

        // 15 Dakikalık Detaylı Rapor
        const nowTime = Date.now();
        if (!signalSentInThisCycle && (nowTime - lastStatusReportTime >= 15 * 60 * 1000)) {
            const timeNow = getTurkishTimeString();
            const noSignalMsg = `👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n` +
                                `⏳ <b>[${timeNow}] PİYASA FİLTRE RAPORU (15M)</b>\n\n` +
                                `🌐 <b>Aktif Seans:</b> ${session}\n` +
                                `📊 <b>İncelenen:</b> ${scannedCount} Futures Paritesi\n` +
                                `⚡ <b>BTC Durumu:</b> %${btc.change15m} (Stabil)\n\n` +
                                `🔍 <b>Neden Sinyal Çıkmadı?</b>\n` +
                                `• <b>Nötr RSI Bölgesi (25–75):</b> ${rsiNeutralCount} Parite\n` +
                                `• <b>Yetersiz Hacim / Fitil Eksikliği:</b> ${lowVolumeCount} Parite\n` +
                                `• <b>Trende Karşı Olduğu İçin Elenen:</b> ${trendBlockedCount} Parite\n\n` +
                                `${getStatsText()}\n\n` +
                                `🛡️ <i>Disiplinli kural: 15 dakikalık oturmuş dönüş fitili ve hacim tükenişi teyit edilmeden işleme girilmez.</i>\n\n` +
                                `⚠️ <i>"YTD" HEPSİ.</i>`;

            await sendTelegramMessage(noSignalMsg);
            lastStatusReportTime = nowTime;
        }

    } catch (err) {
        console.error("Tarama hatası:", err.message);
    }
}

// ==========================================
// 8. ANA ÇALIŞTIRICI
// ==========================================
async function runLoop() {
    console.log("🚀 ScalpPro 15M Yüksek Win Rate Motoru Başlatıldı...");
    await sendTelegramMessage("🤖 <b>Sistem Güncellendi:</b> 15 Dakikalık Yüksek Kalite Stratejisi (EMA Trend + Fitil + Hacim Tükenişi + ATR) devrede.");
    while (true) {
        await scanMarket();
        await sleep(15000);
    }
}

runLoop();
