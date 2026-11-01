!include "MUI2.nsh"
!include "LogicLib.nsh"

Name "DistribPro"
OutFile "DistribPro-Setup.exe"
InstallDir "$PROGRAMFILES\DistribPro"
RequestExecutionLevel admin

!define MUI_ICON "build\icon.ico"
!define MUI_UNICON "build\icon.ico"
!define MUI_WELCOMEPAGE_TITLE "DistribPro - Distribution Management System"
!define MUI_WELCOMEPAGE_TEXT "Welcome to the DistribPro installer. This will install the distribution management system on your computer.$\r$\n$\r$\nClick Install to continue."
!define MUI_FINISHPAGE_TITLE "Installation Complete"
!define MUI_FINISHPAGE_TEXT "DistribPro has been installed successfully.$\r$\n$\r$\nClick Finish to exit the installer."
!define MUI_FINISHPAGE_RUN "$INSTDIR\DistribPro.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch DistribPro now"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "English"

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "win-unpacked\*.*"

  CreateShortcut "$DESKTOP\DistribPro.lnk" "$INSTDIR\DistribPro.exe"
  CreateShortcut "$SMPROGRAMS\DistribPro.lnk" "$INSTDIR\DistribPro.exe"

  WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\DistribPro.lnk"
  Delete "$SMPROGRAMS\DistribPro.lnk"
  RMDir /r "$INSTDIR"
SectionEnd
