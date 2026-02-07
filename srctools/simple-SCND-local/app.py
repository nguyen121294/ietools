import streamlit as st
import json
import pandas as pd
import matplotlib.pyplot as plt
from model import solve_scnd

st.set_page_config(page_title="Supply Chain Network Design", layout="wide")
st.title("Công Cụ Thiết Kế Mạng Lưới Chuỗi Cung Ứng (3 tầng: Nhà máy → Kho → Khách hàng)")
st.markdown("Mục tiêu: Tối thiểu hóa tổng chi phí (chi phí cố định mở kho + chi phí vận chuyển). Dữ liệu mẫu nằm trong `data.json`.")

# Phần upload hoặc dùng default
col1, col2 = st.columns([3, 1])
with col1:
    uploaded_file = st.file_uploader("Upload file data.json (nếu bạn có dữ liệu riêng)", type="json")
    
    data = None
    if uploaded_file is not None:
        try:
            data = json.load(uploaded_file)
            st.success("Đã đọc thành công file upload!")
        except Exception as e:
            st.error(f"Lỗi đọc file: {e}")
    else:
        try:
            with open('data.json', 'r', encoding='utf-8') as f:
                data = json.load(f)
            st.info("Đang dùng dữ liệu mẫu mặc định từ data.json")
        except FileNotFoundError:
            st.error("Không tìm thấy file data.json trong thư mục!")

with col2:
    if data:
        st.markdown("**Sẵn sàng chạy** ✅")
    else:
        st.markdown("**Chưa có dữ liệu** ❌")

# Nút chạy
if data and st.button("Chạy Tối Ưu Hóa", type="primary", use_container_width=True):
    with st.spinner("Đang giải mô hình tối ưu (có thể mất 5-30 giây tùy máy)..."):
        result = solve_scnd(data=data)
        
        if result.get("status") == "optimal":
            st.success(f"**Tối ưu thành công!** Tổng chi phí: **${result['total_cost']:,.2f}**")
            
            st.subheader("Các kho được mở")
            opened = result["opened_warehouses"]
            if opened:
                st.write(", ".join(opened))
            else:
                st.info("Không mở kho nào – kiểm tra ràng buộc hoặc dữ liệu")
            
            # Bảng Plant → Warehouse
            st.subheader("Luồng hàng từ Nhà máy → Kho")
            if result["flows_pw"]:
                df_pw = pd.DataFrame([
                    {"Nhà máy": k.split("-")[0], "Kho": k.split("-")[1], "Lượng": v}
                    for k, v in result["flows_pw"].items()
                ])
                st.dataframe(df_pw.style.format({"Lượng": "{:.1f}"}), use_container_width=True)
            else:
                st.info("Không có luồng nào")
            
            # Bảng Warehouse → Customer
            st.subheader("Luồng hàng từ Kho → Khách hàng")
            if result["flows_wc"]:
                df_wc = pd.DataFrame([
                    {"Kho": k.split("-")[0], "Khách hàng": k.split("-")[1], "Lượng": v}
                    for k, v in result["flows_wc"].items()
                ])
                st.dataframe(df_wc.style.format({"Lượng": "{:.1f}"}), use_container_width=True)
            else:
                st.info("Không có luồng nào")
            
            # Biểu đồ
            st.subheader("Tổng lượng xuất từ từng Nhà máy")
            plant_flows = {}
            for k, v in result["flows_pw"].items():
                p = k.split("-")[0]
                plant_flows[p] = plant_flows.get(p, 0) + v
            if plant_flows:
                fig, ax = plt.subplots()
                ax.bar(plant_flows.keys(), plant_flows.values(), color='skyblue')
                ax.set_ylabel("Tổng lượng")
                ax.set_xlabel("Nhà máy")
                st.pyplot(fig)
            else:
                st.info("Không có dữ liệu để vẽ biểu đồ")
        else:
            st.error(f"Lỗi giải mô hình: {result.get('message', 'Không tìm thấy giải pháp khả thi')}")