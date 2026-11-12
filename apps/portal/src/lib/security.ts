export function isLoopback(host: string) {
  return ["127.0.0.1", "localhost", "[::1]"].includes(host);
}
import type { Audience } from "./audience";
/**
 * Lista explícita por público. Cooperativa e instituição recebem somente as
 * leituras deste incremento; nenhuma rota privada do produtor é encaminhada.
 */
export function allowedProxyPath(
  endpoint: string,
  method: string,
  audience: Audience = "producer",
) {
  if (audience === "cooperative")
    return method === "GET" && endpoint === "/cooperative-home";
  if (audience === "institution")
    return (
      method === "GET" &&
      (endpoint === "/institution-home" || endpoint === "/offers")
    );
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
