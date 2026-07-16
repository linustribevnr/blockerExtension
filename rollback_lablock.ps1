#Requires -RunAsAdministrator
# Strict mode
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

try {
    Write-Output "[INFO] Starting LabLock policy rollback..."

    $ChromePolicyPath = "HKLM:\SOFTWARE\Policies\Google\Chrome"
    $ForcelistPath = "$ChromePolicyPath\ExtensionInstallForcelist"
    $BlocklistPath = "$ChromePolicyPath\URLBlocklist"

    # Remove force-install entry (uninstalls the extension) from HKLM & HKCU
    if (Test-Path $ForcelistPath) {
        Remove-ItemProperty -Path $ForcelistPath -Name "1" -ErrorAction SilentlyContinue
        Write-Output "[INFO] Removed force-install list entry"
    }

    # Re-enable Developer Tools, Incognito, Guest Mode, and Profile switching
    if (Test-Path $ChromePolicyPath) {
        Remove-ItemProperty -Path $ChromePolicyPath -Name "DeveloperToolsAvailability" -ErrorAction SilentlyContinue
        Remove-ItemProperty -Path $ChromePolicyPath -Name "IncognitoModeAvailability" -ErrorAction SilentlyContinue
        Remove-ItemProperty -Path $ChromePolicyPath -Name "BrowserGuestModeEnabled" -ErrorAction SilentlyContinue
        Remove-ItemProperty -Path $ChromePolicyPath -Name "BrowserAddPersonEnabled" -ErrorAction SilentlyContinue
        Write-Output "[INFO] Re-enabled Developer Tools, Incognito Mode, Guest Mode, and Profile switching policies"
    }

    # Unblock internal chrome:// pages
    if (Test-Path $BlocklistPath) {
        Remove-ItemProperty -Path $BlocklistPath -Name "1" -ErrorAction SilentlyContinue
        Remove-ItemProperty -Path $BlocklistPath -Name "2" -ErrorAction SilentlyContinue
        Remove-ItemProperty -Path $BlocklistPath -Name "3" -ErrorAction SilentlyContinue
        Write-Output "[INFO] Unblocked internal chrome:// pages"
    }

    # Clean up empty policy folders to keep registry clean
    $Keys = @(
        $ForcelistPath,
        $BlocklistPath,
        $ChromePolicyPath
    )
    foreach ($Key in $Keys) {
        if (Test-Path $Key) {
            $properties = Get-ItemProperty -Path $Key -ErrorAction SilentlyContinue
            $subkeys = Get-ChildItem -Path $Key -ErrorAction SilentlyContinue
            $propCount = ($properties.PSObject.Properties.Name | Where-Object { $_ -notmatch '^(PS|RunSpaceId)' }).Count
            if (($propCount -eq 0) -and ($subkeys.Count -eq 0)) {
                Remove-Item -Path $Key -Force -ErrorAction SilentlyContinue
                Write-Output "[INFO] Cleaned up empty registry key: $Key"
            }
        }
    }

    Write-Output "[OK] LabLock policies rolled back successfully."
    Write-Output "[INFO] Please restart Chrome to apply changes."
    exit 0
}
catch {
    Write-Warning "Error: $_"
    exit 1
}
