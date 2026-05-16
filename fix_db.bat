@echo off
echo ============================================
echo  GHS — Story QC DB Tables Fix
echo ============================================
echo.
echo Creating 8 new tables (safe: IF NOT EXISTS)...
echo.

set PGPASSWORD=Lmh1231lmh@@
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -p 5432 -U postgres -d giohomestudio -f "%~dp0fix_db.sql"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [OK] Tables created. Running prisma generate...
    echo.
    cd /d "%~dp0"
    call npx prisma generate
    echo.
    echo ============================================
    echo  DONE. Restart your dev server now.
    echo ============================================
) else (
    echo.
    echo [FAIL] psql returned an error. Check output above.
)

echo.
pause
