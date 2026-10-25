' Bogazici Ders Notlari - siteyi baslatir ve tarayicida acar.
' Bu dosyaya cift tiklaman yeterli. Pencere acilmaz.
Dim kabuk, klasor, q, komut
Set kabuk = CreateObject("WScript.Shell")
q = Chr(34)
klasor = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
komut = q & "pythonw.exe" & q & " " & q & klasor & "site\sunucu.py" & q

On Error Resume Next
kabuk.Run komut, 0, False
If Err.Number <> 0 Then
  Err.Clear
  kabuk.Run q & "python.exe" & q & " " & q & klasor & "site\sunucu.py" & q, 7, False
End If
If Err.Number <> 0 Then
  MsgBox "Site baslatilamadi. Python kurulu gorunmuyor." & vbCrLf & _
         "Casper'a haber ver.", 16, "Ders Notlari"
End If
