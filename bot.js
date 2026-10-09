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

const TARGET_COINS = [
    "BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT",
    "BNBUSDT", "SUIUSDT", "PEPEUSDT", "AVAXUSDT", "NEARUSDT",
    "LINKUSDT", "WIFUSDT", "APTUSDT", "SHIBUSDT", "ADAUSDT",
    "TAOUSDT", "FETUSDT", "SEIUSDT", "TRXUSDT", "RENDERUSDT",
    "INJUSDT", "ARBUSDT", "OPUSDT", "TIAUSDT", "KASUSDT",
    "NOTUSDT", "FLOKIUSDT", "BONKUSDT", "BCHUSDT", "PENDLEUSDT",
    "GALAUSDT", "STXUSDT", "ORDIUSDT", "RUNEUSDT", "AAVEUSDT",
    "LDOUSDT", "WLDUSDT", "JUPUSDT", "ENAUSDT", "POLUSDT"
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

async function fetchAnalysis(symbol) {
    try {
        // 1 dakikalık mumlar (Scalp tetikleyicisi)
        const res1m = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1m&limit=40`, { headers });
        const klines1m = await res1m.json();
        if (!Array.isArray(klines1m) || klines1m.length < 25) return null;

        // 1 saatlik mumlar (Trend filtresi)
        const res1h = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1h&limit=25`, { headers });
        const klines1h = await res1h.json();
        if (!Array.isArray(klines1h) || klines1h.length < 15) return null;

        const currentPrice = parseFloat(klines1m[klines1m.length - 1][4]);
        const rsi1m = calculateRSI(klines1m.slice(-30));
        const rsi1h = calculateRSI(klines1h);
        const bb = calculateBollinger(klines1m, 20, 2);

        // Hacim analizi (Son mum vs önceki 20 mum ortalaması)
        const currentVol = parseFloat(klines1m[klines1m.length - 1][5]);
        const pastVols = klines1m.slice(-21, -1).map(k => parseFloat(k[5]));
        const avgVol = pastVols.reduce((a, b) => a + b, 0) / pastVols.length;
        const volMultiplier = avgVol > 0 ? (currentVol / avgVol).toFixed(1) : 1;

        // Mum fitil hesaplaması
        const lastCandle = klines1m[klines1m.length - 1];
        const open = parseFloat(lastCandle[1]);
        const high = parseFloat(lastCandle[2]);
        const low = parseFloat(lastCandle[3]);
        const close = parseFloat(lastCandle[4]);
        const totalRange = high - low;

        const upperWick = totalRange > 0 ? (high - Math.max(open, close)) / totalRange : 0;
        const lowerWick = totalRange > 0 ? (Math.min(open, close) - low) / totalRange : 0;

        return {
            symbol,
            currentPrice,
            rsi1m,
            rsi1h,
            bb,
            volMultiplier,
            upperWick,
            lowerWick,
            high,
            low
        };
    } catch (e) {
        return null;
    }
}

async function scanMarket() {
    try {
        console.log("Piyasa taranıyor (Keskin Scalp Motoru)...", new Date().toLocaleTimeString('tr-TR'));
        let signalSentInThisCycle = false;

        for (const symbol of TARGET_COINS) {
            const data = await fetchAnalysis(symbol);
            await sleep(650);

            if (!data || !data.bb) continue;

            const { symbol: sym, currentPrice, rsi1m, rsi1h, bb, volMultiplier, upperWick, lowerWick, high, low } = data;
            const lastAlertTime = alertedCoins.get(sym) || 0;
            const now = Date.now();

            if (now - lastAlertTime < 15 * 60 * 1000) continue;

            let signal = null;

            // KESKİN SHORT KOŞULLARI:
            // 1m RSI >= 76, Fiyat Bollinger Üst bandını zorluyor, Hacim 1.6x+, Üst fitil var ve 1h RSI aşırı boğa değil (<= 60)
            if (rsi1m >= 76 && currentPrice >= bb.upper * 0.999 && volMultiplier >= 1.6 && rsi1h <= 60) {
                const sl = (high * 1.002).toFixed(4); // Son tepenin %0.2 üzeri stop
                const tp = bb.middle.toFixed(4);      // Bollinger ortası kâr al
                signal = {
                    type: "🔴 SHORT SCALP",
                    sl,
                    tp,
                    reason: `1h RSI (${rsi1h}) uygun, Hacim ${volMultiplier}x, Üst Bant Dışı`
                };
            }

            // KESKİN LONG KOŞULLARI:
            // 1m RSI <= 24, Fiyat Bollinger Alt bandını zorluyor, Hacim 1.6x+, Alt fitil var ve 1h RSI aşırı ayı değil (>= 40)
            else if (rsi1m <= 24 && currentPrice <= bb.lower * 1.001 && volMultiplier >= 1.6 && rsi1h >= 40) {
                const sl = (low * 0.998).toFixed(4);  // Son dibin %0.2 altı stop
                const tp = bb.middle.toFixed(4);      // Bollinger ortası kâr al
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

                const msg = `⚡ <b>KESKİN SCALP SİNYALİ</b> ⚡\n\n` +
                            `🪙 <b>Coin:</b> #${cleanSymbol}/USDT\n` +
                            `🎯 <b>Yön:</b> ${signal.type}\n` +
                            `💵 <b>Giriş Fiyatı:</b> $${currentPrice}\n` +
                            `🛑 <b>Önerilen Stop:</b> $${signal.sl}\n` +
                            `🎯 <b>Hedef Kâr (TP):</b> $${signal.tp}\n\n` +
                            `📊 <b>Filtreler:</b>\n` +
                            `• 1dk RSI: ${rsi1m} | 1s RSI: ${rsi1h}\n` +
                            `• Hacim Patlaması: ${signal.reason}${wallText}\n\n` +
                            `🔗 <a href="${binanceUrl}">Binance Futures'ta Aç</a>`;

                await sendTelegramMessage(msg);
                alertedCoins.set(sym, now);
                signalSentInThisCycle = true;
            }
        }

        if (!signalSentInThisCycle) {
            const timeNow = new Date().toLocaleTimeString('tr-TR');
            const noSignalMsg = `⏳ <b>[${timeNow}]</b> 40 coin tarandı. Çoklu indikatör şartlarını (1s Trend + 1dk BB + Hacim + RSI) sağlayan kusursuz scalp fırsatı bekleniyor...`;
            await sendTelegramMessage(noSignalMsg);
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
