@echo off
chcp 65001 >nul
title Cong Cu Thiet Ke Chuoi Cung Ung - Local

cd /d %~dp0

echo.
echo ================================================
echo   DANG CAI DAT CAC GOI CAN THIET (chi lan dau)
echo   Co the mat 2-10 phut tuy may va mang
echo   Vui long cho den khi hoan tat...
echo ================================================
echo.

python -m pip install --upgrade pip
python -m pip install -r requirements.txt

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo LOI: Khong the cai dat goi. Kiem tra ket noi mang hoac Python da cai chua.
    pause
    exit /b
)

echo.
echo ================================================
echo        CAI DAT XONG! Dang mo ung dung...
echo   Trinh duyet se tu dong mo (localhost:8501)
echo ================================================
echo.

streamlit run app.py --server.port 8501 --server.headless true

pause