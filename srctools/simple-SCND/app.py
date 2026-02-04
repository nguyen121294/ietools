import streamlit as st
import json
import pandas as pd
import matplotlib.pyplot as plt
from model import solve_scnd  # Import hàm từ model.py

st.set_page_config(page_title="Supply Chain Network Design", layout="wide")

st.title("Supply Chain Network Design Tool (3-tier: Plants → Warehouses → Customers)")
st.markdown("Tối thiểu hóa tổng chi phí (fixed cost mở kho + vận chuyển). Dữ liệu mẫu từ `data.json`.")

# Phần 1: Load data (upload hoặc dùng default)
col1, col2 = st.columns([3, 1])

with col1:
    uploaded_file = st.file_uploader("Upload file data.json (nếu có dữ liệu riêng)", type="json")
    
    if uploaded_file is not None:
        try:
            data = json.load(uploaded_file)
            st.success("Đã load dữ liệu từ file upload!")
        except Exception as e:
            st.error(f"Lỗi đọc file: {e}")
            data = None
    else:
        try:
            with open('data.json', 'r', encoding='utf-8') as f:
                data = json.load(f)
            st.info("Sử dụng dữ liệu mẫu mặc định từ data.json")
        except FileNotFoundError:
            st.error("Không tìm thấy data.json mặc định!")
            data = None

with col2:
    st.markdown("**Sẵn sàng chạy**" if data else "**Chưa có dữ liệu**")

# Nút chạy optimization
if data and st.button("Chạy Tối Ưu Hóa", type="primary", use_container_width=True):
    with st.spinner("Đang giải mô hình MIP... (có thể mất vài giây)"):
        #result = solve_scnd(data_path=None)  # Sửa tạm: truyền data trực tiếp thay path
        result = solve_scnd(data=data)  # Truyền dict data trực tiếp
        # → Vì Streamlit chạy trong memory, ta sẽ sửa model.py sau để nhận dict thay path

        if result.get("status") == "optimal":
            st.success(f"**Tối ưu thành công!** Tổng chi phí: **${result['total_cost']:,.2f}**")

            st.subheader("Kho được mở")
            st.write(", ".join(result["opened_warehouses"]) or "Không mở kho nào (kiểm tra ràng buộc)")

            # Bảng luồng Plant → Warehouse
            st.subheader("Luồng từ Nhà máy → Kho")
            if result["flows_pw"]:
                df_pw = pd.DataFrame([
                    {"Plant": k.split("-")[0], "Warehouse": k.split("-")[1], "Flow": v}
                    for k, v in result["flows_pw"].items()
                ])
                st.dataframe(df_pw.style.format({"Flow": "{:.1f}"}), use_container_width=True)
            else:
                st.info("Không có luồng PW")

            # Bảng luồng Warehouse → Customer
            st.subheader("Luồng từ Kho → Khách hàng")
            if result["flows_wc"]:
                df_wc = pd.DataFrame([
                    {"Warehouse": k.split("-")[0], "Customer": k.split("-")[1], "Flow": v}
                    for k, v in result["flows_wc"].items()
                ])
                st.dataframe(df_wc.style.format({"Flow": "{:.1f}"}), use_container_width=True)
            else:
                st.info("Không có luồng WC")

            # Chart đơn giản: Tổng flow từ plants
            st.subheader("Tổng luồng xuất từ từng Nhà máy")
            plant_flows = {}
            for k, v in result["flows_pw"].items():
                p = k.split("-")[0]
                plant_flows[p] = plant_flows.get(p, 0) + v

            fig, ax = plt.subplots()
            ax.bar(plant_flows.keys(), plant_flows.values(), color='skyblue')
            ax.set_ylabel("Tổng Flow")
            ax.set_xlabel("Nhà máy")
            st.pyplot(fig)

        else:
            st.error(f"Lỗi: {result.get('message', 'Không tìm thấy giải pháp tối ưu')}")