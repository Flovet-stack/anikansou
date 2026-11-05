import { expect, it } from "vitest";

import { serializeJsonLd } from "./json-ld";

it("escapes angle brackets so stored text cannot close the script tag", () => {
  const output = serializeJsonLd({
    name: "</script><script>alert(1)</script>",
  });

  expect(output).not.toContain("<");
  expect(JSON.parse(output)).toEqual({
    name: "</script><script>alert(1)</script>",
  });
});
