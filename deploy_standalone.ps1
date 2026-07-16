#Requires -RunAsAdministrator
# Strict mode
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

try {
    Write-Output "[INFO] Starting LabLock standalone (non-domain) policy deployment..."

    $ChromePolicyPath = "HKLM:\SOFTWARE\Policies\Google\Chrome"
    $BlocklistPath = "$ChromePolicyPath\URLBlocklist"

    # Create policy keys if they don't exist
    if ((Test-Path $ChromePolicyPath) -eq $false) {
        New-Item -Path $ChromePolicyPath -Force | Out-Null
        Write-Output "[INFO] Created key: $ChromePolicyPath"
    }
    if ((Test-Path $BlocklistPath) -eq $false) {
        New-Item -Path $BlocklistPath -Force | Out-Null
        Write-Output "[INFO] Created key: $BlocklistPath"
    }

    # Disable Developer Tools (Commented out for testing unpacked extensions)
    # If DeveloperToolsAvailability is set to 2, Chrome disables Developer Mode, which unloads unpacked extensions.
    # Set-ItemProperty -Path $ChromePolicyPath -Name "DeveloperToolsAvailability" -Value 2 -Type DWord
    # Write-Output "[INFO] Disabled Developer Tools (DeveloperToolsAvailability = 2)"

    # Disable Incognito Mode (1 = Disabled)
    Set-ItemProperty -Path $ChromePolicyPath -Name "IncognitoModeAvailability" -Value 1 -Type DWord
    Write-Output "[INFO] Disabled Incognito Mode (IncognitoModeAvailability = 1)"

    # Disable Guest Mode (0 = Disabled)
    Set-ItemProperty -Path $ChromePolicyPath -Name "BrowserGuestModeEnabled" -Value 0 -Type DWord
    Write-Output "[INFO] Disabled Guest Mode"

    # Disable adding new user profiles (0 = Disabled)
    Set-ItemProperty -Path $ChromePolicyPath -Name "BrowserAddPersonEnabled" -Value 0 -Type DWord
    Write-Output "[INFO] Disabled Profile Switching / Addition"

    # Block chrome:// pages (prevents users from turning off the unpacked extension)
    Set-ItemProperty -Path $BlocklistPath -Name "1" -Value "chrome://extensions"
    Set-ItemProperty -Path $BlocklistPath -Name "2" -Value "chrome://flags"
    Set-ItemProperty -Path $BlocklistPath -Name "3" -Value "chrome://settings/reset"
    Write-Output "[INFO] Blocked access to chrome:// pages"

    Write-Output "[OK] LabLock standalone policies applied successfully."
    Write-Output "[INFO] Please restart Chrome to apply changes."
    exit 0
}
catch {
    Write-Warning "Error: $_"
    exit 1
}
