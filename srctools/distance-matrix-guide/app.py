import streamlit as st
import requests
import json
import pandas as pd

# Cấu hình URL của Valhalla (đảm bảo Docker đang chạy)
VALHALLA_URL = "http://localhost:8002/sources_to_targets"

st.set_page_config(page_title="Valhalla Distance Matrix", layout="wide")

st.title("🚀 Valhalla Local Distance Matrix")
st.markdown("Nhập tọa độ để tính toán ma trận khoảng cách từ dữ liệu OSM nội bộ.")

col1, col2 = st.columns(2)

with col1:
    st.subheader("📍 Điểm bắt đầu (Sources)")
    sources_input = st.text_area(
        "Nhập Lat, Lon (mỗi dòng một điểm)", 
        "21.0285, 105.8542",
        help="Ví dụ: 21.0285, 105.8542",
        key="sources"
    )

with col2:
    st.subheader("🎯 Điểm kết thúc (Targets)")
    targets_input = st.text_area(
        "Nhập Lat, Lon (mỗi dòng một điểm)", 
        "21.0368, 105.8346\n21.0245, 105.8412",
        help="Ví dụ: 21.0368, 105.8346",
        key="targets"
    )

def parse_coords(text):
    coords = []
    for line in text.strip().split('\n'):
        if ',' in line:
            lat, lon = line.split(',')
            coords.append({"lat": float(lat.strip()), "lon": float(lon.strip())})
    return coords

if st.button("⚡ Tính toán Ma trận"):
    try:
        sources = parse_coords(sources_input)
        targets = parse_coords(targets_input)
        
        # Tạo payload theo chuẩn Valhalla
        payload = {
            "sources": sources,
            "targets": targets,
            "costing": "auto",
            "units": "kilometers"
        }

        # Gửi request đến Docker Valhalla
        with st.spinner('Đang tính toán lộ trình...'):
            response = requests.post(VALHALLA_URL, json=payload)
            response.raise_for_status()
            data = response.json()

        # Xử lý kết quả hiển thị bảng
        # Xử lý kết quả hiển thị bảng (Đoạn đã sửa lỗi)
        results = []
        for i, row in enumerate(data['sources_to_targets']):
            for j, matrix_item in enumerate(row):
                # Lấy giá trị an toàn, nếu không có thì để là None
                dist = matrix_item.get('distance')
                time_sec = matrix_item.get('time')

                results.append({
                    "Từ điểm (Index)": matrix_item['from_index'],
                    "Đến điểm (Index)": matrix_item['to_index'],
                    "Khoảng cách (km)": round(dist, 2) if dist is not None else "N/A",
                    "Thời gian (phút)": round(time_sec / 60, 2) if time_sec is not None else "N/A"
                })

        df = pd.DataFrame(results)
        st.success("✅ Đã tính toán xong!")
        st.dataframe(df, use_container_width=True)
        
        # Cho phép tải về CSV
        csv = df.to_csv(index=False).encode('utf-8')
        st.download_button("📥 Tải về kết quả CSV", csv, "distance_matrix.csv", "text/csv")

    except Exception as e:
        st.error(f"❌ Lỗi: {e}")
        st.info("💡 Hãy đảm bảo Docker Valhalla đang chạy tại http://localhost:8002")