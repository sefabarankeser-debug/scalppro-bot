const http = require('http');
const https = require('https');

// ==========================================
// 1. TELEGRAM & ORTAM DEĞİŞKENLERİ
// ==========================================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Render Web Service Port Bağlantısı
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Scalp Botu ve Flaş Haber Radarı Aktif 🚀');
}).listen(PORT, () => {
    console.log(`Render Web Portu dinleniyor: ${PORT}`);
});

// ==========================================
// 2. PARİTE HAVUZU (55 YÜKSEK VOLATİLİTELİ COIN)
// ==========================================
const TARGET_COINS = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
    'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'SUIUSDT', 'NEARUSDT',
    'APTUSDT', 'PEPEUSDT', 'SHIBUSDT', 'BONKUSDT', 'FLOKIUSDT',
    'WIFUSDT', 'FETUSDT', 'RENDERUSDT', 'TAOUSDT', 'INJUSDT',
    'STXUSDT', 'PENDLEUSDT', 'GMXUSDT', 'JUPUSDT', 'NOTUSDT',
    'CFXUSDT', 'DYMUSDT', 'ZROUSDT', 'STRKUSDT', 'PYTHUSDT',
    'WUSDT', 'TIAUSDT', 'SEIUSDT', 'ARBUSDT', 'OPUSDT',
    'LINKUSDT', 'DOTUSDT', 'LDOUSDT', 'ENAUSDT', 'ONDOUSDT',
    'KASUSDT', 'ORDIUSDT', 'SATSUSDT', 'AAVEUSDT', 'CRVUSDT',
    'MKRUSDT', 'SNXUSDT', 'FTMUSDT', 'GALAUSDT', 'SANDUSDT',
    'MANAUSDT', 'AXSUSDT', 'RUNEUSDT', 'ATOMUSDT', 'ALGOUSDT'
];

// ==========================================
// 3. HABER RADARI SÖZLÜĞÜ (PROJE İSİMLERİ & ALIASES)
// ==========================================
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
    "sec", "fed", "rate cut", "rate hike", "cpi", "fomc", 
    "binance", "etf", "approval", "lawsuit", "inflation", "war"
];

// ==========================================
// 4. HAFIZA & YARDIMCI İŞLEMLER
// ==========================================
let lastNewsCheckTime = 0;
const processedNewsIds = new Set();
const lastSignalTime = new Map();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Dış modül gerektirmeyen HTTPS istek fonksiyonu
function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
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

// Telegram Mesaj Gönderici
function sendTelegramMessage(text) {
    return new Promise((resolve) => {
        if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
            console.error("HATA: TELEGRAM_BOT_TOKEN veya TELEGRAM_CHAT_ID tanımlı değil!");
            return resolve(false);
        }

        const payload = JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: text,
            parse_mode: 'HTML',
            disable_web_page_preview: true
        });

        const options = {
            hostname: 'api.telegram.org',
            port: 443,
            path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
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
            console.error('Telegram Gönderim Hatası:', e.message);
            resolve(false);
        });

        req.write(payload);
        req.end();
    });
}

// ==========================================
// 5. TEKNİK İNDİKATÖR FONKSİYONLARI
// ==========================================
function calculateRSI(closes, period = 14) {
    if (closes.length < period + 1) return 50;
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
        const change = closes[i] - closes[i - 1];
        if (change >= 0) gains += change;
        else losses += Math.abs(change);
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < closes.length; i++) {
        const change = closes[i] - closes[i - 1];
        if (change >= 0) {
            avgGain = (avgGain * (period - 1) + change) / period;
            avgLoss = (avgLoss * (period - 1)) / period;
        } else {
            avgGain = (avgGain * (period - 1)) / period;
            avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
        }
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return parseFloat((100 - (100 / (1 + rs))).toFixed(2));
}

function calculateBollingerBands(closes, period = 20, multiplier = 2) {
    if (closes.length < period) return null;
    const slice = closes.slice(-period);
    const mean = slice.reduce((acc, val) => acc + val, 0) / period;
    const variance = slice.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    return {
        upper: mean + (multiplier * stdDev),
        middle: mean,
        lower: mean - (multiplier * stdDev)
    };
}

function getActiveSession() {
    const hour = new Date().getUTCHours();
    if (hour >= 13 && hour <= 21) return '🗽 New York Seansı';
    if (hour >= 7 && hour < 13) return '🏛️ Londra Seansı';
    return '🌏 Asya Seansı';
}

// ==========================================
// 6. FLAŞ HABER MOTORU (CRYPTOPANIC)
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

