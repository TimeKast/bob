<script lang="ts">
  import type { Instance, Settings } from "./types";
  import {
    instances,
    testInstance,
    detectUIState,
    clickAcceptButton,
    acceptDialog,
    writeToChat,
    settings,
  } from "./store";

  interface Props {
    instance: Instance;
    onToggle: () => void;
  }

  let { instance, onToggle }: Props = $props();
  let testResult = $state<string>("");
  let testing = $state(false);
  let showSettings = $state(false);
  let localIssuesPath = $state(instance.issuesPath || "");

  const statusColors: Record<string, string> = {
    idle: "#ffb800",
    working: "#00ff88",
    error: "#ff4757",
    complete: "#00d9ff",
    disabled: "#666",
    blocked: "#ff6b35",
  };

  const statusIcons: Record<string, string> = {
    idle: "🟡",
    working: "🟢",
    error: "🔴",
    complete: "✅",
    disabled: "⚪",
    blocked: "🚫",
  };

  function formatTime(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  }

  function saveIssuesPath() {
    const trimmed = localIssuesPath.trim();
    // Update instance in memory
    instances.update((list: Instance[]) =>
      list.map((i: Instance) =>
        i.id === instance.id ? { ...i, issuesPath: trimmed || undefined } : i,
      ),
    );
    // Persist to settings for survival across restarts
    settings.update((s: Settings) => ({
      ...s,
      projectOverrides: {
        ...s.projectOverrides,
        [instance.projectName]: { issuesPath: trimmed || undefined },
      },
    }));
  }

  async function handleDetectUI() {
    testing = true;
    testResult = "Detecting...";
    const result = await detectUIState(instance.windowHandle);
    if (result) {
      if (result.error) {
        testResult = `Error: ${result.error}`;
      } else {
        const states = [];
        // Show chat button color first
        if (result.chatButtonColor === "gray") states.push("🟢 Ready");
        else if (result.chatButtonColor === "red") states.push("🔴 Working");
        else if (!result.hasAcceptButton) states.push("⚪ Unknown");

        // Then show detected buttons
        if (result.hasAcceptButton) {
          states.push(result.isBottomButton ? "Accept all" : "Accept (dialog)");
        }
        if (result.hasRetryButton) states.push("❌ Retry");
        if (result.hasEnterButton) states.push("➡️ Enter");

        testResult =
          states.length > 0
            ? `Found: ${states.join(", ")}`
            : "No buttons found";
      }
    } else {
      testResult = "Detection failed";
    }
    testing = false;
  }

  async function handleDetectAndAct() {
    testing = true;
    testResult = "Detecting...";

    const result = await detectUIState(instance.windowHandle);

    if (result) {
      // STEP 1: Accept all (priority)
      if (result.hasAcceptButton && result.isBottomButton) {
        testResult = "Clicking Accept all...";
        const acceptResult = await clickAcceptButton(
          instance.windowHandle,
          result.acceptButtonX,
          result.acceptButtonY,
        );
        testResult = acceptResult ? "✅ Clicked Accept all" : "❌ Click failed";
      }
      // STEP 2: Gray button = chat ready
      else if (result.chatButtonColor === "gray") {
        if (result.hasRetryButton) {
          testResult = "❌ Found Retry - click manually";
        } else if (result.hasEnterButton) {
          testResult = "Sending prompt...";
          const prompt = instance.customPrompt || $settings.autoPrompt;
          const sendResult = await writeToChat(instance.windowHandle, prompt);
          testResult = sendResult ? "✅ Sent prompt" : "❌ Send failed";
        } else {
          testResult = "🟢 Ready but no action";
        }
      }
      // STEP 3: Red button = agent working
      else if (result.chatButtonColor === "red") {
        if (result.hasAcceptButton && !result.isBottomButton) {
          testResult = "Sending Alt+Enter...";
          const acceptResult = await acceptDialog(instance.windowHandle);
          testResult = acceptResult ? "✅ Accepted dialog" : "❌ Accept failed";
        } else {
          testResult = "🔴 Agent working...";
        }
      }
      // Unknown state
      else {
        testResult = `⚪ Unknown (${result.chatButtonColor})`;
      }
    } else {
      testResult = "Detection failed";
    }

    testing = false;
  }
</script>

<div
  class="card"
  class:disabled={!instance.enabled}
  class:error={instance.status === "error"}
