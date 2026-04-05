@echo off
REM GioHomeStudio — Fast test runner
REM Run from project root. App must be running on port 3200.
REM NO Claude/API credits used — pure Playwright against your local server.

set MODE=%1

if "%MODE%"=="api"        goto api
if "%MODE%"=="commercial" goto commercial
if "%MODE%"=="pages"      goto pages
if "%MODE%"=="ui"         goto ui
if "%MODE%"=="report"     goto report
goto all

:all
echo Running ALL tests...
npx playwright test
goto end

:api
echo Running API-only tests (faster, no browser)...
npx playwright test --grep "GET|POST|PATCH|DELETE|Commercial:|Mode 2:|Render"
goto end

:commercial
echo Running Commercial module tests...
npx playwright test --grep "Commercial|Mode 2|Render"
goto end

:pages
echo Running dashboard page load tests...
npx playwright test --grep "UI:"
goto end

:ui
echo Running all tests WITH browser visible...
npx playwright test --headed
goto end

:report
echo Opening last test report...
npx playwright show-report
goto end

:end
