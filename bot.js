const http = require('http');

const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ScalpPro Bot Active\n');
}).listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda aktif.`);
});

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8930276912:AAE4xogVFRIqIjPuJ97RqHJFuHvFexNxt2k";
const CHAT_ID = process.env.CHAT_ID || "956236479";

const alertedCoins = new Map();
let lastStatusReportTime = 0;

// Binance USDⓈ-M Vadeli İşlemler resmi kontrat sembolleriyle birebir doğrulanmış 40 parite:
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

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
            console.error("🔴 Telegram Gönderim Hatası:", data.description);
        } else {
            console.log("🟢 Telegram mesajı başarıyla iletildi.");
        }
    } catch (e) {
        console.error("🔴 Telegram Ağ Hatası:", e.message);
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
            avgGain = (avgGain * 13) / 14;
            avgLoss = (avgLoss * 13 + Math.abs(diff)) / 14;
        }
    }
    if (avgLoss === 0) return 100;
    return Math.round(100 - (100 / (1 + (avgGain / avgLoss))));
}

function calculateBollinger(klines, period = 20, multiplier = 2) {
    if (klines.length < period) return null;
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

async function fetchOrderBookWall(symbol) {
    try {
        const res = await fetch(`https://fapi.binance.com/fapi/v1/depth?symbol=${symbol}&limit=20`, { headers });
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

        if (maxAskWall >= 250000) return `🧱 $${(maxAskWall / 1000).toFixed(0)}K Satış Duvarı`;
        if (maxBidWall >= 250000) return `🧱 $${(maxBidWall / 1000).toFixed(0)}K Alış Duvarı`;
        return null;
    } catch (e) {
        return null;
    }
}