>
  <div class="header">
    <div class="title">
      <span class="status-icon">{statusIcons[instance.status]}</span>
      <span class="name">{instance.projectName}</span>
      {#if instance.connectionMode === "silent"}
        <span class="silent-badge" title="Silent Mode — via companion extension"
          >🔇</span
        >
      {:else}
        <span class="legacy-badge" title="Legacy Mode — via PowerShell">🖥️</span
        >
      {/if}
    </div>
    <div class="header-actions">
      <button
        class="btn-instance-settings"
        title="Instance settings"
        onclick={() => (showSettings = !showSettings)}
      >
        ⚙️
      </button>
      <label class="toggle">
        <input type="checkbox" checked={instance.enabled} onchange={onToggle} />
        <span class="slider"></span>
      </label>
    </div>
  </div>

  <div class="content">
    <div class="progress-bar">
      <div
        class="progress-fill"
        style="width: {instance.totalIssues > 0
          ? (instance.currentIssue / instance.totalIssues) * 100
          : 0}%; background: {statusColors[instance.status]}"
      ></div>
    </div>

    <div class="stats">
      <span class="stat">
        📋 {instance.currentIssue}/{instance.totalIssues} issues
      </span>
      <span class="stat" class:retry={instance.retryCount > 0}>
        🔄 {instance.retryCount}/{instance.maxRetries} retries
      </span>
    </div>

    <div class="meta">
      <span class="path" title={instance.projectPath}>
        📁 {instance.projectPath.split(/[/\\]/).pop()}
      </span>
      <span class="time">
        ⏱️ {formatTime(instance.lastActivity)}
      </span>
    </div>

    {#if instance.customPrompt}
      <div class="custom-prompt">
        💬 {instance.customPrompt}
      </div>
    {/if}

    {#if instance.isBlocked}
      <div class="blocked-indicator">
        🚫 Bloqueado: {instance.blockReason || "Requiere atención manual"}
      </div>
    {:else if instance.blockReason}
      <div class="blocked-indicator warning">
        ⏳ {instance.blockReason}
      </div>
    {/if}

    {#if showSettings}
      <div class="instance-settings">
        <div class="field">
          <label for="issuesPath-{instance.id}">📂 Issues Path (override)</label
          >
          <div class="path-input-row">
            <input
              type="text"
              id="issuesPath-{instance.id}"
              bind:value={localIssuesPath}
              placeholder="Auto-detect from project"
              onblur={saveIssuesPath}
            />
          </div>
          <span class="hint">
            {#if instance.issuesPath}
              Usando: {instance.issuesPath}
            {:else}
              Auto-detectando desde {instance.projectPath}
            {/if}
          </span>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 1rem;
    transition: all 0.3s ease;
  }

  .card:hover {
    background: rgba(255, 255, 255, 0.08);
    transform: translateX(4px);
  }

  .card.disabled {
    opacity: 0.5;
  }

  .card.error {
    border-color: #ff4757;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      box-shadow: 0 0 0 0 rgba(255, 71, 87, 0.4);
    }
    50% {
      box-shadow: 0 0 0 8px rgba(255, 71, 87, 0);
    }
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .status-icon {
    font-size: 0.9rem;
  }

  .name {
    font-weight: 600;
    font-size: 1rem;
  }

  /* Toggle switch */
  .toggle {
    position: relative;
    width: 44px;
    height: 24px;
  }

  .toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #444;
    transition: 0.3s;
    border-radius: 24px;
  }

  .slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
  }

  input:checked + .slider {
    background: linear-gradient(90deg, #00d9ff, #00ff88);
  }

  input:checked + .slider:before {
    transform: translateX(20px);
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .progress-bar {
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    transition: width 0.5s ease;
  }

  .stats {
    display: flex;
    gap: 1rem;
    font-size: 0.8rem;
    opacity: 0.8;
  }

  .stat.retry {
    color: #ffb800;
  }

  .meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    opacity: 0.6;
  }

  .path {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .custom-prompt {
    font-size: 0.75rem;
    padding: 0.5rem;
    background: rgba(0, 217, 255, 0.1);
    border-radius: 6px;
    border-left: 2px solid #00d9ff;
    margin-top: 0.25rem;
  }

  .test-controls {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .btn-test {
    flex: 1;
    padding: 0.4rem 0.6rem;
    font-size: 0.75rem;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    color: #eee;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-test:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
  }

  .btn-test:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-send {
    background: rgba(0, 217, 255, 0.2);
    border-color: rgba(0, 217, 255, 0.4);
  }

  .btn-send:hover:not(:disabled) {
    background: rgba(0, 217, 255, 0.3);
  }

  .test-result {
    font-size: 0.7rem;
    padding: 0.4rem;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    color: #aaa;
    margin-top: 0.25rem;
  }

  .blocked-indicator {
    background: rgba(255, 107, 53, 0.2);
    border: 1px solid rgba(255, 107, 53, 0.4);
    border-radius: 6px;
    padding: 0.5rem;
    font-size: 0.8rem;
    color: #ff6b35;
    margin-top: 0.5rem;
  }

  .blocked-indicator.warning {
    background: rgba(255, 193, 7, 0.15);
    border-color: rgba(255, 193, 7, 0.3);
    color: #ffc107;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-instance-settings {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 0.8rem;
    padding: 0.2rem;
    opacity: 0.5;
    transition: opacity 0.2s;
  }

  .btn-instance-settings:hover {
    opacity: 1;
  }

  .instance-settings {
    margin-top: 0.5rem;
    padding: 0.75rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .instance-settings .field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .instance-settings label {
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .instance-settings input {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 0.5rem;
    color: #fff;
    font-size: 0.8rem;
    width: 100%;
  }

  .instance-settings input:focus {
    outline: none;
    border-color: #00d9ff;
  }

  .instance-settings .hint {
    font-size: 0.7rem;
    opacity: 0.4;
    font-style: italic;
  }

  .path-input-row {
    display: flex;
    gap: 0.5rem;
  }

  .silent-badge {
    font-size: 0.7rem;
    background: rgba(0, 217, 255, 0.15);
    border: 1px solid rgba(0, 217, 255, 0.3);
    border-radius: 4px;
    padding: 0.1rem 0.3rem;
    cursor: help;
  }

  .legacy-badge {
    font-size: 0.7rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    padding: 0.1rem 0.3rem;
    opacity: 0.5;
    cursor: help;
  }
</style>
