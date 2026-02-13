/**
 * EXCEL HANDLER & UI MANAGEMENT - FINAL VERSION
 */
var yamazumiChart = null;
var taskCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    console.log("Hệ thống khởi tạo...");
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

    const targetTakt = parseFloat(document.getElementById('targetTakt').value) || 0;
    
    if (yamazumiChart) yamazumiChart.destroy();

    yamazumiChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: tasks.map(t => t.name),
            datasets: [
                {
                    label: 'Cycle Time (s)',
                    data: tasks.map(t => t.cycleTime),
                    backgroundColor: '#137fec',
                    borderRadius: 5,
                    order: 2
                },
                {
                    label: 'Target Takt Time',
                    data: Array(tasks.length).fill(targetTakt),
                    type: 'line',
                    borderColor: '#ef4444',
                    borderWidth: 3,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, labels: { color: '#cbd5f5' } }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#334155' },
                    ticks: { color: '#cbd5f5' },
                    title: { display: true, text: 'Giây (s)', color: '#cbd5f5' }
                },
                x: { ticks: { color: '#cbd5f5' } }
            }
        }
    });
}

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
                
                document.getElementById('taskBody').innerHTML = "";
                taskCount = 0;

                if (rows.length === 0) alert("File Excel trống hoặc sai định dạng!");

                rows.forEach((r, index) => {
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
                    addTask(taskData);
                });
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

    const wb = XLSX.utils.book_new();

    // Sheet 1: Kết quả ban đầu
    const sheet1Data = prepareExcelData(window.lastResult, "KẾT QUẢ BAN ĐẦU");
    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
    XLSX.utils.book_append_sheet(wb, ws1, "KetQuaBanDau");

    // Sheet 2: Kết quả cải thiện (nếu có)
    if (window.improvedResult) {
        const sheet2Data = prepareExcelData(window.improvedResult, "KẾT QUẢ CẢI THIỆN");
        const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
        XLSX.utils.book_append_sheet(wb, ws2, "KetQuaCaiThien");
    }

    XLSX.writeFile(wb, "Bao_Cao_Toi_Uu_Line.xlsx");
}

function prepareExcelData(result, title) {
    const data = [
        [title],
        ["Takt Time:", result.takt.toFixed(2) + "s"],
        ["Tổng thời gian:", result.totalTime.toFixed(2) + "s"],
        ["Hiệu suất:", ((result.totalTime / (result.stations.length * result.takt)) * 100).toFixed(1) + "%"],
        [],
        ["STT Trạm", "Danh sách công việc", "Tải trọng (s)", "Số máy tổng"]
    ];
    result.stations.forEach((s, i) => {
        const totalMachines = s.tasks.reduce((sum, t) => sum + t.machines, 0);
        data.push([
            i + 1, 
            s.tasks.map(t => `${t.name} (${t.machines}M)`).join(", "), 
            s.load.toFixed(2), 
            totalMachines
        ]);
    });
    return data;
}

function clearAll() { 
    if(confirm("Xóa hết dữ liệu?")) { 
        document.getElementById('taskBody').innerHTML = ""; 
        taskCount = 0; 
        if(yamazumiChart) yamazumiChart.destroy();
        document.getElementById('resultsArea').innerHTML = "";
        document.getElementById('simulationArea').classList.add('hidden');
    } 
}