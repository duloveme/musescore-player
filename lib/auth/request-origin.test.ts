import assert from "node:assert/strict";
import test from "node:test";
import { absoluteOrigin } from "./request-origin.ts";

test("prefers a valid candidate origin from the form", () => {
  const headers = new Headers({ host: "localhost:3000" });
  assert.equal(absoluteOrigin("https://museplayer.snipkit.org", headers), "https://museplayer.snipkit.org");
});

test("falls back to forwarded host when the candidate is empty", () => {
  const headers = new Headers({
    host: "localhost:3000",
    "x-forwarded-host": "museplayer.snipkit.org",
    "x-forwarded-proto": "https",
  });
  assert.equal(absoluteOrigin("", headers), "https://museplayer.snipkit.org");
});

test("rejects relative redirect candidates", () => {
  const headers = new Headers({ host: "example.com", "x-forwarded-proto": "https" });
  assert.equal(absoluteOrigin("/auth/callback", headers), "https://example.com");
});
