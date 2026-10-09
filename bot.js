const fetch = require('node-fetch');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8930276912:AAHp528BFwkuhsKeP8m0NJd9WOdQlKpJpx4
";
const CHAT_ID = process.env.CHAT_ID || "956236479";

const alertedCoins = new Map();

async function sendTelegramMessage(text) {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: text,
                parse_mode: 'Markdown',
                disable_web_page_preview: false
            })
        });
    } catch (e) {
        console.error("Telegram mesaj hatası:", e.message);
    }
}

function calculateRSI(klines, period = 14) {
    if (klines.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        let change = parseFloat(klines[i][4]) - parseFloat(klines[i-1][4]);
        if (change >= 0) gains += change;
        else losses += Math.abs(change);
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < klines.length; i++) {
        let change = parseFloat(klines[i][4]) - parseFloat(klines[i-1][4]);
        if (change >= 0) {
            avgGain = (avgGain * 13 + change) / 14;
            avgLoss = (avgLoss * 13) / 14;
        } else {
            avgGain = (avgGain * 13) / 14;
            avgLoss = (avgLoss * 13 + Math.abs(change)) / 14;
        }
    }
    if (avgLoss === 0) return 100;
    return Math.round(100 - (100 / (1 + (avgGain / avgLoss))));
}

async function fetchOrderBookWall(symbol) {
    try {
        const res = await fetch(`https://fapi.binance.com/fapi/v1/depth?symbol=${symbol}&limit=20`);
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
        const res = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1m&limit=60`);
        const klines = await res.json();
        if (!klines || klines.length < 20) return null;

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
        console.log("Piyasa taranıyor...", new Date().toLocaleTimeString('tr-TR'));
        const res = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr');
        const data = await res.json();

        let candidates = data.filter(c => c.symbol.endsWith('USDT') && parseFloat(c.quoteVolume) >= 10000000);
        candidates.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
        candidates = candidates.slice(0, 30);

        for (const coin of candidates) {
            const symbol = coin.symbol;
            const cleanSymbol = symbol.replace('USDT', '');
            const metrics = await fetchMetrics(symbol);

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

                const msg = `⚡ *SCALP PRO SİNYALİ* ⚡\n\n` +
                            `🪙 *Coin:* #${cleanSymbol}/USDT\n` +
                            `🎯 *Sinyal:* ${signalType}\n` +
                            `📈 *10dk Değişim:* %${change10m.toFixed(2)}\n` +
                            `⚠️ *RSI:* ${rsi}\n` +
                            `💵 *Fiyat:* $${currentPrice}${wallText}\n\n` +
                            `🔗 [Binance Futures'ta Aç](${binanceUrl})`;

                await sendTelegramMessage(msg);
                alertedCoins.set(symbol, now);
            }
        }
    } catch (err) {
        console.error("Tarama hatası:", err.message);
    }
}

setInterval(scanMarket, 10000);
scanMarket();
