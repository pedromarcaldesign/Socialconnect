// Imita POST /v1/messages com saídas estruturadas, para testar a IA sem custos.
// GET /__log devolve os pedidos recebidos.
import http from "node:http";

const port = Number(process.env.MOCK_ANTHROPIC_PORT ?? 4020);
const log = [];

function answer(body) {
  const props = Object.keys(body.output_config?.format?.schema?.properties ?? {});
  const prompt = JSON.stringify(body.messages);
  if (props.includes("options")) {
    return { options: [
      { text: "Fim de tarde à beira da piscina, com o sol a descer devagar. Reserva já o teu lugar ao sol ☀️", hashtags: ["#cascais", "verao"] },
      { text: "E se a próxima escapadinha começasse aqui?", hashtags: ["#escapadinha"] },
      { text: "Mergulhos, livros e nada para fazer.", hashtags: ["#ferias"] },
    ], tip: "Publica ao fim da tarde." };
  }
  if (props.includes("mood")) return { description: "Piscina exterior com um grande sol amarelo.", tags: ["Piscina", "Sol"], mood: "relaxante", setting: "piscina", subjects: ["piscina"], suggestions: ["Dia de piscina"] };
  if (props.includes("assetId")) return { assetId: (prompt.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/) ?? [null])[0] };
  if (props.includes("keywords")) return { description: "Hotel junto ao mar.", location: "Cascais", amenities: ["Piscina"], tone: "caloroso", audience: "casais", keywords: ["mar"] };
  if (props.includes("text")) return { text: "Texto reescrito pela IA." };
  return {};
}

http.createServer(async (req, res) => {
  if (req.url === "/__log") { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify(log)); }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
  log.push({ path: req.url, beta: req.headers["anthropic-beta"], model: body.model, fallbacks: body.fallbacks, effort: body.output_config?.effort, format: body.output_config?.format?.type, hasImage: JSON.stringify(body.messages).includes('"type":"image"') });
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({
    id: "msg_test", type: "message", role: "assistant", model: body.model, stop_reason: "end_turn", stop_sequence: null,
    content: [{ type: "text", text: JSON.stringify(answer(body)) }],
    usage: { input_tokens: 100, output_tokens: 50 },
  }));
}).listen(port, () => console.log(`mock anthropic on :${port}`));
