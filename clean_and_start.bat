@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo FRG Builder - Workspace Canonico
echo ==========================================
echo.
echo Este script usa solo la app raiz.
echo Los proyectos anidados quedan fuera del flujo principal.
echo.

if not exist "db" mkdir "db"
if not exist "public\uploads" mkdir "public\uploads"
if not exist "public\uploads\documents" mkdir "public\uploads\documents"

echo ==========================================
echo Limpiando cache local...
echo ==========================================
if exist ".next" rmdir /s /q ".next"
if exist "node_modules\.cache" rmdir /s /q "node_modules\.cache"

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm no esta disponible en este equipo.
  exit /b 1
)

echo ==========================================
echo Instalando dependencias...
echo ==========================================
call npm install
if errorlevel 1 exit /b 1

echo ==========================================
echo Preparando base de datos...
echo ==========================================
call npm run db:generate
if errorlevel 1 exit /b 1

call npm run db:push
if errorlevel 1 exit /b 1

call npm run db:seed
if errorlevel 1 exit /b 1

echo ==========================================
echo Iniciando servidor de desarrollo...
echo ==========================================
call npm run dev
endlocal
