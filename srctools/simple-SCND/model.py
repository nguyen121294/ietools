import pulp
import json

def solve_scnd(data_path='data.json', data = None):
    """
    Giải bài toán Supply Chain Network Design 3 cấp:
    - Plants (nhà máy) → Warehouses (kho tiềm năng) → Customers (khách hàng)
    Mục tiêu: Tối thiểu tổng chi phí (fixed cost mở kho + chi phí vận chuyển)
    Quyết định: Mở kho nào (binary), luồng hàng từ plant → kho → customer
    """

    # Đọc dữ liệu
    if data is not None:
        # Dùng data dict được truyền trực tiếp (từ Streamlit)
        pass  # không cần làm gì thêm
    else:
        # Đọc từ file nếu không có data
        try:
            with open(data_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            return {"status": "error", "message": f"Không đọc được file: {str(e)}"}
    
    
    plants = data['plants']
    warehouses = data['warehouses']
    customers = data['customers']

    P = list(plants.keys())
    W = list(warehouses.keys())
    C = list(customers.keys())

    # Tạo mô hình MIP (Mixed Integer Programming)
    prob = pulp.LpProblem("Supply_Chain_Network_Design_3Tier", pulp.LpMinimize)

    # Biến quyết định
    # y_w: 1 nếu mở kho w, 0 nếu không
    y = pulp.LpVariable.dicts("Open", W, cat="Binary")

    # x_pw: luồng từ plant p đến warehouse w
    x_pw = pulp.LpVariable.dicts("Flow_PW", (P, W), lowBound=0, cat="Continuous")

    # x_wc: luồng từ warehouse w đến customer c
    x_wc = pulp.LpVariable.dicts("Flow_WC", (W, C), lowBound=0, cat="Continuous")

    # Objective: Min chi phí
    prob += (
        # Chi phí fixed mở kho
        pulp.lpSum(warehouses[w]["fixed_cost"] * y[w] for w in W)
        # Chi phí vận chuyển plant → warehouse
        + pulp.lpSum(plants[p]["cost_to_w"][w] * x_pw[p][w] for p in P for w in W)
        # Chi phí vận chuyển warehouse → customer
        + pulp.lpSum(warehouses[w]["cost_to_c"][c] * x_wc[w][c] for w in W for c in C)
    )

    # Ràng buộc
    # 1. Capacity nhà máy
    for p in P:
        prob += pulp.lpSum(x_pw[p][w] for w in W) <= plants[p]["capacity"], f"Cap_Plant_{p}"

    # 2. Capacity kho (chỉ nếu mở)
    for w in W:
        inflow = pulp.lpSum(x_pw[p][w] for p in P)
        outflow = pulp.lpSum(x_wc[w][c] for c in C)
        prob += inflow <= warehouses[w]["capacity"] * y[w], f"Cap_Warehouse_In_{w}"
        prob += outflow <= warehouses[w]["capacity"] * y[w], f"Cap_Warehouse_Out_{w}"

    # 3. Flow balance tại kho: inflow = outflow
    for w in W:
        prob += (
            pulp.lpSum(x_pw[p][w] for p in P) == pulp.lpSum(x_wc[w][c] for c in C),
            f"Balance_{w}"
        )

    # 4. Đáp ứng đầy đủ demand khách hàng
    for c in C:
        prob += (
            pulp.lpSum(x_wc[w][c] for w in W) == customers[c]["demand"],
            f"Demand_{c}"
        )

    # Solve
    # Ưu tiên HiGHS nếu có, fallback CBC (default của PuLP)
    status = prob.solve(pulp.PULP_CBC_CMD(msg=0))  # msg=0 để tắt log chi tiết

    # Kết quả
    if pulp.LpStatus[prob.status] != "Optimal":
        return {"status": "error", "message": pulp.LpStatus[prob.status]}

    result = {
        "status": "optimal",
        "total_cost": pulp.value(prob.objective),
        "opened_warehouses": [w for w in W if pulp.value(y[w]) > 0.5],
        "flows_pw": {
            f"{p}-{w}": round(pulp.value(x_pw[p][w]), 2)
            for p in P for w in W if pulp.value(x_pw[p][w]) > 0.01
        },
        "flows_wc": {
            f"{w}-{c}": round(pulp.value(x_wc[w][c]), 2)
            for w in W for c in C if pulp.value(x_wc[w][c]) > 0.01
        }
    }

    return result


# Test nhanh khi chạy file trực tiếp
if __name__ == "__main__":
    result = solve_scnd()
    print("Kết quả:")
    print(json.dumps(result, indent=2, ensure_ascii=False))