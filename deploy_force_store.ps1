#Requires -RunAsAdministrator
param(
    [Parameter(Mandatory=$true)]
    [string]$ExtensionId
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

    # Force-install extension from the Chrome Web Store
    $UpdateUrl = "https://clients2.google.com/service/update2/crx"
    $ForcelistValue = "$ExtensionId;$UpdateUrl"
    
    # We set entry "1" for the force list
    Set-ItemProperty -Path $ForcelistPath -Name "1" -Value $ForcelistValue
    Write-Output "[INFO] Set force-installed extension list entry 1 to: $ForcelistValue"

    # Block chrome:// pages (prevents users from visiting Extensions page)
    Set-ItemProperty -Path $BlocklistPath -Name "1" -Value "chrome://extensions"
    Set-ItemProperty -Path $BlocklistPath -Name "2" -Value "chrome://flags"
    Set-ItemProperty -Path $BlocklistPath -Name "3" -Value "chrome://settings/reset"
    Write-Output "[INFO] Blocked access to chrome:// pages"

    Write-Output "[OK] Force-install policy applied successfully."
    Write-Output "[INFO] Please restart Chrome to apply changes."
    exit 0
}
catch {
    Write-Warning "Error: $_"
    exit 1
}
