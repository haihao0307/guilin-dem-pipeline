Option Explicit
Dim shell, fso, here, shortcut, target, appname, required, tempRoot, iconfile, iconpath, iconstream
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
For Each required In Array("launch.vbs", "app.py", "core.py", "bootstrap.pyw", "dpi_support.py")
    If Not fso.FileExists(fso.BuildPath(here, required)) Then
        MsgBox Cn(Array(35831,20808,20840,37096,35299,21387,65292,19981,33021,22312,90,73,80,37324,36816,34892,12290)), vbExclamation, Cn(Array(38752,35889,25991,20214,32493,20256,22120))
        WScript.Quit 1
    End If
Next
tempRoot = fso.GetAbsolutePathName(shell.ExpandEnvironmentStrings("%TEMP%"))
If LCase(Left(here & "\", Len(tempRoot) + 1)) = LCase(tempRoot & "\") Then
    If MsgBox(Cn(Array(24403,21069,30446,24405,26159,20020,26102,25991,20214,22841,65292,24314,35758,20808,20840,37096,35299,21387,21040,25991,26723,31561,22266,23450,30446,24405,12290,20173,35201,32487,32493,21527,65311)), vbYesNo + vbExclamation + vbDefaultButton2, Cn(Array(38752,35889,25991,20214,32493,20256,22120))) <> vbYes Then WScript.Quit 0
End If
If Not fso.FileExists(fso.BuildPath(here, "assets\KAOPU_CORA_restored_r01.ico")) Then
    MsgBox "Brand icon asset missing. Extract all r01.4 files first.", vbExclamation, "KAOPU File Resumer"
    WScript.Quit 1
End If
appname = ChrW(38752) & ChrW(35889) & ChrW(25991) & ChrW(20214) & ChrW(32493) & ChrW(20256) & ChrW(22120)
target = fso.BuildPath(shell.SpecialFolders("Desktop"), appname & ".lnk")
If fso.FileExists(target) Then
    If MsgBox(Cn(Array(26367,25442,24050,26377,30340,38752,35889,25991,20214,32493,20256,22120,26700,38754,24555,25463,26041,24335,21527,65311)), vbYesNo + vbQuestion, "Kaopu File Resumer") <> vbYes Then WScript.Quit
End If
Set shortcut = shell.CreateShortcut(target)
shortcut.TargetPath = shell.ExpandEnvironmentStrings("%SystemRoot%") & "\System32\wscript.exe"
shortcut.Arguments = """" & fso.BuildPath(here, "launch.vbs") & """"
shortcut.WorkingDirectory = here
shortcut.Description = appname
shortcut.IconLocation = fso.BuildPath(here, "assets\KAOPU_CORA_restored_r01.ico") & ",0"
shortcut.Save
MsgBox Cn(Array(26700,38754,24555,25463,26041,24335,24050,21019,24314,12290,35831,19981,35201,31227,21160,27492,31243,24207,25991,20214,22841,12290)), vbInformation, "Kaopu File Resumer"

Function Cn(codes)
    Dim code, result
    result = ""
    For Each code In codes
        result = result & ChrW(code)
    Next
    Cn = result
End Function
