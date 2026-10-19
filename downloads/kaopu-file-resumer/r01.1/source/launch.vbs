Option Explicit
Dim shell, fso, here, pythonw, process, candidate, root, command, exitcode, ticks
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
If Not fso.FileExists(fso.BuildPath(here, "bootstrap.pyw")) Or Not fso.FileExists(fso.BuildPath(here, "app.py")) Or Not fso.FileExists(fso.BuildPath(here, "core.py")) Then
    MsgBox "Please extract ALL files from the ZIP into a normal folder first. Then run launch.vbs from that folder.", vbExclamation, "Kaopu File Resumer r01.1"
    WScript.Quit 1
End If
pythonw = ""
For Each root In Array("HKCU\Software\Python\PythonCore\3.12\InstallPath\", "HKLM\Software\Python\PythonCore\3.12\InstallPath\", "HKLM\Software\WOW6432Node\Python\PythonCore\3.12\InstallPath\")
    On Error Resume Next
    candidate = shell.RegRead(root)
    If Err.Number = 0 Then
        candidate = fso.BuildPath(candidate, "pythonw.exe")
        If fso.FileExists(candidate) Then pythonw = candidate
    End If
    Err.Clear
    On Error GoTo 0
    If pythonw <> "" Then Exit For
Next
If pythonw = "" Then
    For Each root In Array(shell.ExpandEnvironmentStrings("%LocalAppData%") & "\Programs\Python\Python312", shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\Python312", "C:\Python312")
        candidate = fso.BuildPath(root, "pythonw.exe")
        If fso.FileExists(candidate) Then
            pythonw = candidate
            Exit For
        End If
    Next
End If
If pythonw = "" Then
    On Error Resume Next
    Set process = shell.Exec("py -3.12 -c ""import sys, pathlib; print(pathlib.Path(sys.executable).with_name('pythonw.exe'))""")
    If Err.Number = 0 Then
        ticks = 0
        Do While process.Status = 0 And ticks < 100
            WScript.Sleep 100
            ticks = ticks + 1
        Loop
        If process.Status = 0 Then
            process.Terminate
        Else
            candidate = Trim(process.StdOut.ReadAll)
            If fso.FileExists(candidate) Then pythonw = candidate
        End If
    End If
    Err.Clear
    On Error GoTo 0
End If
If pythonw = "" Then
    MsgBox "Python 3.12 was not found. This launcher does not install anything. If Python is installed, run diagnose.cmd and share its output. Official downloads: https://www.python.org/downloads/windows/", vbInformation, "Kaopu File Resumer r01.1"
    WScript.Quit 1
End If
shell.CurrentDirectory = here
command = """" & pythonw & """ """ & fso.BuildPath(here, "bootstrap.pyw") & """"
On Error Resume Next
' pythonw already has no console. Use normal window style, never hidden style 0.
exitcode = shell.Run(command, 1, True)
If Err.Number <> 0 Then
    MsgBox "Windows could not launch Python. Run diagnose.cmd in this folder. Error " & Err.Number, vbExclamation, "Kaopu File Resumer r01.1"
ElseIf exitcode <> 0 And exitcode <> 2 Then
    MsgBox "Python exited before the main window started. Run diagnose.cmd and check startup.log. Exit code: " & exitcode, vbExclamation, "Kaopu File Resumer r01.1"
End If
On Error GoTo 0
