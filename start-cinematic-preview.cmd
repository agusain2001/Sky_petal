@echo off
cd /d "%~dp0"
set "DATABASE_DIR=%CD%\data\cinematic-preview"
set "SKY_PETAL_BUILD_DIR=.next-cinematic-dev"
node node_modules\next\dist\bin\next dev --hostname 127.0.0.1 --port 4318
