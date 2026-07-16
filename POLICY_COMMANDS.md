# Chrome Policy Management Commands (LabLock)

This guide contains the quick-reference PowerShell commands to **enforce** or **remove** the LabLock browser restriction policies.

> [!IMPORTANT]
> All commands must be run in a **Windows PowerShell** window launched as **Administrator**.

---

## 1. Enforce Policies (Lockdown & Installation)

Choose the method that matches your school's computer lab setup:

### Method A: Standalone / Non-Domain Joined PCs (100% Free)
Use this if your computers are **not** joined to an Active Directory domain. 

Since Chrome blocks automatic forced installation of local extensions on unmanaged computers, the secure workaround is:
1. Open Google Chrome. Go to `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the compiled `D:\TH\dist` folder.
2. Run the script below in an **Administrator PowerShell** window. This locks Chrome down (disabling DevTools, Incognito, Guest mode, Profile switching) and **blocks access to `chrome://extensions`** so students cannot remove or turn off the extension.

```powershell
# 1. Define registry paths
$ChromePolicyPath = "HKLM:\SOFTWARE\Policies\Google\Chrome"
$BlocklistPath = "$ChromePolicyPath\URLBlocklist"

# 2. Create the policy registry folders
New-Item -Path $ChromePolicyPath -Force | Out-Null
New-Item -Path $BlocklistPath -Force | Out-Null

# 3. Apply lockdown settings (Developer tools, Incognito, Guest mode, Profile creation, and chrome:// blocklist)
Set-ItemProperty -Path $ChromePolicyPath -Name "DeveloperToolsAvailability" -Value 2 -Type DWord
Set-ItemProperty -Path $ChromePolicyPath -Name "IncognitoModeAvailability" -Value 1 -Type DWord
Set-ItemProperty -Path $ChromePolicyPath -Name "BrowserGuestModeEnabled" -Value 0 -Type DWord
Set-ItemProperty -Path $ChromePolicyPath -Name "BrowserAddPersonEnabled" -Value 0 -Type DWord
Set-ItemProperty -Path $BlocklistPath -Name "1" -Value "chrome://extensions"
Set-ItemProperty -Path $BlocklistPath -Name "2" -Value "chrome://flags"
Set-ItemProperty -Path $BlocklistPath -Name "3" -Value "chrome://settings/reset"

# 4. Force restart Chrome to apply changes
Stop-Process -Name chrome -Force -ErrorAction SilentlyContinue
```

---

### Method B: Active Directory / Domain-Joined PCs (100% Free & Fully Automated)
Use this if your lab computers **are** enrolled in a Windows Active Directory domain. 

This automatically downloads, installs, and locks down the extension on all profiles. Make sure you have pushed `lablock.crx` and `update.xml` to GitHub Pages as described in the setup.

```powershell
# 1. Define variables (Configured for your self-hosted extension)
$ExtensionId = "ihkppjjhcdojeoepbnekmboabjemjilk"
$ChromePolicyPath = "HKLM:\SOFTWARE\Policies\Google\Chrome"
$ForcelistPath = "$ChromePolicyPath\ExtensionInstallForcelist"
$BlocklistPath = "$ChromePolicyPath\URLBlocklist"

# 2. Create the policy registry folders
New-Item -Path $ChromePolicyPath -Force | Out-Null
New-Item -Path $ForcelistPath -Force | Out-Null
New-Item -Path $BlocklistPath -Force | Out-Null

# 3. Apply enforcement settings (pointing to your GitHub Pages update.xml)
Set-ItemProperty -Path $ForcelistPath -Name "1" -Value "$ExtensionId;https://linustribevnr.github.io/blockerExtension/update.xml"
Set-ItemProperty -Path $ChromePolicyPath -Name "DeveloperToolsAvailability" -Value 2 -Type DWord
Set-ItemProperty -Path $ChromePolicyPath -Name "IncognitoModeAvailability" -Value 1 -Type DWord
Set-ItemProperty -Path $ChromePolicyPath -Name "BrowserGuestModeEnabled" -Value 0 -Type DWord
Set-ItemProperty -Path $ChromePolicyPath -Name "BrowserAddPersonEnabled" -Value 0 -Type DWord
Set-ItemProperty -Path $BlocklistPath -Name "1" -Value "chrome://extensions"
Set-ItemProperty -Path $BlocklistPath -Name "2" -Value "chrome://flags"
Set-ItemProperty -Path $BlocklistPath -Name "3" -Value "chrome://settings/reset"

# 4. Force restart Chrome to load policies
Stop-Process -Name chrome -Force -ErrorAction SilentlyContinue
```

---

## 2. Remove Policies (Rollback & Uninstallation)

