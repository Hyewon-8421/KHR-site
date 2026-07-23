const https = require("https");

const SUPABASE_URL = "https://rfyovtepspyseidktiea.supabase.co";
const SUPABASE_KEY = "sb_publishable_UU8vDCtULeR9XBb-wDgP0g_Ef7eDncE";

// Supabase(PostgREST)는 한 번의 요청에서 반환하는 행 수를 기본 1000건으로 제한합니다.
// (쿼리의 limit 값과 무관하게 서버(db-max-rows) 설정에 의해 강제됨)
// → Range 헤더로 페이지를 나눠 여러 번 요청해야 전체 데이터를 가져올 수 있습니다.
// 단, 순차(sequential) 요청은 데이터가 많을 경우 Netlify 함수 실행시간 제한(기본 10초)을
// 초과해 502가 발생할 수 있으므로, 첫 페이지로 전체 건수를 파악한 뒤 나머지는 병렬로 요청합니다.
const PAGE_SIZE = 1000;
const REQUEST_TIMEOUT_MS = 8000; // 개별 요청이 응답 없이 무한정 걸리는 것을 방지
const MAX_PAGES = 200; // 안전장치 (200,000건 이상은 비정상 상황으로 간주)

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
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`요청 타임아웃 (range ${rangeFrom}-${rangeTo})`));
    });
    req.end();
  });
}

function parseRows(body) {
  const rows = JSON.parse(body);
  if (!Array.isArray(rows)) {
    throw new Error("예상치 못한 응답: " + JSON.stringify(rows).substring(0, 200));
  }
  return rows;
}

exports.handler = async function(event, context) {
  try {
    const baseUrl = `${SUPABASE_URL}/rest/v1/specimens?select=관리번호,표본번호,수장고,수장위치,생약명,국명,학명,수집날짜,수집장소,중요도,속명,과명,gps,공정서,과제명&order=id.asc`;

    const baseHeaders = {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Accept": "application/json",
    };

    // 1) 첫 페이지: count=exact로 전체 건수까지 함께 파악
    const first = await httpsGetRange(
      baseUrl,
      { ...baseHeaders, "Prefer": "count=exact" },
      0,
      PAGE_SIZE - 1
    );

    if (first.status !== 200 && first.status !== 206) {
      return {
        statusCode: 502,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ ok: false, error: `Supabase 오류 (${first.status}): ${first.body.substring(0, 300)}` }),
      };
    }

    let firstRows;
    try {
      firstRows = parseRows(first.body);
    } catch (e) {
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ ok: false, error: "파싱 실패: " + e.message }),
      };
    }

    let total = firstRows.length; // count 헤더가 없을 경우를 대비한 기본값
    if (first.contentRange) {
      const match = /\/(\d+)$/.exec(first.contentRange);
      if (match) total = parseInt(match[1], 10);
    }

    let allRows = firstRows;

    // 2) 나머지 페이지가 있다면 병렬로 요청 (count=exact 불필요 → 더 빠름)
    if (firstRows.length === PAGE_SIZE && total > PAGE_SIZE) {
      const totalPages = Math.min(Math.ceil(total / PAGE_SIZE), MAX_PAGES);
      const pagePromises = [];
      for (let p = 1; p < totalPages; p++) {
        const from = p * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        pagePromises.push(httpsGetRange(baseUrl, baseHeaders, from, to));
      }

      const results = await Promise.all(pagePromises);
      for (const result of results) {
        if (result.status !== 200 && result.status !== 206) {
          return {
            statusCode: 502,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ ok: false, error: `Supabase 오류 (${result.status}): ${result.body.substring(0, 300)}` }),
          };
        }
        allRows = allRows.concat(parseRows(result.body));
      }
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
      body: JSON.stringify({ ok: true, data, total }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
