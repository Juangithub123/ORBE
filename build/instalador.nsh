; Agregados al instalador de Windows (electron-builder, NSIS).
; Además del acceso directo normal, uno en modo kiosco: pantalla completa en el monitor o proyector
; externo, sin cursor, arranca solo y se sale con Ctrl+Q.

!macro customInstall
  CreateShortCut "$DESKTOP\ORBE (kiosco).lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--kiosco"
  CreateShortCut "$SMPROGRAMS\ORBE (kiosco).lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--kiosco"
!macroend

!macro customUnInstall
  Delete "$DESKTOP\ORBE (kiosco).lnk"
  Delete "$SMPROGRAMS\ORBE (kiosco).lnk"
!macroend
