const https = require("https");

const SUPABASE_URL = "https://rfyovtepspyseidktiea.supabase.co";
const SUPABASE_KEY = "sb_publishable_UU8vDCtULeR9XBb-wDgP0g_Ef7eDncE";

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: "GET",
      headers: headers || {},
    };
    https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    }).on("error", reject).end();
  });
}

exports.handler = async function(event, context) {
  try {
    const url = `${SUPABASE_URL}/rest/v1/species_synonyms?select=표본국명,공정서국명&limit=10000&order=id.asc`;
    const result = await httpsGet(url, {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Accept": "application/json",
    });

    let rows;
    try {
      rows = JSON.parse(result.body);
    } catch (e) {
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ ok: false, error: "파싱 실패: " + result.body.substring(0, 200) }),
      };
    }

    if (!Array.isArray(rows)) {
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ ok: false, error: "예상치 못한 응답: " + JSON.stringify(rows).substring(0, 200) }),
      };
    }

    // [[표본국명, 공정서국명], ...] 형태로 반환
    const data = rows.map(r => [r["표본국명"] || "", r["공정서국명"] || ""]);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ ok: true, data }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
