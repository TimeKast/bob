; BOB Monitor — NSIS Installer Hooks
; Installs companion VS Code/Antigravity extensions during setup

!include "nsDialogs.nsh"
!include "LogicLib.nsh"

; Variables for checkboxes
Var AutoclickerCheckbox
Var DiagnosticsCheckbox
Var InstallAutoclicker
Var InstallDiagnostics

; ─── Custom Page: Extension Selection ────────────────────────────────

!macro NSIS_HOOK_PREINSTALL
  ; Initialize defaults
  StrCpy $InstallAutoclicker "1"
  StrCpy $InstallDiagnostics "0"
!macroend

Function ExtensionsPage
  nsDialogs::Create 1018
  Pop $0

  ${NSD_CreateLabel} 0 0 100% 24u "BOB will install the following companion extensions into Antigravity/VS Code:"
  Pop $0

  ; Helper (mandatory — no checkbox, just info)
  ${NSD_CreateLabel} 16u 34u 100% 16u "✅  BOB Helper (required — enables silent mode communication)"
  Pop $0

  ; Autoclicker (optional, default ON)
  ${NSD_CreateCheckbox} 0 56u 100% 16u "BOB Auto Clicker — auto-accepts agent steps, terminal commands, and tool permissions"
  Pop $AutoclickerCheckbox
  ${NSD_Check} $AutoclickerCheckbox

  ; Diagnostics (optional, default OFF)
  ${NSD_CreateCheckbox} 0 78u 100% 16u "BOB Diagnostics — captures agent diagnostics for debugging"
  Pop $DiagnosticsCheckbox

  nsDialogs::Show
FunctionEnd

Function ExtensionsPageLeave
  ; Read checkbox states
  ${NSD_GetState} $AutoclickerCheckbox $InstallAutoclicker
  ${NSD_GetState} $DiagnosticsCheckbox $InstallDiagnostics
FunctionEnd

; ─── Post-Install: Install Extensions ────────────────────────────────

!macro NSIS_HOOK_POSTINSTALL
  ; Always install helper (mandatory)
  DetailPrint "Installing BOB Helper extension..."
  nsExec::ExecToLog '"antigravity" --install-extension "$INSTDIR\resources\bob-helper.vsix"'
  Pop $0
  ${If} $0 != 0
    ; Fallback to 'code' if antigravity not found
    nsExec::ExecToLog '"code" --install-extension "$INSTDIR\resources\bob-helper.vsix"'
    Pop $0
  ${EndIf}

  ; Autoclicker (if checked)
  ${If} $InstallAutoclicker == ${BST_CHECKED}
    DetailPrint "Installing BOB Auto Clicker extension..."
    nsExec::ExecToLog '"antigravity" --install-extension "$INSTDIR\resources\bob-autoclicker.vsix"'
    Pop $0
    ${If} $0 != 0
      nsExec::ExecToLog '"code" --install-extension "$INSTDIR\resources\bob-autoclicker.vsix"'
      Pop $0
    ${EndIf}
  ${EndIf}

  ; Diagnostics (if checked)
  ${If} $InstallDiagnostics == ${BST_CHECKED}
    DetailPrint "Installing BOB Diagnostics extension..."
    nsExec::ExecToLog '"antigravity" --install-extension "$INSTDIR\resources\bob-diagnostics.vsix"'
    Pop $0
    ${If} $0 != 0
      nsExec::ExecToLog '"code" --install-extension "$INSTDIR\resources\bob-diagnostics.vsix"'
      Pop $0
    ${EndIf}
  ${EndIf}
!macroend
