import test from "node:test";
import assert from "node:assert/strict";
import { allowedProxyPath, isLoopback } from "../src/lib/security";
test("proxy restringe destinos e operações do incremento", () => {
  assert.equal(allowedProxyPath("/catalog", "GET"), true);
  assert.equal(allowedProxyPath("/productions", "POST"), true);
  assert.equal(allowedProxyPath("/orders", "POST"), false);
  assert.equal(allowedProxyPath("/productions", "DELETE"), false);
  assert.equal(allowedProxyPath("/../admin", "GET"), false);
  assert.equal(allowedProxyPath("https://example.com", "GET"), false);
  assert.equal(allowedProxyPath("/productions/123", "GET"), false);
});
test("ambiente demonstrativo aceita apenas loopback", () => {
  for (const host of ["127.0.0.1", "localhost", "[::1]"])
    assert.equal(isLoopback(host), true);
  for (const host of [
    "0.0.0.0",
    "example.com",
    "localhost.example.com",
    "192.168.0.1",
  ])
    assert.equal(isLoopback(host), false);
});
test("proxy libera somente GET do indicador de impacto", () => {
  const path = "/properties/10000000-0000-4000-8000-000000000001/excess-impact";
  assert.equal(allowedProxyPath(path, "GET"), true);
  for (const method of ["POST", "PUT", "DELETE", "PATCH"])
    assert.equal(allowedProxyPath(path, method), false);
  assert.equal(allowedProxyPath("/properties/abc/excess-impact", "GET"), false);
  assert.equal(allowedProxyPath(path + "/x", "GET"), false);
});
