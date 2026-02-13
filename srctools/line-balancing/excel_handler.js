/**
 * EXCEL HANDLER & UI MANAGEMENT - FIXED VERSION
 */
var yamazumiChart = null;
var taskCount = 0;

// Dùng DOMContentLoaded thay vì window load để ưu tiên chạy sớm hơn
document.addEventListener('DOMContentLoaded', () => {
    console.log("Hệ thống khởi tạo...");
    
    // Đảm bảo xóa bảng trước khi nạp mẫu
    const tbody = document.getElementById('taskBody');
    if (tbody) tbody.innerHTML = "";
    
    const sampleData = [
        {name: "Lắp bo mạch", time: 12, preds: "", compat: "2,3", machines: 1},
        {name: "Bôi keo tản nhiệt", time: 8, preds: "1", compat: "1", machines: 1},
        {name: "Gắn chip CPU", time: 10, preds: "1", compat: "1", machines: 1}
    ];
    
    taskCount = 0;
    sampleData.forEach(data => addTask(data));
});

function addTask(data = {}) {
    const tbody = document.getElementById('taskBody');
    if (!tbody) return;

    taskCount++;
    const row = document.createElement('tr');
    row.className = "dark:bg-slate-900/40";
    
    const initialTime = parseFloat(data.time) || 0;
    const initialMachines = parseInt(data.machines) || 1;
    const initialCT = (initialTime / initialMachines).toFixed(2);

    row.innerHTML = `
        <td class="p-2 text-center font-bold text-[#137fec]">${taskCount}</td>
        <td><input type="text" class="ie-input-table task-name" value="${data.name || 'Task ' + taskCount}"></td>
        <td><input type="number" class="ie-input-table task-time" oninput="updateCT(this)" value="${initialTime}"></td>
        <td><input type="text" class="ie-input-table task-preds" value="${data.preds || ''}"></td>
        <td><input type="text" class="ie-input-table task-compat" value="${data.compat || ''}"></td>
        <td><input type="number" class="ie-input-table task-machines" oninput="updateCT(this)" value="${initialMachines}"></td>
        <td class="p-2 text-center font-bold text-amber-500 task-ct">${initialCT}</td> 
        <td class="p-2 text-center">
            <button onclick="this.parentElement.parentElement.remove(); drawYamazumi();" class="text-red-500 font-bold">✕</button>
        </td>
    `;
    tbody.appendChild(row);
    
    // Chỉ vẽ biểu đồ nếu hàm drawYamazumi tồn tại và không lỗi
    try { drawYamazumi(); } catch(e) { console.warn("Chưa thể vẽ biểu đồ:", e.message); }
}

function updateCT(input) {
    const row = input.closest('tr');
    const time = parseFloat(row.querySelector('.task-time').value) || 0;
    const machines = parseInt(row.querySelector('.task-machines').value) || 1;
    const ctCell = row.querySelector('.task-ct');
    ctCell.innerText = machines > 0 ? (time / machines).toFixed(2) : "0.00";
    drawYamazumi();
}

function drawYamazumi() {
    if (typeof getTasksFromUI !== 'function') return;
    const tasks = getTasksFromUI();
    const canvas = document.getElementById('yamazumiChart');
    if (!canvas) return;

    // Lấy giá trị Takt Time mục tiêu từ UI
    const targetTakt = parseFloat(document.getElementById('targetTakt').value) || 0;
    
    if (yamazumiChart) yamazumiChart.destroy();

    yamazumiChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: tasks.map(t => t.name),
            datasets: [
                {
                    // Dataset 1: Cột Cycle Time của từng task
                    label: 'Cycle Time (s)',
                    data: tasks.map(t => t.cycleTime),
                    backgroundColor: '#137fec',
                    borderRadius: 5,
                    order: 2
                },
                {
                    // Dataset 2: Đường Takt Time mục tiêu
                    label: 'Target Takt Time',
                    data: Array(tasks.length).fill(targetTakt),
                    type: 'line',
                    borderColor: '#ef4444', // Màu đỏ
                    borderWidth: 3,
                    borderDash: [5, 5],    // Đường nét đứt
                    pointRadius: 0,         // Không hiện điểm nút
                    fill: false,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: { color: '#cbd5f5' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#334155' },
                    ticks: { color: '#cbd5f5' },
                    title: {
                        display: true,
                        text: 'Giây (s)',
                        color: '#cbd5f5'
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#cbd5f5' }
                }
            }
        }
    });
}

