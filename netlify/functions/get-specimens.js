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
    // Supabase에서 specimens 테이블 전체 조회 (최대 100만 건)
    const url = `${SUPABASE_URL}/rest/v1/specimens?select=관리번호,표본번호,수장고,수장위치,생약명,국명,학명,수집날짜,수집장소,중요도,속명,과명,GPS,공정서,과제명&limit=100000&order=id.asc`;
    const result = await httpsGet(url, {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
    });

    const rows = JSON.parse(result.body);

    // index.html의 specimen_compact 형식 [관리번호, 표본번호, ...] 배열로 변환
    const data = rows.map(r => [
      r["관리번호"] || "",
      r["표본번호"] || "",
      r["수장고"] || "",
      r["수장위치"] || "",
      r["생약명"] || "",
      r["국명"] || "",
      r["학명"] || "",
      r["수집날짜"] || "",
      r["수집장소"] || "",
      r["중요도"] || "",
      r["속명"] || "",
      r["과명"] || "",
      r["GPS"] || "",
      r["공정서"] || "",
      r["과제명"] || "",
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
