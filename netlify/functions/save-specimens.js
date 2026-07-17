const https = require("https");

const GAS_URL = "https://script.google.com/macros/s/AKfycbxU1t6BC5NGzl9H3x4r_f6vRdu-9A3BWaVEyCmTmJkvwN2B0-iN5-nMUDRg-x8oGageyA/exec";
const API_KEY = "jeju2026!";

function httpsPost(url, body, redirectCount) {
  redirectCount = redirectCount || 0;
  return new Promise(function(resolve, reject) {
    if (redirectCount > 5) return reject(new Error("Too many redirects"));

    var urlObj = new URL(url);
    var bodyStr = typeof body === "string" ? body : JSON.stringify(body);
    var buf = Buffer.from(bodyStr, "utf8");

    var options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": buf.length,
      },
    };

    var req = https.request(options, function(res) {
      if ([301, 302, 303, 307, 308].indexOf(res.statusCode) !== -1) {
        var location = res.headers.location;
        if (!location) return reject(new Error("Redirect without location"));
        if (res.statusCode === 303) {
          return httpsGet(location).then(resolve).catch(reject);
        }
        return httpsPost(location, body, redirectCount + 1).then(resolve).catch(reject);
      }
      var data = "";
      res.on("data", function(chunk) { data += chunk; });
      res.on("end", function() { resolve(data); });
    });

    req.on("error", reject);
    req.write(buf);
    req.end();
  });
}

function httpsGet(url, redirectCount) {
  redirectCount = redirectCount || 0;
  return new Promise(function(resolve, reject) {
    if (redirectCount > 5) return reject(new Error("Too many redirects"));
    https.get(url, function(res) {
      if ([301, 302, 303, 307, 308].indexOf(res.statusCode) !== -1) {
        var location = res.headers.location;
        if (!location) return reject(new Error("Redirect without location"));
        return httpsGet(location, redirectCount + 1).then(resolve).catch(reject);
      }
      var data = "";
      res.on("data", function(chunk) { data += chunk; });
      res.on("end", function() { resolve(data); });
    }).on("error", reject);
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
    return {
      statusCode: 405,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: "Method Not Allowed",
    };
  }

  try {
    var parsed = JSON.parse(event.body);
    var rows = parsed.rows;

    if (!rows || rows.length === 0) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ ok: false, error: "데이터 없음" }),
      };
    }

    var CHUNK = 100;
    var totalAdded = 0;
    var totalSkipped = 0;

    for (var i = 0; i < rows.length; i += CHUNK) {
      var chunk = rows.slice(i, i + CHUNK);
      var payload = JSON.stringify({ apiKey: API_KEY, rows: chunk });
      var resBody = await httpsPost(GAS_URL, payload);

      var gasData;
      try {
        gasData = JSON.parse(resBody);
      } catch (e) {
        throw new Error("GAS 응답 파싱 실패: " + resBody.substring(0, 200));
      }

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
