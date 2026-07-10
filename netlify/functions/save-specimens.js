const https = require("https");

const GAS_URL = "https://script.google.com/macros/s/AKfycbxU1t6BC5NGzl9H3x4r_f6vRdu-9A3BWaVEyCmTmJkvwN2B0-iN5-nMUDRg-x8oGageyA/exec";
const API_KEY = "jeju2026!";

function httpsRequest(url, method, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      // GAS 302 리다이렉트 처리
      if (res.statusCode === 302 || res.statusCode === 301) {
        httpsRequest(res.headers.location, method, body).then(resolve).catch(reject);
        return;
      }
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async function(event, context) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { rows } = JSON.parse(event.body);
    const CHUNK = 100;
    let totalAdded = 0, totalSkipped = 0;

    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const payload = JSON.stringify({ apiKey: API_KEY, rows: chunk });
      const resBody = await httpsRequest(GAS_URL, "POST", payload);
      const gasData = JSON.parse(resBody);
      if (!gasData.ok) throw new Error(gasData.error || "GAS 저장 실패");
      totalAdded   += gasData.added   || 0;
      totalSkipped += gasData.skipped || 0;
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ ok: true, added: totalAdded, skipped: totalSkipped }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
