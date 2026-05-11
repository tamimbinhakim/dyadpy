# Auth recipes

Tythe doesn't ship auth itself — that's intentional. Auth is a deployment
decision (NextAuth vs Clerk vs Auth0 vs custom JWT vs session cookies),
and the right answer depends on where your frontend lives and what your
team already runs. What Tythe ships is the primitive that makes auth
trivial to wire: **a `Depends(...)` resolver that takes a `Request` (or
header / cookie) and returns whoever you want on `ctx.user`**.

This page is a cookbook. Pick the recipe that matches your auth provider
and drop the resolver into your `Depends(...)` chain.

## 1. Bearer JWT (Clerk, Auth0, Supabase, custom)

```python
import jwt
from dataclasses import dataclass
from typing import Annotated

from tythe import App, Depends
from tythe.params import Header

app = App()

@dataclass
class User:
    id: str
    email: str

@dataclass
class Forbidden(Exception):
    reason: str

def current_user(
    authorization: Annotated[str, Header()] = "",
) -> User:
    if not authorization.startswith("Bearer "):
        raise Forbidden(reason="missing bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        claims = jwt.decode(token, key="...", algorithms=["RS256"])
    except jwt.PyJWTError as exc:
        raise Forbidden(reason="invalid token") from exc
    return User(id=claims["sub"], email=claims["email"])

@app.get("/me")
async def me(me: User = Depends(current_user)) -> User:
    return me
```

`@raises(Forbidden)` on the handler makes the error a typed discriminated
union on the TS side; the client sees `{ ok: false, error: { kind:
"Forbidden", reason: ... } }`.

## 2. Session cookies (Lucia, Iron Session, Django-style)

```python
def current_user(session: Annotated[str, Cookie()] = "") -> User:
    if not session:
        raise Forbidden(reason="no session cookie")
    record = sessions.get(session)
    if record is None:
        raise Forbidden(reason="expired session")
    return record.user
```

## 3. NextAuth via JWT

NextAuth signs its session into a cookie; Tythe reads it the same way
you'd read any cookie. The token format is documented at
[NextAuth's JWT docs](https://next-auth.js.org/configuration/options#jwt).

```python
from typing import Annotated

from tythe.params import Cookie

def current_user(
    next_auth_session_token: Annotated[str, Cookie("__Secure-next-auth.session-token")] = "",
) -> User:
    if not next_auth_session_token:
        raise Forbidden(reason="not signed in")
    return _decode_nextauth_jwt(next_auth_session_token)
```

## 4. Optional auth (anonymous fallback)

Make the dependency return `User | None` and don't raise on missing
credentials:

```python
def optional_user(authorization: Annotated[str, Header()] = "") -> User | None:
    if not authorization.startswith("Bearer "):
        return None
    return _decode(authorization.removeprefix("Bearer "))
```

## What Tythe doesn't do

- **Issue tokens.** That's your auth provider's job (Clerk, Auth0, your
  custom issuer).
- **Rotate keys / hit JWKS.** Use your auth provider's SDK or `pyjwt[jwks]`.
- **Manage sessions.** Use Lucia, Django, Iron Session, etc.

Tythe's contribution is making the resolver type-safe and reusable across
every handler. Once `current_user` works, `Depends(current_user)` plugs
into any route in two characters.
