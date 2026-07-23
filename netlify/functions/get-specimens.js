const https = require("https");

const SUPABASE_URL = "https://rfyovtepspyseidktiea.supabase.co";
const SUPABASE_KEY = "sb_publishable_UU8vDCtULeR9XBb-wDgP0g_Ef7eDncE";

// Supabase(PostgREST)는 한 번의 요청에서 반환하는 행 수를 기본 1000건으로 제한합니다.
// (쿼리의 limit 값과 무관하게 서버(db-max-rows) 설정에 의해 강제됨)
// 따라서 Range 헤더로 페이지를 나눠 여러 번 요청한 뒤 결과를 합쳐야 전체 데이터를 가져올 수 있습니다.
const PAGE_SIZE = 1000;

function httpsGetRange(url, headers, rangeFrom, rangeTo) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: "GET",
      headers: {
        ...headers,
        "Range-Unit": "items",
        "Range": `${rangeFrom}-${rangeTo}`,
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve({
        status: res.statusCode,
        body: data,
        contentRange: res.headers["content-range"], // e.g. "0-999/2345"
      }));
    });
    req.on("error", reject);
    req.end();
  });
}

exports.handler = async function(event, context) {
  try {
    // GPS → gps (PostgreSQL 소문자 변환)
    const baseUrl = `${SUPABASE_URL}/rest/v1/specimens?select=관리번호,표본번호,수장고,수장위치,생약명,국명,학명,수집날짜,수집장소,중요도,속명,과명,gps,공정서,과제명&order=id.asc`;

    const headers = {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Accept": "application/json",
      // count=exact를 요청하면 Content-Range 응답 헤더로 전체 건수를 알 수 있어
      // 정확히 몇 페이지를 더 가져와야 하는지 판단할 수 있습니다.
      "Prefer": "count=exact",
    };

    let allRows = [];
    let offset = 0;
    let total = null;

    while (true) {
      const result = await httpsGetRange(baseUrl, headers, offset, offset + PAGE_SIZE - 1);

      if (result.status !== 200 && result.status !== 206) {
        return {
          statusCode: 500,
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ ok: false, error: `Supabase 오류 (${result.status}): ${result.body.substring(0, 200)}` }),
        };
      }

      let pageRows;
      try {
        pageRows = JSON.parse(result.body);
      } catch (e) {
        return {
          statusCode: 500,
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ ok: false, error: "파싱 실패: " + result.body.substring(0, 200) }),
        };
      }

      if (!Array.isArray(pageRows)) {
        return {
          statusCode: 500,
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ ok: false, error: "예상치 못한 응답: " + JSON.stringify(pageRows).substring(0, 200) }),
        };
      }

      allRows = allRows.concat(pageRows);

      // Content-Range: "0-999/2345" 형식에서 전체 건수(total) 파싱
      if (total === null && result.contentRange) {
        const match = /\/(\d+)$/.exec(result.contentRange);
        if (match) total = parseInt(match[1], 10);
      }

      offset += PAGE_SIZE;

      // 종료 조건: 이번 페이지가 PAGE_SIZE보다 작게 왔거나(더 이상 데이터 없음),
      // total을 알고 있고 이미 total만큼 다 가져왔으면 종료
      if (pageRows.length < PAGE_SIZE) break;
      if (total !== null && offset >= total) break;
    }

    const data = allRows.map(r => [
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
      r["gps"]      || "",
      r["공정서"]   || "",
      r["과제명"]   || "",
    ]);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ ok: true, data, total: total !== null ? total : data.length }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
