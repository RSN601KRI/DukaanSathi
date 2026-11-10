<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the home page public with isolated browser demo data; authenticated shop reads and writes use user-scoped database RPCs, so private records never fall back to demo data.
- AuthProvider owns the single identity-transition subscription; account controls consume it to avoid stale sign-in states.
- All live business writes go through shop_operation with a stable request UUID and configured price, so retries are idempotent and inventory updates are atomic.