// Thêm sự kiện: Khi thay đổi Takt Time ở ô input, biểu đồ tự vẽ lại đường line
document.getElementById('targetTakt').addEventListener('input', drawYamazumi);

// Xử lý Import Excel


const excelInput = document.getElementById('excelFile');


if(excelInput) {
    excelInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(firstSheet);
                
                // Reset bảng
                document.getElementById('taskBody').innerHTML = "";
                taskCount = 0;

                if (rows.length === 0) alert("File Excel trống hoặc sai định dạng!");

                

                // Thay thế đoạn rows.forEach cũ bằng đoạn này:
                rows.forEach((r, index) => {
                    // Hàm tìm giá trị trong object mà không phân biệt hoa thường
                    const getVal = (obj, keys) => {
                        const foundKey = Object.keys(obj).find(k => keys.includes(k.trim().toLowerCase()));
                        return foundKey ? obj[foundKey] : null;
                    };

                    const taskData = {
                        name: getVal(r, ["name", "tên công việc", "tên", "job"]) || `Task ${index + 1}`,
                        time: parseFloat(getVal(r, ["time", "thời gian (s)", "thời gian", "giây"])) || 0,
                        preds: String(getVal(r, ["predecessors", "id trước (pred)", "pred", "trước"]) || ""),
                        compat: String(getVal(r, ["compat_ids", "id ghép chung", "compat", "ghép"]) || ""),
                        machines: parseInt(getVal(r, ["machines", "số máy", "máy"])) || 1
                    };

                    console.log("Đang nạp dòng:", taskData); // Kiểm tra xem có dữ liệu không
                    addTask(taskData);
                });

                console.log("Import thành công " + rows.length + " dòng.");
            } catch (err) {
                console.error("Lỗi đọc Excel:", err);
                alert("Lỗi khi đọc file Excel. Vui lòng kiểm tra lại định dạng.");
            }
            e.target.value = ""; 
        };
        reader.readAsArrayBuffer(file);
    });
}

function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([["ID", "Name", "Time", "Predecessors", "Compat_IDs", "Machines"]]);
    const wb = XLSX.utils.book_new(); 
    XLSX.utils.book_append_sheet(wb, ws, "Tasks");
    XLSX.writeFile(wb, "Line_Balancing_Template.xlsx");
}

function exportResultToExcel() {
    if (!window.lastResult) return alert("Vui lòng tính toán trước khi xuất!");
    const excelData = [
        ["BÁO CÁO PHÂN CHIA CHUYỀN SẢN XUẤT"],
        ["Takt Time:", window.lastResult.takt.toFixed(2) + "s"],
        [],
        ["STT Trạm", "Danh sách công việc", "Tổng thời gian trạm (s)", "Hiệu suất trạm (%)"]
    ];
    window.lastResult.stations.forEach((s, i) => {
        excelData.push([i + 1, s.tasks.map(t => t.name).join(", "), s.load.toFixed(2), ((s.load / window.lastResult.takt) * 100).toFixed(1) + "%"]);
    });
    const ws = XLSX.utils.aoa_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "KetQuaLineBalancing");
    XLSX.writeFile(wb, "Bao_Cao_Line_Balancing.xlsx");
}

function clearAll() { 
    if(confirm("Xóa hết dữ liệu?")) { 
        document.getElementById('taskBody').innerHTML = ""; 
        taskCount = 0; 
        if(yamazumiChart) yamazumiChart.destroy();
    } 
}