Run the following script to remove the restrictions and restore Chrome to its default state without affecting other policies:

```powershell
# 1. Delete force-install entry (uninstalls the extension) from HKLM & HKCU
Remove-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist" -Name "1" -ErrorAction SilentlyContinue
Remove-ItemProperty -Path "HKCU:\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist" -Name "1" -ErrorAction SilentlyContinue

# 2. Re-enable Developer Tools, Incognito, Guest Mode, and Profile creation
Remove-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Google\Chrome" -Name "DeveloperToolsAvailability" -ErrorAction SilentlyContinue
Remove-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Google\Chrome" -Name "IncognitoModeAvailability" -ErrorAction SilentlyContinue
Remove-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Google\Chrome" -Name "BrowserGuestModeEnabled" -ErrorAction SilentlyContinue
Remove-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Google\Chrome" -Name "BrowserAddPersonEnabled" -ErrorAction SilentlyContinue
Remove-ItemProperty -Path "HKCU:\SOFTWARE\Policies\Google\Chrome" -Name "DeveloperToolsAvailability" -ErrorAction SilentlyContinue
Remove-ItemProperty -Path "HKCU:\SOFTWARE\Policies\Google\Chrome" -Name "IncognitoModeAvailability" -ErrorAction SilentlyContinue
Remove-ItemProperty -Path "HKCU:\SOFTWARE\Policies\Google\Chrome" -Name "BrowserGuestModeEnabled" -ErrorAction SilentlyContinue
Remove-ItemProperty -Path "HKCU:\SOFTWARE\Policies\Google\Chrome" -Name "BrowserAddPersonEnabled" -ErrorAction SilentlyContinue

# 3. Unblock internal chrome:// pages from HKLM & HKCU
Remove-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Google\Chrome\URLBlocklist" -Name "1" -ErrorAction SilentlyContinue
Remove-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Google\Chrome\URLBlocklist" -Name "2" -ErrorAction SilentlyContinue
Remove-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Google\Chrome\URLBlocklist" -Name "3" -ErrorAction SilentlyContinue
Remove-ItemProperty -Path "HKCU:\SOFTWARE\Policies\Google\Chrome\URLBlocklist" -Name "1" -ErrorAction SilentlyContinue
Remove-ItemProperty -Path "HKCU:\SOFTWARE\Policies\Google\Chrome\URLBlocklist" -Name "2" -ErrorAction SilentlyContinue
Remove-ItemProperty -Path "HKCU:\SOFTWARE\Policies\Google\Chrome\URLBlocklist" -Name "3" -ErrorAction SilentlyContinue

# 4. Clean up empty policy folders to keep registry clean
$Keys = @(
    "HKLM:\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist",
    "HKLM:\SOFTWARE\Policies\Google\Chrome\URLBlocklist",
    "HKLM:\SOFTWARE\Policies\Google\Chrome",
    "HKCU:\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist",
    "HKCU:\SOFTWARE\Policies\Google\Chrome\URLBlocklist",
    "HKCU:\SOFTWARE\Policies\Google\Chrome"
)
foreach ($Key in $Keys) {
    if (Test-Path $Key) {
        $properties = Get-ItemProperty -Path $Key -ErrorAction SilentlyContinue
        $subkeys = Get-ChildItem -Path $Key -ErrorAction SilentlyContinue
        $propCount = ($properties.PSObject.Properties.Name | Where-Object { $_ -notmatch '^(PS|RunSpaceId)' }).Count
        if ($propCount -eq 0 -and $subkeys.Count -eq 0) {
            Remove-Item -Path $Key -Force -ErrorAction SilentlyContinue
        }
    }
}

# 5. Force restart Chrome to apply rollback
Stop-Process -Name chrome -Force -ErrorAction SilentlyContinue
```

---

## 3. Alternative: Full Reset (Clears All Chrome Policies)

If you want to clear **all** Chrome policies from this machine entirely:

```powershell
Remove-Item -Path "HKLM:\SOFTWARE\Policies\Google\Chrome" -Recurse -Force
Stop-Process -Name chrome -Force -ErrorAction SilentlyContinue
```

---

## 4. Troubleshooting: Loading Unpacked Extension (Developer/Testing)

If you see the error **"LabLock (extension ID '...') is blocked by the administrator"** while trying to **Load unpacked** from the `dist/` directory, it is because the force-install policy is active in the registry.

To resolve this conflict and test the unpacked extension locally:

1. Temporarily disable the force-install registry policy by running:
   ```powershell
   Remove-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist" -Name "1" -ErrorAction SilentlyContinue
   Stop-Process -Name chrome -Force -ErrorAction SilentlyContinue
   ```
2. Reopen Chrome and click **Load unpacked** to load your extension folder.
