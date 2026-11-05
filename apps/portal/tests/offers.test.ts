import test from "node:test";
import assert from "node:assert/strict";
import { allowedProxyPath } from "../src/lib/security";
test("proxy permite somente criação e publicação das ofertas", () => {
  const id = "123e4567-e89b-42d3-a456-426614174000";
  assert.equal(allowedProxyPath("/offers", "POST"), true);
  assert.equal(allowedProxyPath("/offers/" + id + "/publish", "POST"), true);
  assert.equal(allowedProxyPath("/offers/" + id + "/edit", "POST"), false);
  assert.equal(allowedProxyPath("/offers/not-an-id/publish", "POST"), false);
  assert.equal(allowedProxyPath("/offers", "DELETE"), false);
});
