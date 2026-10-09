// Küresel Finans Merkezlerine Göre Dinamik Seans Yöneticisi
function getMarketParameters() {
    const now = new Date();
    // Türkiye Saati (TSİ: UTC+3)
    const trHour = (now.getUTCHours() + 3) % 24;

    // 1. Asya Seansı (Tokyo / Hong Kong): 02:00 - 10:00 TSİ
    if (trHour >= 2 && trHour < 10) {
        return {
            sessionName: "🌏 Asya Seansı (Tokyo/HK)",
            rsiShort: 68,
            rsiLong: 32,
            minVolMultiplier: 1.05,
            wallThreshold: 180000
        };
    }

    // 2. Londra Seansı (Avrupa): 10:00 - 16:00 TSİ
    if (trHour >= 10 && trHour < 16) {
        return {
            sessionName: "🇪🇺 Londra Seansı (Avrupa)",
            rsiShort: 70,
            rsiLong: 30,
            minVolMultiplier: 1.25,
            wallThreshold: 220000
        };
    }

    // 3. New York Seansı (ABD + Londra Kesişimi): 16:00 - 02:00 TSİ
    return {
        sessionName: "🗽 New York Seansı (Wall St)",
        rsiShort: 73,
        rsiLong: 27,
        minVolMultiplier: 1.40,
        wallThreshold: 260000
    };
}
