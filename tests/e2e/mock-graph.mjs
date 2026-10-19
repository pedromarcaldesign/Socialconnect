// Servidor que imita os endpoints da Graph API usados pela app, para testes.
// Uso: node tests/e2e/mock-graph.mjs  (porta MOCK_GRAPH_PORT, por omissão 4010)
// GET /__log devolve os pedidos recebidos; POST /__fail?target=instagram|facebook&code=190 força erros.
import http from "node:http";

const port = Number(process.env.MOCK_GRAPH_PORT ?? 4010);
const log = [];
let fail = null; // { target, code }
let seq = 1000;
const id = () => String(seq++);

const PAGES = [
  { id: "p1", name: "Hotel Atlântico", access_token: "page-token-1", picture: { data: { url: "" } }, instagram_business_account: { id: "ig1", username: "hotelatlantico", name: "Hotel Atlântico", profile_picture_url: "" } },
  { id: "p2", name: "Quinta do Vale", access_token: "page-token-2", picture: { data: { url: "" } } },
];

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return new URLSearchParams(Buffer.concat(chunks).toString());
}

async function checkImage(url) {
  // A Meta descarrega a imagem: confirmar que o URL assinado funciona e é JPEG.
  const r = await fetch(url);
  const type = r.headers.get("content-type");
  if (!r.ok || type !== "image/jpeg") throw new Error(`imagem inacessível (${r.status} ${type})`);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (url.pathname === "/__log") return send(res, 200, log);
  if (url.pathname === "/__reset") { log.length = 0; fail = null; return send(res, 200, { ok: true }); }
  if (url.pathname === "/__fail") { fail = { target: url.searchParams.get("target"), code: Number(url.searchParams.get("code") ?? 190) }; return send(res, 200, fail); }

  const parts = url.pathname.split("/").filter(Boolean).slice(1); // tira a versão
  const params = req.method === "POST" ? await readBody(req) : url.searchParams;
  const entry = { method: req.method, path: parts.join("/"), params: Object.fromEntries([...params].filter(([k]) => k !== "access_token" && k !== "appsecret_proof")), token: params.get("access_token") };
  log.push(entry);
  if (!entry.token) return send(res, 400, { error: { message: "missing token", code: 100 } });

  const [node, edge] = parts;
  const isIg = node.startsWith("ig");
  if (fail && ((fail.target === "instagram" && isIg) || (fail.target === "facebook" && node.startsWith("p"))) && req.method === "POST") {
    return send(res, 400, { error: { message: fail.code === 190 ? "Error validating access token" : "Simulated failure", code: fail.code } });
  }
  try {
    if (req.method === "GET" && node === "me" && edge === "accounts") return send(res, 200, { data: PAGES });
    if (req.method === "POST" && edge === "media") {
      if (params.get("image_url")) await checkImage(params.get("image_url"));
      return send(res, 200, { id: `c${id()}` });
    }
    if (req.method === "POST" && edge === "media_publish") return send(res, 200, { id: `m${id()}` });
    if (req.method === "POST" && edge === "photos") {
      await checkImage(params.get("url"));
      const pid = id();
      return send(res, 200, params.get("published") === "false" ? { id: `ph${pid}` } : { id: `ph${pid}`, post_id: `${node}_${pid}` });
    }
    if (req.method === "POST" && edge === "feed") return send(res, 200, { id: `${node}_${id()}` });
    if (req.method === "POST" && edge === "comments") return send(res, 200, { id: `cm${id()}` });
    if (req.method === "GET" && !edge) {
      const fields = url.searchParams.get("fields") ?? "";
      if (fields.includes("status_code")) return send(res, 200, { status_code: "FINISHED", id: node });
      if (fields.includes("permalink_url")) return send(res, 200, { permalink_url: `https://facebook.test/${node}`, id: node });
      if (fields.includes("permalink")) return send(res, 200, { permalink: `https://instagram.test/p/${node}`, id: node });
      return send(res, 200, { id: node });
    }
    return send(res, 404, { error: { message: `unsupported ${req.method} ${url.pathname}`, code: 100 } });
  } catch (e) {
    return send(res, 400, { error: { message: String(e.message ?? e), code: 9004 } });
  }
}).listen(port, () => console.log(`mock graph on :${port}`));
