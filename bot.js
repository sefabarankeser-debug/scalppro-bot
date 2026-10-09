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

// Binance Futures en yüksek hacimli ve en aktif 40 USDT paritesi
const TARGET_COINS = [
    "BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT",
    "BNBUSDT", "SUIUSDT", "PEPEUSDT", "AVAXUSDT", "NEARUSDT",
    "LINKUSDT", "WIFUSDT", "APTUSDT", "SHIBUSDT", "ADAUSDT",
    "TAOUSDT", "FETUSDT", "SEIUSDT", "FTMUSDT", "RENDERUSDT",
    "INJUSDT", "ARBUSDT", "OPUSDT", "TIAUSDT", "KASUSDT",
    "NOTUSDT", "FLOKIUSDT", "BONKUSDT", "TONUSDT", "PENDLEUSDT",
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
        let diff = parseFloat(klines[i][4]) - parseFloat(klines[i-1][4]);
        if (diff >= 0) gains += diff;
        else losses += Math.abs(diff);
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < klines.length; i++) {
        let diff = parseFloat(klines[i][4]) - parseFloat(klines[i-1][4]);
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

        if (maxAskWall >= 250000) return `🧱 $${(maxAskWall/1000).toFixed(0)}K Satış Duvarı`;
        if (maxBidWall >= 250000) return `🧱 $${(maxBidWall/1000).toFixed(0)}K Alış Duvarı`;
        return null;
    } catch (e) {
        return null;
    }
}

async function fetchMetrics(symbol) {
    try {
        const res = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1m&limit=60`, { headers });
        const klines = await res.json();
        if (!Array.isArray(klines) || klines.length < 20) return null;

        const currentPrice = parseFloat(klines[klines.length - 1][4]);
        const rsi = calculateRSI(klines.slice(-30));

        const index10mAgo = Math.max(0, klines.length - 11);
        const price10mAgo = parseFloat(klines[index10mAgo][1]);
        const change10m = ((currentPrice - price10mAgo) / price10mAgo) * 100;

        return { rsi, change10m, currentPrice };
    } catch (e) {
        return null;
    }
}

async function scanMarket() {
    try {
        console.log("Piyasa taranıyor (Top 40 Parite)...", new Date().toLocaleTimeString('tr-TR'));
        let signalSentInThisCycle = false;

        for (const symbol of TARGET_COINS) {
            const cleanSymbol = symbol.replace('USDT', '');

            const metrics = await fetchMetrics(symbol);
            await sleep(800); // 40 coin için dengeli güvenli aralık

            if (!metrics) continue;

            const { rsi, change10m, currentPrice } = metrics;
            const lastAlertTime = alertedCoins.get(symbol) || 0;
            const now = Date.now();

            if (now - lastAlertTime < 15 * 60 * 1000) continue;

            let signalType = null;
            if (rsi >= 78) signalType = "🔴 SHORT ADAYI (Aşırı Alım)";
            else if (rsi <= 22) signalType = "🟢 LONG ADAYI (Aşırı Satım)";

            if (signalType) {
                const wallInfo = await fetchOrderBookWall(symbol);
                const wallText = wallInfo ? `\n${wallInfo}` : '';
                const binanceUrl = `https://www.binance.com/tr/futures/${symbol}`;

                const msg = `⚡ <b>SCALP PRO SİNYALİ</b> ⚡\n\n` +
                            `🪙 <b>Coin:</b> #${cleanSymbol}/USDT\n` +
                            `🎯 <b>Sinyal:</b> ${signalType}\n` +
                            `📈 <b>10dk Değişim:</b> %${change10m.toFixed(2)}\n` +
                            `⚠️ <b>RSI:</b> ${rsi}\n` +
                            `💵 <b>Fiyat:</b> $${currentPrice}${wallText}\n\n` +
                            `🔗 <a href="${binanceUrl}">Binance Futures'ta Aç</a>`;

                await sendTelegramMessage(msg);
                alertedCoins.set(symbol, now);
                signalSentInThisCycle = true;
            }
        }

        if (!signalSentInThisCycle) {
            const timeNow = new Date().toLocaleTimeString('tr-TR');
            const noSignalMsg = `⏳ <b>[${timeNow}]</b> 40 coin tarandı, bu turda uygun scalp fırsatı bulunamadı.`;
            await sendTelegramMessage(noSignalMsg);
        }

    } catch (err) {
        console.error("Tarama hatası:", err.message);
    }
}

async function runLoop() {
    while (true) {
        await scanMarket();
        // 40 coin tarandıktan sonra 25 saniye dinlenip yeni tura geçer
        await sleep(25000);
    }
}

runLoop();
