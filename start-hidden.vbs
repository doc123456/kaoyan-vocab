Option Explicit

Dim fso, shell, root, backendDir, frontendDir, url
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

root = fso.GetParentFolderName(WScript.ScriptFullName)
backendDir = root & "\backend"
frontendDir = root & "\frontend"
url = "http://localhost:3000"

Function Q(value)
  Q = """" & value & """"
End Function

Function RunHidden(command, wait)
  RunHidden = shell.Run("cmd.exe /c " & command, 0, wait)
End Function

If RunHidden("where node >nul 2>nul", True) <> 0 Then
  MsgBox "Node.js was not found. Please install Node.js first.", vbCritical, "Vocab App"
  WScript.Quit 1
End If

If RunHidden("where npm >nul 2>nul", True) <> 0 Then
  MsgBox "npm was not found. Please install Node.js/npm first.", vbCritical, "Vocab App"
  WScript.Quit 1
End If

If Not fso.FolderExists(backendDir & "\node_modules") Then
  MsgBox "Backend dependencies are missing. Installing now. This may take a few minutes.", vbInformation, "Vocab App"
  If RunHidden("cd /d " & Q(backendDir) & " && npm install >> " & Q(root & "\install-backend.log") & " 2>>&1", True) <> 0 Then
    MsgBox "Backend dependency installation failed. Check install-backend.log.", vbCritical, "Vocab App"
    WScript.Quit 1
  End If
End If

If Not fso.FolderExists(frontendDir & "\node_modules") Then
  MsgBox "Frontend dependencies are missing. Installing now. This may take a few minutes.", vbInformation, "Vocab App"
  If RunHidden("cd /d " & Q(frontendDir) & " && npm install >> " & Q(root & "\install-frontend.log") & " 2>>&1", True) <> 0 Then
    MsgBox "Frontend dependency installation failed. Check install-frontend.log.", vbCritical, "Vocab App"
    WScript.Quit 1
  End If
End If

RunHidden "powershell -NoProfile -ExecutionPolicy Bypass -Command " & Q("Get-NetTCPConnection -LocalPort 3000,3001 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }") & " >nul 2>nul", True

RunHidden "cd /d " & Q(backendDir) & " && npm start >> " & Q(root & "\backend-server.log") & " 2>> " & Q(root & "\backend-server.err.log"), False
WScript.Sleep 3000

RunHidden "cd /d " & Q(frontendDir) & " && set BROWSER=none&& npm start >> " & Q(root & "\frontend-server.log") & " 2>> " & Q(root & "\frontend-server.err.log"), False
WScript.Sleep 9000

shell.Run url, 1, False
