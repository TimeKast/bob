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
    updateInstanceBacklogs,
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
  let localGithubRepo = $state(instance.githubRepo || "");

  // Local state for prompts
  let tempSettings = $state({
    customPrompt: instance.customPrompt || "",
    customPromptDev: instance.customPromptDev || "",
    customPromptSupport: instance.customPromptSupport || "",
  });

  $effect(() => {
    tempSettings.customPrompt = instance.customPrompt || "";
    tempSettings.customPromptDev = instance.customPromptDev || "";
    tempSettings.customPromptSupport = instance.customPromptSupport || "";
  });

  function savePrompts() {
    if (tempSettings.customPrompt !== instance.customPrompt)
      updateSetting("customPrompt", tempSettings.customPrompt);
    if (tempSettings.customPromptDev !== instance.customPromptDev)
      updateSetting("customPromptDev", tempSettings.customPromptDev);
    if (tempSettings.customPromptSupport !== instance.customPromptSupport)
      updateSetting("customPromptSupport", tempSettings.customPromptSupport);
  }

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

  function saveGithubRepo() {
    const trimmed = localGithubRepo.trim();
    instances.update((list: Instance[]) =>
      list.map((i: Instance) =>
        i.id === instance.id ? { ...i, githubRepo: trimmed || undefined } : i,
      ),
    );
    settings.update((s: Settings) => ({
      ...s,
      projectOverrides: {
        ...s.projectOverrides,
        [instance.projectName]: {
          ...s.projectOverrides[instance.projectName],
          githubRepo: trimmed || undefined,
        },
      },
    }));
    if (instance.supportMode) updateInstanceBacklogs();
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

  function updateMode(mode: "developmentMode" | "supportMode", value: boolean) {
    // Determine new state
    const newModeValue = value;
    const otherMode =
      mode === "developmentMode" ? "supportMode" : "developmentMode";
    // If turning ON, force other OFF. If turning OFF, other stays as is (likely off)
    const otherModeValue = newModeValue ? false : !!instance[otherMode];

    // Enable instance if ANY mode is active
    const newEnabled = !!(newModeValue || otherModeValue);

    // Update local state immediately for UI
    instances.update((list: Instance[]) =>
      list.map((i: Instance) =>
        i.id === instance.id
          ? {
              ...i,
              [mode]: newModeValue,
              [otherMode]: otherModeValue,
              enabled: newEnabled,
            }
          : i,
      ),
    );

    // Persist to settings
    settings.update((s: Settings) => {
      const currentOverride = s.projectOverrides[instance.projectName] || {};
      const newOverride = {
        ...currentOverride,
        [mode]: newModeValue,
        [otherMode]: otherModeValue, // Persist exclusivity
        enabled: newEnabled,
      };

      return {
        ...s,
        projectOverrides: {
          ...s.projectOverrides,
          [instance.projectName]: newOverride,
        },
      };
    });

    // Trigger backlog refresh to apply new path
    updateInstanceBacklogs();
  }

  function updateSetting(key: keyof Instance, value: any) {
    // Update local state
    instances.update((list: Instance[]) =>
      list.map((i: Instance) =>
        i.id === instance.id ? { ...i, [key]: value } : i,
      ),
    );

    // Persist to settings
    settings.update((s: Settings) => {
      const currentOverride = s.projectOverrides[instance.projectName] || {};
      return {
        ...s,
        projectOverrides: {
          ...s.projectOverrides,
          [instance.projectName]: {
            ...currentOverride,
            [key]: value,
          },
        },
      };
    });

    // Trigger refresh if relevant
    if (key.includes("Path") || key === "githubRepo") {
      updateInstanceBacklogs();
    }
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
      <!-- Primary Stats Display (Dev or Support) -->
      {#if (instance.issuesDev?.total ?? 0) > 0 || instance.developmentMode}
        <span
          class="stat highlight-dev"
          class:active-mode={instance.developmentMode}
          class:inactive-mode={!instance.developmentMode &&
            ((instance.issuesSupport?.total ?? 0) > 0 || instance.supportMode)}
        >
          🛠️ {instance.issuesDev?.completed || 0}/{instance.issuesDev?.total ||
            0} Dev
        </span>
      {/if}

      {#if (instance.issuesSupport?.total ?? 0) > 0 || instance.supportMode}
        <span
          class="stat highlight-support"
          class:active-mode={instance.supportMode}
          class:inactive-mode={!instance.supportMode &&
            ((instance.issuesDev?.total ?? 0) > 0 || instance.developmentMode)}
        >
          🚑 {instance.issuesSupport?.completed || 0}/{instance.issuesSupport
            ?.total || 0} Sup
        </span>
      {/if}

      {#if !instance.developmentMode && !instance.supportMode && !(instance.issuesDev?.total ?? 0) && !(instance.issuesSupport?.total ?? 0)}
        <span class="stat"> 😴 Inactivo </span>
      {/if}

      <span
        class="stat"
        class:retry={instance.retryCount > 0}
        style="margin-left: auto;"
      >
        🔄 {instance.retryCount}/{instance.maxRetries}
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

    <!-- Mode Toggles Row -->
    <div class="mode-toggles">
      <label
        class="mode-toggle"
        class:active={instance.developmentMode}
        title="Activar Modo Desarrollo"
      >
        <input
          type="checkbox"
          checked={instance.developmentMode}
          onchange={(e) => {
            updateMode("developmentMode", e.currentTarget.checked);
            e.currentTarget.blur();
          }}
        />
        <span class="mode-label">🛠️ Dev</span>
      </label>
      <label
        class="mode-toggle"
        class:active={instance.supportMode}
        title="Activar Modo Soporte"
      >
        <input
          type="checkbox"
          checked={instance.supportMode}
          onchange={(e) => {
            updateMode("supportMode", e.currentTarget.checked);
            e.currentTarget.blur();
          }}
        />
        <span class="mode-label">🚑 Support</span>
      </label>
    </div>

    {#if instance.currentIssueTitle}
      <div class="current-issue" title={instance.currentIssueBody || ""}>
        <span class="badge"
          >{instance.developmentMode
            ? "DEV"
            : instance.supportMode
              ? "SUPPORT"
              : "issue"}</span
        >
        <b>#{instance.currentIssue}</b>: {instance.currentIssueTitle}
      </div>
    {/if}

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
          <div class="setting-group">
            <label>
              Custom Prompt (Default/Fallback):
              <textarea
                bind:value={tempSettings.customPrompt}
                placeholder="Prompt base para la IA..."
                rows="3"
                onblur={savePrompts}
              ></textarea>
            </label>

            <label style="margin-top: 0.5rem; display: block;">
              Custom Prompt (Desarrollo 🛠️):
              <textarea
                bind:value={tempSettings.customPromptDev}
                placeholder="Prompt específico para desarrollo..."
                rows="2"
                style="font-size: 0.85rem;"
                onblur={savePrompts}
              ></textarea>
            </label>

            <label style="margin-top: 0.5rem; display: block;">
              Custom Prompt (Soporte 🚑):
              <textarea
                bind:value={tempSettings.customPromptSupport}
                placeholder="Prompt específico para soporte/issues..."
                rows="2"
                style="font-size: 0.85rem;"
                onblur={savePrompts}
              ></textarea>
            </label>
          </div>
        </div>

        <div class="field">
          <label>Configuración de Modos</label>

          {#if instance.developmentMode}
            <div class="setting-group nested">
              <label>GitHub Repo (Dev)</label>
              <input
                type="text"
                placeholder="owner/repo (ej: timekast/bob-dev)"
                value={instance.githubRepoDev || ""}
                onchange={(e) =>
                  updateSetting("githubRepoDev", e.currentTarget.value)}
              />
            </div>
            {#if !instance.githubRepoDev}
              <div class="setting-group nested">
                <label>Ruta Issues Desarrollo (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: C:\Proyectos\Timekast\issues_dev"
                  value={instance.issuesPathDev || ""}
                  onchange={(e) =>
                    updateSetting("issuesPathDev", e.currentTarget.value)}
                />
                <div class="help-text">
                  Deja vacío para usar automático (issues/dev)
                </div>
              </div>
            {/if}
          {/if}

          {#if instance.supportMode}
            <div class="setting-group nested">
              <label>GitHub Repo (Support)</label>
              <input
                type="text"
                placeholder="owner/repo (ej: timekast/bob)"
                value={instance.githubRepoSupport || instance.githubRepo || ""}
                onchange={(e) =>
                  updateSetting("githubRepoSupport", e.currentTarget.value)}
              />
            </div>

            {#if !instance.githubRepoSupport && !instance.githubRepo}
              <div class="setting-group nested">
                <label>Ruta Issues Soporte (Local)</label>
                <input
                  type="text"
                  placeholder="Ej: C:\Proyectos\Timekast\issues_support"
                  value={instance.issuesPathSupport || ""}
                  onchange={(e) =>
                    updateSetting("issuesPathSupport", e.currentTarget.value)}
                />
                <div class="help-text">
                  Usa este campo si NO usas GitHub. Vacío = issues/support.
                </div>
              </div>
            {/if}
          {/if}

          {#if !instance.developmentMode && !instance.supportMode}
            <div class="help-text" style="padding: 0.5rem; opacity: 0.5;">
              Activa un modo (Dev o Support) para ver su configuración
              específica.
            </div>
          {/if}

          <span class="hint"
            >Modifica la carpeta de búsqueda de issues: issues/dev o
            issues/support</span
          >
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

  .stat.active-mode {
    opacity: 1;
    font-weight: bold;
    color: #fff;
    text-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
  }

  .stat.inactive-mode {
    opacity: 0.4;
    transform: scale(0.95);
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

  .current-issue {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    padding: 0.5rem;
    margin-top: 0.5rem;
    font-size: 0.85rem;
    color: #e0e0e0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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

  .mode-toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.05);
    padding: 0.3rem 0.6rem;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.2s;
  }

  .mode-toggle:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .mode-toggle input {
    width: auto;
    margin: 0;
  }

  .mode-label {
    font-size: 0.8rem;
  }
</style>
