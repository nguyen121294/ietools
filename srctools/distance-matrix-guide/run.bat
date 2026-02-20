@echo off
set DATA_DIR=%CD%\data

echo [1/2] Dang kiem tra va khoi dong Valhalla Server...
:: Xoa container cu neu no dang bi loi hoac treo
docker rm -f valhalla-server >nul 2>&1

:: Chay Docker o cua so moi (an de khong lam roi mat)
start "Valhalla Server" docker run -i --name valhalla-server -p 8002:8002 -v "%DATA_DIR%:/data" ghcr.io/valhalla/valhalla:latest valhalla_service /data/valhalla.json 1

echo Dang doi server khoi dong (10 giay)...
timeout /t 10 /nobreak >nul

echo [2/2] Dang kiem tra thu vien Python...
pip install streamlit requests pandas >nul 2>&1

echo Dang khoi chay Streamlit App...
streamlit run app.py

pause