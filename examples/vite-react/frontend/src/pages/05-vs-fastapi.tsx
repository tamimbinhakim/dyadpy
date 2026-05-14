import { useState } from "react";
import { api } from "../lib/dyadpy/client";

const AUTH = { authorization: "Bearer 1" };

// The same request, two ways. The Dyadpy button on the right is live against
// the running server; the FastAPI column shows what you'd be writing today
// with `fastapi` + `openapi-typescript` (or @hey-api/openapi-ts, Orval, Kubb —
// they all share the same shape of pain).

const FASTAPI_CODE = `// fastapi-server side:
//   class IssueNotFound(BaseModel): issue_id: int
//   class Forbidden(BaseModel): reason: str
//   @router.get("/issues/{issue_id}", responses={
//       404: {"model": IssueNotFound},
//       403: {"model": Forbidden},
//   })
//   async def get_issue(issue_id: int) -> Issue: ...

// after openapi-typescript codegen:
import createClient from "openapi-fetch";
import type { paths } from "./generated/schema";   // 6 MB file

const client = createClient<paths>({ baseUrl: "/" });

async function load(issueId: number) {
  const { data, error, response } = await client.GET(
    "/issues/{issue_id}",                          // path string, not method
    { params: { path: { issue_id: issueId } },     // snake_case here…
      headers: { authorization: "Bearer 1" } },
  );

  if (data) return data.title;                     // data: Issue | undefined
                                                   //       ^ optional even on 200

  // \`error\` is { detail: any } — the typed union from \`responses\`
  // got flattened into \`any\` somewhere in the openapi codegen.
  // No discriminator on \`kind\`, no narrowing. We're back to:
  if (response.status === 404) {
    const err = error as { issue_id: number };     // hand-typed
    return \`not found id=\${err.issue_id}\`;       // typo here = silent
  }
  if (response.status === 403) {
    const err = error as { reason: string };       // hand-typed again
    return \`forbidden: \${err.reason}\`;
  }
  return "unknown error";                          // ← no exhaustiveness check
}`;

const DYADPY_CODE = `// dyadpy-server side:
//   @dataclass
//   class IssueNotFound(Exception): issue_id: int
//   @dataclass
//   class Forbidden(Exception): reason: str
//   @app.get("/issues/{issue_id}")
//   @raises(IssueNotFound, Forbidden)
//   async def get_issue(issue_id: int) -> Issue: ...

// after \`dyadpy dev\`:
import { api } from "@/lib/dyadpy/client";          // 4 KB, one file

async function load(issueId: number) {
  const result = await api.getIssue(               // method, not path string
    { issueId },                                   // camelCase, generated
    { headers: { authorization: "Bearer 1" } },
  );

  if (result.ok) return result.data.title;         // result.data: Issue
                                                   //              ^ narrowed

  switch (result.error.kind) {                     // discriminated union
    case "IssueNotFound":
      return \`not found id=\${result.error.issueId}\`;  // narrowed: { kind, issueId }
    case "Forbidden":
      return \`forbidden: \${result.error.reason}\`;     // narrowed: { kind, reason }
  }
  // ↑ remove a \`case\` and TypeScript fails the build.
  //   add a variant on the server and TypeScript fails the build.
}`;

export function VsFastapi() {
  const [out, setOut] = useState("Click 'run live' to call the Dyadpy path.");

  async function go() {
    const result = await api.getIssue({ issueId: 999 }, { headers: AUTH });
    if (result.ok) {
      setOut(`✓ ${result.data.title}`);
      return;
    }
    switch (result.error.kind) {
      case "IssueNotFound": {
        setOut(`× IssueNotFound — id=${result.error.issueId}`);
        return;
      }
      case "Forbidden": {
        setOut(`× Forbidden — ${result.error.reason}`);
        return;
      }
    }
  }

  return (
    <section>
      <h2>vs FastAPI + openapi-typescript</h2>
      <p style={{ color: "#666" }}>
        Same handler, same request, same typed errors on the wire. What changes is what TypeScript
        can prove for you at the call site.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginTop: 16,
        }}
      >
        <Column
          title="FastAPI + openapi-typescript"
          tone="#c0392b"
          summary={[
            "✗  Method named by path-string, not call.",
            "✗  Args are snake_case — same Python wire, but Codable.",
            "✗  data is Issue | undefined on a 2xx response.",
            "✗  Typed error union flattens to any — narrow by HTTP status, cast by hand.",
            "✗  No exhaustiveness over server's @raises set.",
          ]}
          code={FASTAPI_CODE}
        />
        <Column
          title="Dyadpy"
          tone="#2a8049"
          summary={[
            "✓  Method named like a function: api.getIssue(...).",
            "✓  Args are camelCase, wire stays snake_case — translated for you.",
            "✓  result.data is Issue once result.ok narrows the union.",
            "✓  result.error.kind is the discriminator — switch narrows each branch.",
            "✓  Add or remove a variant on the server → build break on every regen.",
          ]}
          code={DYADPY_CODE}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}>
        <button onClick={go}>run live (Dyadpy path)</button>
        <span style={{ color: "#888", fontSize: 13 }}>
          Calls <code>api.getIssue(&#123; issueId: 999 &#125;)</code> against this example's server.
        </span>
      </div>
      <pre style={{ background: "#f5f5f5", padding: 12, marginTop: 12 }}>{out}</pre>

      <p style={{ color: "#888", fontSize: 12, marginTop: 24 }}>
        Other generators (@hey-api/openapi-ts, Orval, Kubb) produce variations on the same shape.
        Dyadpy's trick isn't the codegen template — it's that the Python signature is the IR. No DTO
        file, no OpenAPI round-trip, no name mangling.
      </p>
    </section>
  );
}

function Column(props: { title: string; tone: string; summary: string[]; code: string }) {
  return (
    <div
      style={{
        border: `1px solid ${props.tone}33`,
        borderRadius: 8,
        background: `${props.tone}06`,
        padding: 12,
      }}
    >
      <h3 style={{ marginTop: 0, color: props.tone }}>{props.title}</h3>
      <ul style={{ paddingLeft: 18, marginTop: 0, color: "#333" }}>
        {props.summary.map((line) => (
          <li key={line} style={{ fontSize: 13, lineHeight: 1.55 }}>
            {line}
          </li>
        ))}
      </ul>
      <pre
        style={{
          background: "#fff",
          padding: 10,
          marginTop: 8,
          fontSize: 11.5,
          lineHeight: 1.5,
          overflowX: "auto",
          border: "1px solid #eee",
          borderRadius: 4,
        }}
      >
        {props.code}
      </pre>
    </div>
  );
}
