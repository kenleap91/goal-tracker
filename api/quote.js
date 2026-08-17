/**
 * Vercel serverless function: proxies stock/ETF/crypto/FX quotes from
 * Yahoo Finance's unofficial per-symbol chart endpoint so the browser can
 * fetch them without hitting CORS (Yahoo doesn't send CORS headers for
 * direct browser requests). The chart endpoint is used instead of the v7
 * quote endpoint because Yahoo now requires a session cookie + crumb for
 * v7, while the chart endpoint still answers basic price requests without
 * that dance. This is best-effort, unofficial, undocumented data — fine
 * for a personal net-worth dashboard, not for trading decisions.
 *
 * GET /api/quote?symbols=AAPL,7203.T,BTC-USD,JPY=X
 * -> { AAPL: { price, currency, name }, ... }
 */
var USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

function fetchOne(symbol) {
  var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol) + '?interval=1d&range=1d';
  return fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    .then(function (res) {
      if (!res.ok) return null;
      return res.json();
    })
    .then(function (data) {
      var result = data && data.chart && data.chart.result && data.chart.result[0];
      var meta = result && result.meta;
      if (!meta || meta.regularMarketPrice == null) return null;
      return {
        symbol: symbol,
        price: meta.regularMarketPrice,
        currency: meta.currency,
        name: meta.symbol || symbol
      };
    })
    .catch(function () { return null; });
}

module.exports = async function handler(req, res) {
  var symbolsParam = req.query.symbols;
  if (!symbolsParam) {
    res.status(400).json({ error: 'symbols query param required' });
    return;
  }

  var symbols = String(symbolsParam)
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(Boolean);

  if (symbols.length === 0) {
    res.status(400).json({ error: 'no valid symbols provided' });
    return;
  }

  try {
    var quotes = await Promise.all(symbols.map(fetchOne));
    var results = {};
    quotes.forEach(function (q) {
      if (q) results[q.symbol] = { price: q.price, currency: q.currency, name: q.name };
    });

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    res.status(200).json(results);
  } catch (err) {
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
};
