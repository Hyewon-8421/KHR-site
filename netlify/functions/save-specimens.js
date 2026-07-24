const https = require("https");

const SUPABASE_URL = "https://rfyovtepspyseidktiea.supabase.co";
const SUPABASE_KEY = "sb_publishable_UU8vDCtULeR9XBb-wDgP0g_Ef7eDncE";
const API_KEY = "jeju2026!";

function httpsPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const buf = Buffer.from(body, "utf8");
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      headers: { ...headers, "Content-Length": buf.length },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.write(buf);
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
    return { statusCode: 405, headers: { "Access-Control-Allow-Origin": "*" }, body: "Method Not Allowed" };
  }

  try {
    const parsed = JSON.parse(event.body);

    if (parsed.apiKey !== API_KEY) {
      return {
        statusCode: 401,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ ok: false, error: "인증 실패" }),
      };
    }

    const rows = parsed.rows;
    const isUpsert = parsed.upsert === true; // 수정 모드 여부

    if (!rows || rows.length === 0) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ ok: false, error: "데이터 없음" }),
      };
    }

    const records = rows.map(r => ({
      "관리번호": r[0] || "",
      "표본번호": r[1] || "",
      "수장고":   r[2] || "",
      "수장위치": r[3] || "",
      "생약명":   r[4] || "",
      "국명":     r[5] || "",
      "학명":     r[6] || "",
      "수집날짜": r[7] || "",
      "수집장소": r[8] || "",
      "중요도":   r[9] || "",
      "속명":     r[10] || "",
      "과명":     r[11] || "",
      "gps":      r[12] || "",
      "공정서":   r[13] || "",
      "과제명":   r[14] || "",
    }));

    const CHUNK = 200;
    let totalAdded = 0;

    for (let i = 0; i < records.length; i += CHUNK) {
      const chunk = records.slice(i, i + CHUNK);
      // upsert=true면 중복 시 업데이트, false면 중복 무시
      const prefer = isUpsert
        ? "resolution=merge-duplicates,return=minimal"
        : "resolution=ignore-duplicates,return=minimal";

      const result = await httpsPost(
        `${SUPABASE_URL}/rest/v1/specimens?on_conflict=${encodeURIComponent("관리번호")}`,
        {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": prefer,
        },
        JSON.stringify(chunk)
      );

      if (result.status !== 200 && result.status !== 201 && result.status !== 204) {
        throw new Error(`Supabase 오류 (${result.status}): ${result.body.substring(0, 200)}`);
      }
      totalAdded += chunk.length;
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ ok: true, added: totalAdded }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
