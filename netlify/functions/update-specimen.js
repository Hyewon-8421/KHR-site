const https = require("https");

const SUPABASE_URL = "https://rfyovtepspyseidktiea.supabase.co";
const SUPABASE_KEY = "sb_publishable_UU8vDCtULeR9XBb-wDgP0g_Ef7eDncE";
const API_KEY = "jeju2026!";

function httpsPatch(url, headers, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const buf = Buffer.from(body, "utf8");
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: "PATCH",
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

    const id = parsed["관리번호"];
    const row = parsed.data;

    if (!id || !row) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ ok: false, error: "관리번호 또는 데이터 없음" }),
      };
    }

    // 배열 → Supabase 객체로 변환
    const record = {
      "표본번호": row[1] || "",
      "수장고":   row[2] || "",
      "수장위치": row[3] || "",
      "생약명":   row[4] || "",
      "국명":     row[5] || "",
      "학명":     row[6] || "",
      "수집날짜": row[7] || "",
      "수집장소": row[8] || "",
      "중요도":   row[9] || "",
      "속명":     row[10] || "",
      "과명":     row[11] || "",
      "gps":      row[12] || "",
      "공정서":   row[13] || "",
      "과제명":   row[14] || "",
    };

    // Supabase PATCH (관리번호 기준 업데이트)
    const encodedId = encodeURIComponent(id);
    const result = await httpsPatch(
      `${SUPABASE_URL}/rest/v1/specimens?관리번호=eq.${encodedId}`,
      {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      JSON.stringify(record)
    );

    if (result.status !== 200 && result.status !== 204) {
      throw new Error(`Supabase 오류 (${result.status}): ${result.body.substring(0, 200)}`);
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
