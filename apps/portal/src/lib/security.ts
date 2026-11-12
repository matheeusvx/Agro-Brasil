export function isLoopback(host: string) {
  return ["127.0.0.1", "localhost", "[::1]"].includes(host);
}
import type { Audience } from "./audience";
/**
 * Lista explícita por público. Cooperativa e instituição recebem somente as
 * leituras deste incremento; nenhuma rota privada do produtor é encaminhada.
 */
const UUID =
  "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const writes: Record<"cooperative" | "institution", RegExp> = {
  // Cooperativa designada: somente registrar retirada.
  cooperative: new RegExp("^/shipments/" + UUID + "/pickup$", "i"),
  // Instituição: solicitar, cancelar a própria solicitação e confirmar recebimento.
  institution: new RegExp(
    "^/(orders|orders/" + UUID + "/cancel|shipments/" + UUID + "/receipts)$",
    "i",
  ),
};
export function allowedProxyPath(
  endpoint: string,
  method: string,
  audience: Audience = "producer",
  role = "ADMIN",
) {
  // LEITOR nunca escreve, em nenhum público (a API também recusa).
  if (method !== "GET" && role === "LEITOR") return false;
  if (audience === "cooperative" || audience === "institution") {
    if (method === "POST") return writes[audience].test(endpoint);
    return (
      method === "GET" &&
      ((audience === "cooperative"
        ? endpoint === "/cooperative-home"
        : endpoint === "/institution-home" || endpoint === "/offers") ||
        // Rastreabilidade: a API devolve só eventos dos pedidos da organização.
        new RegExp("^/lots/" + UUID + "/events$", "i").test(endpoint))
    );
  }
  const uuid =
    "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
  const allowed = new RegExp(
    "^/(catalog|cooperatives|producer-home|productions(?:/" +
      uuid +
      ")?|orders(?:/" +
      uuid +
      "/(?:accept|cancel))?|shipments/" +
      uuid +
      "/pickup|offers(?:/" +
      uuid +
      "/publish)?|properties/" +
      uuid +
      "/(?:weather|farm-layout|farm-overview|excess-impact)|lots/" +
      uuid +
      "(?:/events)?)$",
    "i",
  );
  if (method === "PUT")
    return new RegExp("^/properties/" + uuid + "/farm-layout$", "i").test(
      endpoint,
    );
  return (
    allowed.test(endpoint) &&
    ((method === "GET" && !/(publish|accept|cancel|pickup)$/.test(endpoint)) ||
      (method === "POST" &&
        (endpoint === "/productions" ||
          endpoint === "/offers" ||
          new RegExp(
            "^/(orders/" +
              uuid +
              "/(accept|cancel)|shipments/" +
              uuid +
              "/pickup)$",
            "i",
          ).test(endpoint) ||
          new RegExp("^/offers/" + uuid + "/publish$", "i").test(endpoint))))
  );
}
/** Cooperativa e instituição só enviam paginação; demais parâmetros são recusados. */
export function allowedProxyQuery(search: string, audience: Audience) {
  if (audience === "producer") return true;
  const params = new URLSearchParams(search);
  for (const [key, value] of params)
    if (!["limit", "offset"].includes(key) || !/^\d{1,6}$/.test(value))
      return false;
  return new Set(params.keys()).size === [...params.keys()].length;
}
