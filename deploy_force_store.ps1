#Requires -RunAsAdministrator
param(
    [Parameter(Mandatory=$true)]
    [string]$ExtensionId,

    [Parameter(Mandatory=$false)]
    [string]$SourceSettingsPath = ""
)

# Strict mode
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

try {
    Write-Output "[INFO] Starting Chrome Web Store extension force-installation..."
    Write-Output "[INFO] Extension ID to enforce: $ExtensionId"

    $ChromePolicyPath = "HKLM:\SOFTWARE\Policies\Google\Chrome"
    $ForcelistPath = "$ChromePolicyPath\ExtensionInstallForcelist"
    $BlocklistPath = "$ChromePolicyPath\URLBlocklist"

    # Create policy keys if they don't exist
    if ((Test-Path $ChromePolicyPath) -eq $false) {
        New-Item -Path $ChromePolicyPath -Force | Out-Null
        Write-Output "[INFO] Created key: $ChromePolicyPath"
    }
    if ((Test-Path $ForcelistPath) -eq $false) {
        New-Item -Path $ForcelistPath -Force | Out-Null
        Write-Output "[INFO] Created key: $ForcelistPath"
    }
    if ((Test-Path $BlocklistPath) -eq $false) {
        New-Item -Path $BlocklistPath -Force | Out-Null
        Write-Output "[INFO] Created key: $BlocklistPath"
    }

    # Force-install extension from the Chrome Web Store (prevents removal)
    $UpdateUrl = "https://clients2.google.com/service/update2/crx"
    $ForcelistValue = "$ExtensionId;$UpdateUrl"
    Set-ItemProperty -Path $ForcelistPath -Name "1" -Value $ForcelistValue
    Write-Output "[INFO] Set force-installed extension list entry 1 to: $ForcelistValue"

    # Block access to chrome://extensions to prevent user tampering
    Set-ItemProperty -Path $BlocklistPath -Name "1" -Value "chrome://extensions"
    Set-ItemProperty -Path $BlocklistPath -Name "2" -Value "chrome://flags"
    Set-ItemProperty -Path $BlocklistPath -Name "3" -Value "chrome://settings/reset"
    Write-Output "[INFO] Blocked access to chrome:// pages"

    # If a pre-configured settings folder is provided, copy it to Chrome's profile folder
    if ($SourceSettingsPath -and (Test-Path $SourceSettingsPath)) {
        Write-Output "[INFO] Copying pre-configured settings database from: $SourceSettingsPath"
        
        $TargetSettingsPath = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Local Extension Settings\$ExtensionId"
        
        # Ensure the destination folder exists
        if ((Test-Path $TargetSettingsPath) -eq $false) {
            New-Item -Path $TargetSettingsPath -ItemType Directory -Force | Out-Null
        }
        
        # Copy settings database files (LevelDB)
        Copy-Item -Path "$SourceSettingsPath\*" -Destination $TargetSettingsPath -Recurse -Force
        Write-Output "[INFO] Successfully deployed pre-configured settings to: $TargetSettingsPath"
    }
    elseif ($SourceSettingsPath) {
        Write-Warning "[WARN] Source settings path not found: $SourceSettingsPath. Skipping settings deployment."
    }

    Write-Output "[OK] Force-install and restriction policy applied successfully."
    Write-Output "[INFO] Please restart Chrome to apply changes."
    exit 0
}
catch {
    Write-Warning "Error: $_"
    exit 1
}
