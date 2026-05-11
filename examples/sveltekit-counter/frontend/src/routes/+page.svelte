<script lang="ts">
  import { createTytheStores } from "@tythe/svelte";
  import { api } from "$lib/tythe/client";

  const stores = createTytheStores(api);

  const counter = stores.query("getCounter", undefined);
  const incr = stores.mutation("increment");

  let live = $state(0);
  stores.subscription(
    "streamCounter",
    undefined,
    (ev) => {
      live = ev.value;
    },
  );
</script>

<main style="font-family: system-ui, sans-serif; max-width: 480px; margin: 64px auto;">
  <h1>Tythe · SvelteKit counter</h1>

  <p>Current (query): {#if $counter.status === "success"}{$counter.data.value}{:else}…{/if}</p>
  <p>Live (subscription): {live}</p>

  <button
    onclick={async () => {
      try {
        await $incr.mutate({ data: { by: 1 } });
      } catch (e) {
        console.error(e);
      }
    }}
  >
    Increment
  </button>

  {#if $incr.status === "error" && $incr.error}
    <p style="color: crimson">
      {#if ($incr.error as any).kind === "OutOfRange"}
        Out of range: hit {($incr.error as any).value} of {($incr.error as any).max}
      {/if}
    </p>
  {/if}
</main>
