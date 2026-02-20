@echo off
set DATA_DIR=%CD%\data

echo [1/3] Tao file cau hinh valhalla.json...
docker run --rm -v "%DATA_DIR%:/data" ghcr.io/valhalla/valhalla:latest valhalla_build_config --mjolnir-tile-dir /data/valhalla_tiles --mjolnir-tile-extract /data/valhalla_tiles.tar --mjolnir-timezone /data/valhalla_tiles/timezones.sqlite --mjolnir-admin /data/valhalla_tiles/admins.sqlite > "%DATA_DIR%\valhalla.json"

echo [2/3] Build tiles tu file PBF...
docker run -t --rm -v "%DATA_DIR%:/data" ghcr.io/valhalla/valhalla:latest valhalla_build_tiles -c /data/valhalla.json /data/vietnam-latest.osm.pbf --overwrite

echo [3/3] Nen tiles vao file tar...
docker run -t --rm -v "%DATA_DIR%:/data" ghcr.io/valhalla/valhalla:latest valhalla_build_extract -c /data/valhalla.json --overwrite

echo XONG! Moi ban chay lenh docker run server de bat dau.
pause