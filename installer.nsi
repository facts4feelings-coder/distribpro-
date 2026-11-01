; DistribPro Windows installer — native NSIS build (Linux makensis)
; Packages the electron-builder win-unpacked output into a standard
; per-machine installer with shortcuts and an uninstaller.
Unicode true
Name "DistribPro"
OutFile "release\DistribPro-Setup-1.0.0.exe"
InstallDir "$PROGRAMFILES64\DistribPro"
RequestExecutionLevel admin
SetCompressor /SOLID lzma

Page directory
Page instfiles

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "release\win-unpacked\*.*"
  CreateDirectory "$SMPROGRAMS\DistribPro"
  CreateShortcut "$SMPROGRAMS\DistribPro\DistribPro.lnk" "$INSTDIR\DistribPro.exe"
  CreateShortcut "$SMPROGRAMS\DistribPro\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\DistribPro.lnk" "$INSTDIR\DistribPro.exe"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\DistribPro" "DisplayName" "DistribPro"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\DistribPro" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\DistribPro" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\DistribPro" "DisplayVersion" "1.0.0"
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\DistribPro.lnk"
  Delete "$SMPROGRAMS\DistribPro\DistribPro.lnk"
  Delete "$SMPROGRAMS\DistribPro\Uninstall.lnk"
  RMDir "$SMPROGRAMS\DistribPro"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\DistribPro"
  RMDir /r "$INSTDIR"
SectionEnd
