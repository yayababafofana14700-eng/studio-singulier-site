@echo off
REM Envoie la nouvelle version du site sur GitHub.
REM Une fenetre de navigateur peut s'ouvrir pour la connexion GitHub : c'est normal.
REM
REM Ce fichier vit dans le projet, donc il est sauvegarde sur GitHub avec le
REM reste. Le raccourci pose sur le Bureau pointe ici.

cd /d "%~dp0"

REM ---------------------------------------------------------------------------
REM  1. Le dossier doit etre propre avant tout.
REM
REM  Si du travail n'est pas commite, on s'arrete. Sans ce controle, l'etape 2
REM  ecrirait dans les pages l'empreinte d'un CSS modifie mais non commite : le
REM  site en ligne pointerait vers une version qui n'existe pas chez lui, et le
REM  cache d'un an la garderait tout ce temps.
REM ---------------------------------------------------------------------------
git diff --quiet
if errorlevel 1 goto NON_COMMITE
git diff --cached --quiet
if errorlevel 1 goto NON_COMMITE

REM ---------------------------------------------------------------------------
REM  2. Recalcul des empreintes d'assets.
REM
REM  /css/ et /js/ sont servis avec un cache d'un an (immutable). Cela n'est sur
REM  que si l'URL change quand le fichier change. Le script s'en charge ; si une
REM  page etait perimee, il la corrige et on commite cette correction seule.
REM ---------------------------------------------------------------------------
echo.
echo   Verification des versions d'assets...
node scripts\version-assets.mjs
if errorlevel 1 goto ECHEC_SCRIPT

git diff --quiet
if errorlevel 1 (
  echo.
  echo   Des pages etaient perimees : correction commitee.
  git add *.html
  git commit -m "Versions d assets recalculees avant deploiement" >nul
)

REM ---------------------------------------------------------------------------
REM  3. Envoi.
REM ---------------------------------------------------------------------------
echo.
echo   Envoi de la nouvelle version vers GitHub...
echo.

git push -u origin main

echo.
if errorlevel 1 (
  echo   ECHEC. Recopie le message ci-dessus et envoie-le moi.
) else (
  echo   TERMINE. Vercel redeploie automatiquement dans la minute.
)
echo.
pause
exit /b 0

:NON_COMMITE
echo.
echo   ARRET : des modifications ne sont pas commitees.
echo.
echo   Rien n'a ete envoye. Commite d'abord ton travail, puis relance
echo   ce fichier. Voici ce qui n'est pas commite :
echo.
git status --short
echo.
pause
exit /b 1

:ECHEC_SCRIPT
echo.
echo   ARRET : le calcul des versions a echoue.
echo.
echo   Le plus probable : une page reference un fichier CSS ou JS absent
echo   du disque. Le message ci-dessus le nomme. Rien n'a ete envoye.
echo.
pause
exit /b 1
