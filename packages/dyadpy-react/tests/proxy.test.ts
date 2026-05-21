import { describe, expect, it } from "vitest";
import { computeNamespace, methodVerb } from "../src/proxy.js";

describe("computeNamespace", () => {
  it("derives list/create from /resource", () => {
    expect(computeNamespace({ method: "GET", path: "/customers", name: "listCustomers" })).toEqual({
      segments: ["customers"],
      verb: "list",
      operationName: "listCustomers",
    });

    expect(
      computeNamespace({ method: "POST", path: "/customers", name: "createCustomer" }),
    ).toEqual({
      segments: ["customers"],
      verb: "create",
      operationName: "createCustomer",
    });
  });

  it("derives byId/update/delete from /resource/{id}", () => {
    expect(
      computeNamespace({ method: "GET", path: "/customers/{id}", name: "getCustomer" }),
    ).toMatchObject({ segments: ["customers"], verb: "byId" });

    expect(
      computeNamespace({
        method: "PATCH",
        path: "/customers/{id}",
        name: "updateCustomer",
      }),
    ).toMatchObject({ segments: ["customers"], verb: "update" });

    expect(
      computeNamespace({
        method: "DELETE",
        path: "/customers/{id}",
        name: "deleteCustomer",
      }),
    ).toMatchObject({ segments: ["customers"], verb: "delete" });
  });

  it("nests sub-resources under their parent", () => {
    expect(
      computeNamespace({
        method: "GET",
        path: "/customers/{id}/holds",
        name: "listHolds",
      }),
    ).toMatchObject({ segments: ["customers", "holds"], verb: "list" });

    // POST on a sub-resource: handler-named action verb wins over the
    // generic ``create``, so the call site reads as
    // ``api.customers.holds.place.useMutation()``.
    expect(
      computeNamespace({
        method: "POST",
        path: "/customers/{id}/holds",
        name: "placeHold",
      }),
    ).toMatchObject({ segments: ["customers", "holds"], verb: "place" });
  });

  it("uses the handler name for action verbs on a sub-path", () => {
    // POST /customers/{id}/holds/{holdId} with handler `release_hold`
    const entry = computeNamespace({
      method: "POST",
      path: "/customers/{id}/holds/{holdId}",
      name: "releaseHold",
    });
    expect(entry.segments).toEqual(["customers", "holds"]);
    // Trailing {holdId} param -> method-derived verb null on POST → falls back
    // to handler-name with resource suffix stripped ("hold" matches "holds").
    expect(entry.verb).toBe("release");
  });

  it("handles $-prefixed file-route param style", () => {
    expect(
      computeNamespace({
        method: "POST",
        path: "/cases/$slug/decide",
        name: "decideCase",
      }),
    ).toMatchObject({ segments: ["cases", "decide"] });
  });
});

describe("methodVerb", () => {
  it("maps method+terminal-param to a verb", () => {
    expect(methodVerb("GET", false)).toBe("list");
    expect(methodVerb("GET", true)).toBe("byId");
    expect(methodVerb("POST", false)).toBe("create");
    expect(methodVerb("PATCH", true)).toBe("update");
    expect(methodVerb("PUT", true)).toBe("update");
    expect(methodVerb("DELETE", true)).toBe("delete");
  });
});