async function checkBtcCondition() {
    try {
        const res = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=1m&limit=5`, { headers });
        const klines = await res.json();
        if (!Array.isArray(klines) || klines.length < 4) return { safe: true, btcTrend: "NEUTRAL", change3m: 0 };

        const currentPrice = parseFloat(klines[klines.length - 1][4]);
        const price3mAgo = parseFloat(klines[klines.length - 4][1]);
        const change3m = ((currentPrice - price3mAgo) / price3mAgo) * 100;

        const isVolatile = Math.abs(change3m) >= 0.45;
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
        return { safe: true, btcTrend: "NEUTRAL", change3m: 0 };
    }
}

async function fetchAnalysis(symbol) {
    try {
        const res1m = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1m&limit=40`, { headers });
        const klines1m = await res1m.json();
        if (!Array.isArray(klines1m) || klines1m.length < 25) return null;

        const res1h = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1h&limit=25`, { headers });
        const klines1h = await res1h.json();
        if (!Array.isArray(klines1h) || klines1h.length < 15) return null;

        const currentPrice = parseFloat(klines1m[klines1m.length - 1][4]);
        const rsi1m = calculateRSI(klines1m.slice(-30));
        const rsi1h = calculateRSI(klines1h);
        const bb = calculateBollinger(klines1m, 20, 2);

        const currentVol = parseFloat(klines1m[klines1m.length - 1][5]);
        const pastVols = klines1m.slice(-21, -1).map(k => parseFloat(k[5]));
        const avgVol = pastVols.reduce((a, b) => a + b, 0) / pastVols.length;
        const volMultiplier = avgVol > 0 ? (currentVol / avgVol).toFixed(1) : 1;

        const lastCandle = klines1m[klines1m.length - 1];
        const high = parseFloat(lastCandle[2]);
        const low = parseFloat(lastCandle[3]);

        return {
            symbol,
            currentPrice,
            rsi1m,
            rsi1h,
            bb,
            volMultiplier,
            high,
            low
        };
    } catch (e) {
        return null;
    }
}

async function scanMarket() {
    try {
        console.log("Piyasa taranıyor (40 Birebir Binance Vadeli Paritesi)...", new Date().toLocaleTimeString('tr-TR'));

        const btc = await checkBtcCondition();
        if (!btc.safe) {
            console.log(`⚠️ BTC son 3 dakikada aşırı dalgalandı (%${btc.change3m}). Bu tur altcoin sinyalleri kilitlendi.`);
            return;
        }

        let signalSentInThisCycle = false;

        for (const symbol of TARGET_COINS) {
            const data = await fetchAnalysis(symbol);
            await sleep(650);

            if (!data || !data.bb) continue;

            const { symbol: sym, currentPrice, rsi1m, rsi1h, bb, volMultiplier, high, low } = data;
            const lastAlertTime = alertedCoins.get(sym) || 0;
            const now = Date.now();

            if (now - lastAlertTime < 15 * 60 * 1000) continue;

            let signal = null;

            if (rsi1m >= 76 && currentPrice >= bb.upper * 0.999 && volMultiplier >= 1.6 && rsi1h <= 60 && btc.btcTrend !== "PUMP") {
                const sl = (high * 1.002).toFixed(4);
                const tp = bb.middle.toFixed(4);
                signal = {
                    type: "🔴 SHORT SCALP",
                    sl,
                    tp,
                    reason: `1h RSI (${rsi1h}) uygun, Hacim ${volMultiplier}x, Üst Bant Dışı`
                };
            } else if (rsi1m <= 24 && currentPrice <= bb.lower * 1.001 && volMultiplier >= 1.6 && rsi1h >= 40 && btc.btcTrend !== "DUMP") {
                const sl = (low * 0.998).toFixed(4);
                const tp = bb.middle.toFixed(4);
                signal = {
                    type: "🟢 LONG SCALP",
                    sl,
                    tp,
                    reason: `1h RSI (${rsi1h}) uygun, Hacim ${volMultiplier}x, Alt Bant Dışı`
                };
            }

            if (signal) {
                const cleanSymbol = sym.replace('USDT', '');
                const wallInfo = await fetchOrderBookWall(sym);
                const wallText = wallInfo ? `\n${wallInfo}` : '';
                const binanceUrl = `https://www.binance.com/tr/futures/${sym}`;

                const msg = `👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n` +
                            `⚡ <b>BTC KORUMALI SCALP SİNYALİ</b> ⚡\n\n` +
                            `🪙 <b>Coin:</b> #${cleanSymbol}/USDT\n` +
                            `🎯 <b>Yön:</b> ${signal.type}\n` +
                            `💵 <b>Giriş Fiyatı:</b> $${currentPrice}\n` +
                            `🛑 <b>Önerilen Stop:</b> $${signal.sl}\n` +
                            `🎯 <b>Hedef Kâr (TP):</b> $${signal.tp}\n\n` +
                            `📊 <b>Filtre Teyitleri:</b>\n` +
                            `• BTC 3dk Değişim: %${btc.change3m} (Stabil)\n` +
                            `• 1dk RSI: ${rsi1m} | 1s RSI: ${rsi1h}\n` +
                            `• Hacim Patlaması: ${signal.reason}${wallText}\n\n` +
                            `🔗 <a href="${binanceUrl}">Binance Futures'ta Aç</a>\n\n` +
                            `⚠️ <i>"YTD" HEPSİ.</i>`;

                await sendTelegramMessage(msg);
                alertedCoins.set(sym, now);
                signalSentInThisCycle = true;
            }
        }

        const nowTime = Date.now();
        if (!signalSentInThisCycle && (nowTime - lastStatusReportTime >= 5 * 60 * 1000)) {
            const timeNow = new Date().toLocaleTimeString('tr-TR');
            const noSignalMsg = `👋 <b>Merhaba Uşak. Şansınız bilginiz daim olsun.</b>\n\n` +
                                `⏳ <b>[${timeNow}]</b> 40 onaylı vadeli parite taranıyor. Son 5 dakikada şartları eksiksiz karşılayan fırsat çıkmadı, izleme sürüyor...\n\n` +
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
        await sleep(25000);
    }
}

runLoop();
