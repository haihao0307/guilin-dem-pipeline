Option Explicit
Dim shell, fso, here, shortcut, target, appname
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
appname = ChrW(38752) & ChrW(35889) & ChrW(25991) & ChrW(20214) & ChrW(32493) & ChrW(20256) & ChrW(22120)
target = fso.BuildPath(shell.SpecialFolders("Desktop"), appname & ".lnk")
If fso.FileExists(target) Then
    If MsgBox("Replace the existing Kaopu File Resumer desktop shortcut?", vbYesNo + vbQuestion, "Kaopu File Resumer") <> vbYes Then WScript.Quit
End If
Set shortcut = shell.CreateShortcut(target)
shortcut.TargetPath = shell.ExpandEnvironmentStrings("%SystemRoot%") & "\System32\wscript.exe"
shortcut.Arguments = """" & fso.BuildPath(here, "launch.vbs") & """"
shortcut.WorkingDirectory = here
shortcut.Description = appname
If fso.FileExists(fso.BuildPath(here, "app.ico")) Then shortcut.IconLocation = fso.BuildPath(here, "app.ico")
shortcut.Save
MsgBox "Desktop shortcut created. Keep this application folder in its current location.", vbInformation, "Kaopu File Resumer"
