# Requires -RunAsAdministrator
# Strict mode
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

try {
    $ExtensionId = "aoabjfoanlljmgnohepbkimcekolejjn"
    $SettingsPath = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Local Extension Settings\$ExtensionId"

    Write-Output "[INFO] Starting LabLock Self-Contained Script Builder..."
    Write-Output "[INFO] Target Extension ID: $ExtensionId"
    Write-Output "[INFO] Reading settings from: $SettingsPath"

    if ((Test-Path $SettingsPath) -eq $false) {
        Write-Warning "[!] Settings path not found. Please install the extension, set your password/whitelist on this computer, and try again."
        exit 1
    }

    # 1. Read and encode all files in the extension's local storage folder
    $FilesHash = @{}
    $Files = Get-ChildItem -Path $SettingsPath -File
    
    if ($Files.Count -eq 0) {
        Write-Warning "[!] No settings files found in the directory."
        exit 1
    }

    foreach ($File in $Files) {
        $Bytes = [System.IO.File]::ReadAllBytes($File.FullName)
        $Base64 = [System.Convert]::ToBase64String($Bytes)
        $FilesHash[$File.Name] = $Base64
        Write-Output "[INFO] Encoded: $($File.Name) ($($Bytes.Length) bytes)"
    }

    # 2. Build the output self-contained script content
    $OutputScriptPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "deploy_force_store.ps1"
    
    # Start generating the deployment script content
    $ScriptBuilder = @()
    $ScriptBuilder += "#Requires -RunAsAdministrator"
    $ScriptBuilder += "# Strict mode"
    $ScriptBuilder += "Set-StrictMode -Version Latest"
    $ScriptBuilder += "`$ErrorActionPreference = `"Stop`""
    $ScriptBuilder += ""
    $ScriptBuilder += "try {"
    $ScriptBuilder += "    Write-Output `"[INFO] Starting self-contained LabLock deployment...`""
    $ScriptBuilder += "    `$ExtensionId = `"$ExtensionId`""
    $ScriptBuilder += "    `$ChromePolicyPath = `"HKLM:\SOFTWARE\Policies\Google\Chrome`""
    $ScriptBuilder += "    `$ForcelistPath = `"`$ChromePolicyPath\ExtensionInstallForcelist`""
    $ScriptBuilder += "    `$BlocklistPath = `"`$ChromePolicyPath\URLBlocklist`""
    $ScriptBuilder += ""
    $ScriptBuilder += "    # Create policy keys if they don't exist"
    $ScriptBuilder += "    if ((Test-Path `$ChromePolicyPath) -eq `$false) {"
    $ScriptBuilder += "        New-Item -Path `$ChromePolicyPath -Force | Out-Null"
    $ScriptBuilder += "        Write-Output `"[INFO] Created key: `$ChromePolicyPath`""
    $ScriptBuilder += "    }"
    $ScriptBuilder += "    if ((Test-Path `$ForcelistPath) -eq `$false) {"
    $ScriptBuilder += "        New-Item -Path `$ForcelistPath -Force | Out-Null"
    $ScriptBuilder += "        Write-Output `"[INFO] Created key: `$ForcelistPath`""
    $ScriptBuilder += "    }"
    $ScriptBuilder += "    if ((Test-Path `$BlocklistPath) -eq `$false) {"
    $ScriptBuilder += "        New-Item -Path `$BlocklistPath -Force | Out-Null"
    $ScriptBuilder += "        Write-Output `"[INFO] Created key: `$BlocklistPath`""
    $ScriptBuilder += "    }"
    $ScriptBuilder += ""
    $ScriptBuilder += "    # 1. Apply GPO policies (Force-install from Web Store + Block chrome://extensions)"
    $ScriptBuilder += "    `$UpdateUrl = `"https://clients2.google.com/service/update2/crx`""
    $ScriptBuilder += "    `$ForcelistValue = `"`$ExtensionId;`$UpdateUrl`""
    $ScriptBuilder += "    Set-ItemProperty -Path `$ForcelistPath -Name `"1`" -Value `$ForcelistValue"
    $ScriptBuilder += "    Write-Output `"[INFO] Applied Web Store force-install policy.`""
    $ScriptBuilder += ""
    $ScriptBuilder += "    Set-ItemProperty -Path `$BlocklistPath -Name `"1`" -Value `"chrome://extensions`""
    $ScriptBuilder += "    Set-ItemProperty -Path `$BlocklistPath -Name `"2`" -Value `"chrome://flags`""
    $ScriptBuilder += "    Set-ItemProperty -Path `$BlocklistPath -Name `"3`" -Value `"chrome://settings/reset`""
    $ScriptBuilder += "    Write-Output `"[INFO] Blocked access to chrome:// pages.`""
    $ScriptBuilder += ""
    $ScriptBuilder += "    # 2. Reconstruct the pre-configured settings database (LevelDB)"
    $ScriptBuilder += "    `$TargetSettingsPath = `"`$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Local Extension Settings\`$ExtensionId`""
    $ScriptBuilder += "    if ((Test-Path `$TargetSettingsPath) -eq `$false) {"
    $ScriptBuilder += "        New-Item -Path `$TargetSettingsPath -ItemType Directory -Force | Out-Null"
    $ScriptBuilder += "    }"
    $ScriptBuilder += ""
    
    # Append the embedded base64 files
    $ScriptBuilder += "    # Embedded configuration files database"
    $ScriptBuilder += "    `$EmbeddedFiles = @{"
    foreach ($Key in $FilesHash.Keys) {
        $ScriptBuilder += "        `"$Key`" = `"$($FilesHash[$Key])`""
    }
    $ScriptBuilder += "    }"
    $ScriptBuilder += ""
    $ScriptBuilder += "    # Write each embedded file to disk"
    $ScriptBuilder += "    foreach (`$FileName in `$EmbeddedFiles.Keys) {"
    $ScriptBuilder += "        `$Bytes = [System.Convert]::FromBase64String(`$EmbeddedFiles[`$FileName])"
    $ScriptBuilder += "        `$FilePath = Join-Path `$TargetSettingsPath `$FileName"
    $ScriptBuilder += "        [System.IO.File]::WriteAllBytes(`$FilePath, `$Bytes)"
    $ScriptBuilder += "        Write-Output `"[INFO] Extracted configuration database file: `$FileName`""
    $ScriptBuilder += "    }"
    $ScriptBuilder += ""
    $ScriptBuilder += "    Write-Output `"[OK] LabLock policy and settings deployed successfully.`""
    $ScriptBuilder += "    Write-Output `"[INFO] Please restart Google Chrome to apply changes.`""
    $ScriptBuilder += "    exit 0"
    $ScriptBuilder += "}"
    $ScriptBuilder += "catch {"
    $ScriptBuilder += "    Write-Warning `"Error: `$__`""
    $ScriptBuilder += "    exit 1"
    $ScriptBuilder += "}"
    
    # Save the generated script
    $ScriptBuilder | Out-File -FilePath $OutputScriptPath -Encoding utf8 -Force
    Write-Output "[OK] Self-contained deployment script generated at: $OutputScriptPath"
    exit 0
}
catch {
    Write-Warning "Error: $_"
    exit 1
}
