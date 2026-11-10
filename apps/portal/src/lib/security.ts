export function isLoopback(host: string) {
  return ["127.0.0.1", "localhost", "[::1]"].includes(host);
}
export function allowedProxyPath(endpoint: string, method: string) {
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
      "/(?:weather|farm-layout|farm-overview)|lots/" +
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