// ==========================================
// 7. 5M SCALP TARAMA MOTORU
// ==========================================
async function scanMarket() {
    try {
        const btcData = await fetchJSON('https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=5m&limit=2');
        if (!Array.isArray(btcData) || btcData.length < 2) return;

        const btcClosePrev = parseFloat(btcData[0][4]);
        const btcCloseLast = parseFloat(btcData[1][4]);
        const btcChange5m = ((btcCloseLast - btcClosePrev) / btcClosePrev) * 100;
        const isBtcPumping = btcChange5m > 0.6;
        const isBtcDumping = btcChange5m < -0.6;

        const session = getActiveSession();

        for (const symbol of TARGET_COINS) {
            const lastTime = lastSignalTime.get(symbol) || 0;
            if (Date.now() - lastTime < 15 * 60 * 1000) continue;

            let klines;
            try {
                klines = await fetchJSON(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=5m&limit=50`);
            } catch (err) {
                continue;
            }

            if (!Array.isArray(klines) || klines.length < 30) continue;

            const closes = klines.map(k => parseFloat(k[4]));
            const highs = klines.map(k => parseFloat(k[2]));
            const lows = klines.map(k => parseFloat(k[3]));
            const volumes = klines.map(k => parseFloat(k[5]));

            const currentClose = closes[closes.length - 1];
            const currentHigh = highs[highs.length - 1];
            const currentLow = lows[lows.length - 1];
            const currentVol = volumes[volumes.length - 1];

            const avgVol = volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
            const volMultiplier = (currentVol / avgVol).toFixed(1);

            const rsi = calculateRSI(closes, 14);
            const bb = calculateBollingerBands(closes, 20, 2);
            if (!bb) continue;

            const isShort = (rsi >= 70) &&
                            (currentHigh >= bb.upper) &&
                            (currentClose < currentHigh) &&
                            (currentVol >= avgVol * 1.2) &&
                            !isBtcPumping;

            const isLong = (rsi <= 30) &&
                           (currentLow <= bb.lower) &&
                           (currentClose > currentLow) &&
                           (currentVol >= avgVol * 1.2) &&
                           !isBtcDumping;

            if (isShort) {
                lastSignalTime.set(symbol, Date.now());
                const cleanSym = symbol.replace('USDT', '');
                const entry = currentClose;
                const stop = parseFloat((currentHigh * 1.006).toFixed(4));
                const tp1 = parseFloat((entry * (1 - 0.012)).toFixed(4));
                const tp2 = parseFloat((entry * (1 - 0.025)).toFixed(4));

                const msg = `👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n` +
                            `⚡ <b>KÜRESEL SEANS SCALP SİNYALİ (5M)</b> ⚡\n\n` +
                            `🪙 <b>Coin:</b> #${cleanSym}/USDT\n` +
                            `🎯 <b>Yön:</b> 🔴 SHORT SCALP (5dk)\n` +
                            `💵 <b>Giriş Fiyatı:</b> $${entry}\n` +
                            `🛑 <b>Önerilen Stop:</b> $${stop}\n` +
                            `⚖️ <b>Önerilen Kaldıraç:</b> 5x – 10x Cross/İzole\n\n` +
                            `🎯 <b>Kademeli Kâr Hedefleri:</b>\n` +
                            `• <b>TP1 (İlk Kâr - %1.2):</b> $${tp1}\n` +
                            `• <b>TP2 (Ana Hedef / Trend):</b> $${tp2}\n` +
                            `💡 <i>TP1 alınınca Stop noktanızı Giriş Seviyesine taşıyınız.</i>\n\n` +
                            `📊 <b>Filtre Teyitleri:</b>\n` +
                            `• Aktif Seans: ${session}\n` +
                            `• BTC Durumu: %${btcChange5m.toFixed(2)} (${btcChange5m >= 0 ? 'Pozitif' : 'Stabil/Negatif'})\n` +
                            `• 5dk RSI: ${rsi}\n` +
                            `• Onay: 5dk Bant Reddi / Tepe Fitili, Hacim ${volMultiplier}x (${session})\n\n` +
                            `⚠️ <i>"YTD" HEPSİ.</i>`;

                await sendTelegramMessage(msg);
                await sleep(1500);
            } else if (isLong) {
                lastSignalTime.set(symbol, Date.now());
                const cleanSym = symbol.replace('USDT', '');
                const entry = currentClose;
                const stop = parseFloat((currentLow * 0.994).toFixed(4));
                const tp1 = parseFloat((entry * (1 + 0.012)).toFixed(4));
                const tp2 = parseFloat((entry * (1 + 0.025)).toFixed(4));

                const msg = `👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n` +
                            `⚡ <b>KÜRESEL SEANS SCALP SİNYALİ (5M)</b> ⚡\n\n` +
                            `🪙 <b>Coin:</b> #${cleanSym}/USDT\n` +
                            `🎯 <b>Yön:</b> 🟢 LONG SCALP (5dk)\n` +
                            `💵 <b>Giriş Fiyatı:</b> $${entry}\n` +
                            `🛑 <b>Önerilen Stop:</b> $${stop}\n` +
                            `⚖️ <b>Önerilen Kaldıraç:</b> 5x – 10x Cross/İzole\n\n` +
                            `🎯 <b>Kademeli Kâr Hedefleri:</b>\n` +
                            `• <b>TP1 (İlk Kâr - %1.2):</b> $${tp1}\n` +
                            `• <b>TP2 (Ana Hedef / Trend):</b> $${tp2}\n` +
                            `💡 <i>TP1 alınınca Stop noktanızı Giriş Seviyesine taşıyınız.</i>\n\n` +
                            `📊 <b>Filtre Teyitleri:</b>\n` +
                            `• Aktif Seans: ${session}\n` +
                            `• BTC Durumu: %${btcChange5m.toFixed(2)} (${btcChange5m >= 0 ? 'Pozitif' : 'Stabil/Negatif'})\n` +
                            `• 5dk RSI: ${rsi}\n` +
                            `• Onay: 5dk Dip Tepkisi / Destek Fitili, Hacim ${volMultiplier}x (${session})\n\n` +
                            `⚠️ <i>"YTD" HEPSİ.</i>`;

                await sendTelegramMessage(msg);
                await sleep(1500);
            }
        }
    } catch (e) {
        console.error("Tarama döngüsü hatası:", e.message);
    }
}

// ==========================================
// 8. ANA ÇALIŞTIRICI
// ==========================================
async function main() {
    console.log("🚀 Scalp Botu & Flaş Haber Radarı Başlatıldı...");
    await sendTelegramMessage("🤖 <b>Sistem Aktif:</b> 5m Scalp Tarayıcısı ve Gelişmiş Haber Radarı devrede.");

    while (true) {
        await checkBreakingNews();
        await scanMarket();
        await sleep(15000);
    }
}

main();
