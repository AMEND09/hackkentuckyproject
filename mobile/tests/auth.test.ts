import { getAccess } from "../src/api/client";

test("secure store helpers exist", async () => {
  expect(typeof getAccess).toBe("function");
});
