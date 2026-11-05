export function isLoopback(host: string) {
  return ["127.0.0.1", "localhost", "[::1]"].includes(host);
}
export function allowedProxyPath(endpoint: string, method: string) {
  const uuid =
    "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
  const allowed = new RegExp(
    "^/(catalog|producer-home|productions(?:/" +
      uuid +
      ")?|orders|offers(?:/" +
      uuid +
      "/publish)?|properties/" +
      uuid +
      "/weather|lots/" +
      uuid +
      "(?:/events)?)$",
    "i",
  );
  return (
    allowed.test(endpoint) &&
    ((method === "GET" && !endpoint.endsWith("/publish")) ||
      (method === "POST" &&
        (endpoint === "/productions" ||
          endpoint === "/offers" ||
          new RegExp("^/offers/" + uuid + "/publish$", "i").test(endpoint))))
  );
}
