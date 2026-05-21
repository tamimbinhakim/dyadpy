import { describe, expect, it } from "vitest";
import { buildNamespaceTree, computeNamespace } from "../src/proxy.js";

describe("computeNamespace", () => {
  it("uses generated namespace metadata directly", () => {
    expect(
      computeNamespace({
        method: "GET",
        path: "/customers/{id}",
        name: "getCustomer",
        segments: ["customers"],
        verb: "byId",
        params: [{}],
      }),
    ).toEqual({
      segments: ["customers"],
      verb: "byId",
      operationName: "getCustomer",
      hasArgs: true,
    });
  });
});

describe("buildNamespaceTree", () => {
  it("builds nested namespaces from generated descriptors", () => {
    const tree = buildNamespaceTree([
      {
        method: "GET",
        path: "/customers",
        name: "listCustomers",
        segments: ["customers"],
        verb: "list",
      },
      {
        method: "POST",
        path: "/customers/{id}/holds",
        name: "placeHold",
        segments: ["customers", "holds"],
        verb: "place",
        params: [{}],
      },
    ]);

    const customers = tree.children.get("customers");
    expect(customers?.leaves.get("list")?.operationName).toBe("listCustomers");
    expect(customers?.children.get("holds")?.leaves.get("place")?.hasArgs).toBe(true);
  });

  it("rejects duplicate generated namespace leaves", () => {
    expect(() =>
      buildNamespaceTree([
        {
          method: "GET",
          path: "/customers",
          name: "listCustomers",
          segments: ["customers"],
          verb: "list",
        },
        {
          method: "GET",
          path: "/customers",
          name: "allCustomers",
          segments: ["customers"],
          verb: "list",
        },
      ]),
    ).toThrow(/duplicate generated namespace leaf customers\.list/);
  });
});
