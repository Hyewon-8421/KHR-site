const https = require("https");

const GAS_URL = "https://script.google.com/macros/s/AKfycbxU1t6BC5NGzl9H3x4r_f6vRdu-9A3BWaVEyCmTmJkvwN2B0-iN5-nMUDRg-x8oGageyA/exec";
const API_KEY = "jeju2026!";

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        // GAS는 302 리다이렉트를 하므로 Location 헤더 따라가기
        if (res.statusCode === 302 || res.statusCode === 301) {
          httpsGet(res.headers.location).then(resolve).catch(reject);
        } else {
          resolve(data);
        }
      });
    }).on("error", reject);
  });
}

exports.handler = async function(event, context) {
  try {
    const url = `${GAS_URL}?apiKey=${API_KEY}`;
    const body = await httpsGet(url);
    const data = JSON.parse(body);
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
