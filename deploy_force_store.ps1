#Requires -RunAsAdministrator
# Strict mode
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

param(
    [Parameter(Mandatory=$true)]
    [string]$ExtensionId
)

try {
    Write-Output "[INFO] Starting Chrome Web Store extension force-installation..."
    Write-Output "[INFO] Extension ID to enforce: $ExtensionId"

    $ChromePolicyPath = "HKLM:\SOFTWARE\Policies\Google\Chrome"
    $ForcelistPath = "$ChromePolicyPath\ExtensionInstallForcelist"

    # Create policy keys if they don't exist
    if ((Test-Path $ChromePolicyPath) -eq $false) {
        New-Item -Path $ChromePolicyPath -Force | Out-Null
        Write-Output "[INFO] Created key: $ChromePolicyPath"
    }
    if ((Test-Path $ForcelistPath) -eq $false) {
        New-Item -Path $ForcelistPath -Force | Out-Null
        Write-Output "[INFO] Created key: $ForcelistPath"
    }

    # Force-install extension from the Chrome Web Store
    $UpdateUrl = "https://clients2.google.com/service/update2/crx"
    $ForcelistValue = "$ExtensionId;$UpdateUrl"
    
    # We set entry "1" for the force list
    Set-ItemProperty -Path $ForcelistPath -Name "1" -Value $ForcelistValue
    Write-Output "[INFO] Set force-installed extension list entry 1 to: $ForcelistValue"

    Write-Output "[OK] Force-install policy applied successfully."
    Write-Output "[INFO] Please restart Chrome to apply changes."
    exit 0
}
catch {
    Write-Warning "Error: $_"
    exit 1
}
