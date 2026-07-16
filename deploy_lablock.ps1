#Requires -RunAsAdministrator

param(
    [Parameter(Mandatory=$true)]
    [string]$ExtensionId
)

$ChromePolicyPath = "HKLM:\SOFTWARE\Policies\Google\Chrome"
$ForcelistPath = "$ChromePolicyPath\ExtensionInstallForcelist"
$BlocklistPath = "$ChromePolicyPath\URLBlocklist"

# Create policy keys if they don't exist
New-Item -Path $ChromePolicyPath -Force | Out-Null
New-Item -Path $ForcelistPath -Force | Out-Null
New-Item -Path $BlocklistPath -Force | Out-Null

# Force-install extension (pointing to your self-hosted update XML)
$UpdateUrl = "https://linustribevnr.github.io/blockerExtension/update.xml"
Set-ItemProperty -Path $ForcelistPath -Name "1" -Value "$ExtensionId;$UpdateUrl"

# Disable Developer Tools (2 = Never allow)
Set-ItemProperty -Path $ChromePolicyPath -Name "DeveloperToolsAvailability" -Value 2 -Type DWord

# Disable Incognito Mode (1 = Disabled)
Set-ItemProperty -Path $ChromePolicyPath -Name "IncognitoModeAvailability" -Value 1 -Type DWord

# Disable Guest Mode (0 = Disabled)
Set-ItemProperty -Path $ChromePolicyPath -Name "BrowserGuestModeEnabled" -Value 0 -Type DWord

# Disable adding new user profiles (0 = Disabled)
Set-ItemProperty -Path $ChromePolicyPath -Name "BrowserAddPersonEnabled" -Value 0 -Type DWord

# Block chrome:// pages
Set-ItemProperty -Path $BlocklistPath -Name "1" -Value "chrome://extensions"
Set-ItemProperty -Path $BlocklistPath -Name "2" -Value "chrome://flags"
Set-ItemProperty -Path $BlocklistPath -Name "3" -Value "chrome://settings/reset"

Write-Host "✅ LabLock policies applied successfully." -ForegroundColor Green
Write-Host "   Extension ID: $ExtensionId" -ForegroundColor Cyan
Write-Host "   Restart Chrome to apply changes." -ForegroundColor Yellow
