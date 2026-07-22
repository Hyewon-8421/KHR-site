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
    const url = `${SUPABASE_URL}/rest/v1/specimens?select=관리번호,표본번호,수장고,수장위치,생약명,국명,학명,수집날짜,수집장소,중요도,속명,과명,GPS,공정서,과제명&limit=100000&order=id.asc`;
    const result = await httpsGet(url, {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Accept": "application/json",
    });

    // 응답 파싱 및 타입 확인
    let rows;
    try {
      rows = JSON.parse(result.body);
    } catch(e) {
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ ok: false, error: "파싱 실패: " + result.body.substring(0, 200) }),
      };
    }

    // 배열이 아닌 경우 처리
    if (!Array.isArray(rows)) {
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ ok: false, error: "예상치 못한 응답: " + JSON.stringify(rows).substring(0, 200) }),
      };
    }

    // Supabase 객체 배열 → 앱 형식 배열로 변환
    const data = rows.map(r => [
      r["관리번호"] || "",
      r["표본번호"] || "",
      r["수장고"]   || "",
      r["수장위치"] || "",
      r["생약명"]   || "",
      r["국명"]     || "",
      r["학명"]     || "",
      r["수집날짜"] || "",
      r["수집장소"] || "",
      r["중요도"]   || "",
      r["속명"]     || "",
      r["과명"]     || "",
      r["GPS"]      || "",
      r["공정서"]   || "",
      r["과제명"]   || "",
    ]);

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
