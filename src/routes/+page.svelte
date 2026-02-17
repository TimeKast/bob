<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import InstanceCard from "$lib/InstanceCard.svelte";
  import Settings from "$lib/Settings.svelte";
  import {
    instances,
    settings,
    scanForInstances,
    refreshInstances,
    startAutoImplementation,
    stopAutoImplementation,
    stopUIPolling,
  } from "$lib/store";
  import type { Instance } from "$lib/types";

  let showSettings = $state(false);
  let scanning = $state(false);
  let polling = $state(false);

  // Extension installation state
  let extensionStatus = $state<
    "checking" | "installed" | "missing" | "installing" | "error"
  >("checking");
  let extensionError = $state("");

  onMount(async () => {
    // Check if extension is installed
    await checkExtension();

    handleScan();
    // Refresh instances every 10 seconds
    const interval = setInterval(refreshInstances, 10000);
    return () => {
      clearInterval(interval);
      stopUIPolling();
    };
  });

  async function checkExtension() {
    try {
      extensionStatus = "checking";
      const installed = await invoke<boolean>("check_extension_installed");
      extensionStatus = installed ? "installed" : "missing";

      // If CLI check fails but instances appear later, mark as installed
      if (extensionStatus === "missing") {
        setTimeout(() => {
          if ($instances.length > 0) {
            extensionStatus = "installed";
          }
        }, 5000);
      }
    } catch (e) {
      console.error("Failed to check extension:", e);
      extensionStatus = "missing";
    }
  }

  async function installExtension() {
    try {
      extensionStatus = "installing";
      extensionError = "";
      await invoke<boolean>("install_extension");
      extensionStatus = "installed";
    } catch (e) {
      extensionStatus = "error";
      extensionError = String(e);
    }
  }

  async function handleScan() {
    scanning = true;
    await scanForInstances();
    scanning = false;
  }

  function toggleInstance(id: string) {
    instances.update((list: Instance[]) =>
      list.map((inst: Instance) => {
        if (inst.id !== id) return inst;
        const newEnabled = !inst.enabled;
        // When re-enabling a blocked instance, clear all block state
        if (newEnabled && inst.isBlocked) {
          return {
            ...inst,
            enabled: true,
            isBlocked: false,
            blockReason: undefined,
            retryCount: 0,
            noAdvanceCount: 0,
            status: "idle" as const,
          };
        }
        return { ...inst, enabled: newEnabled };
      }),
    );
  }

  function togglePolling() {
    if (polling) {
      stopAutoImplementation();
      polling = false;
    } else {
      // Use pollIntervalSeconds from settings (convert to ms)
      startAutoImplementation($settings.pollIntervalSeconds * 1000);
      polling = true;
    }
  }
</script>

<main>
  <header>
    <div class="logo">
      <span class="icon">🦞</span>
      <h1>BOB Monitor</h1>
    </div>
    <div class="actions">
      <button
        class="btn-poll"
        class:active={polling}
        onclick={(e) => {
          togglePolling();
          e.currentTarget.blur();
        }}
      >
        {polling ? "⏸️ Stop" : "▶️ Auto"}
      </button>
      <button
        class="btn-scan"
        onclick={(e) => {
          handleScan();
          e.currentTarget.blur();
        }}
        disabled={scanning}
      >
        {scanning ? "🔄 Scanning..." : "🔍 Scan"}
      </button>
      <button
        class="btn-settings"
        onclick={(e) => {
          showSettings = !showSettings;
          e.currentTarget.blur();
        }}
      >
        ⚙️
      </button>
    </div>
  </header>

  {#if polling}
    <div class="polling-indicator">🔄 Auto-polling active (every 5s)</div>
  {/if}

  {#if showSettings}
    <Settings onClose={() => (showSettings = false)} />
  {/if}

  <section class="instances">
    {#if $instances.length === 0}
      <div class="empty-state">
        <p>🔍 No Antigravity instances detected</p>
        <p class="hint">Open VS Code with Antigravity and click Scan</p>
      </div>
    {:else}
      {#each $instances as instance (instance.id)}
        <InstanceCard {instance} onToggle={() => toggleInstance(instance.id)} />
      {/each}
    {/if}
  </section>

  <footer>
    <span class="status">
      {$instances.filter((i: Instance) => i.enabled).length} / {$instances.length}
      active
    </span>
    {#if polling}
      <span class="polling-status">🟢 Polling</span>
    {/if}
  </footer>
</main>

<style>
  :global(*) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :global(body) {
    font-family: "Segoe UI", system-ui, sans-serif;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    color: #eee;
    min-height: 100vh;
  }

  main {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    padding: 1rem;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    margin-bottom: 1rem;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .logo .icon {
    font-size: 1.5rem;
  }

  h1 {
    font-size: 1.25rem;
    font-weight: 600;
    background: linear-gradient(90deg, #00d9ff, #00ff88);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }

  button {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #eee;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-settings {
    padding: 0.5rem;
    aspect-ratio: 1;
  }

  .instances {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    overflow-y: auto;
    padding-bottom: 1rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 0.5rem;
    opacity: 0.6;
  }

  .empty-state p {
    font-size: 1rem;
  }

  .empty-state .hint {
    font-size: 0.8rem;
    opacity: 0.7;
  }

  footer {
    padding: 0.5rem 0;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    text-align: center;
  }

  .status {
    font-size: 0.8rem;
    opacity: 0.6;
  }

  .btn-poll {
    background: rgba(255, 255, 255, 0.1);
  }

  .btn-poll.active {
    background: linear-gradient(90deg, #00d9ff, #00ff88);
    color: #000;
    font-weight: 600;
  }

  .polling-indicator {
    background: rgba(0, 217, 255, 0.15);
    border: 1px solid rgba(0, 217, 255, 0.3);
    border-radius: 8px;
    padding: 0.5rem 1rem;
    text-align: center;
    font-size: 0.85rem;
    margin-bottom: 0.5rem;
    animation: pulse-glow 2s infinite;
  }

  @keyframes pulse-glow {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }

  .polling-status {
    margin-left: 1rem;
    font-size: 0.8rem;
  }
</style>
