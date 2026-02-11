let myChart = null;
let currentData = { raw: [], full: [], labels: [] };

// --- HÀM GIẢI HỆ PHƯƠNG TRÌNH TUYẾN TÍNH (Cho phần AR) ---
function solveLinearSystem(A, b) {
    let n = b.length;
    for (let i = 0; i < n; i++) {
        let pivot = A[i][i];
        if (Math.abs(pivot) < 1e-10) continue;
        for (let j = i + 1; j < n; j++) {
            let factor = A[j][i] / pivot;
            for (let k = i; k < n; k++) A[j][k] -= factor * A[i][k];
            b[j] -= factor * b[i];
        }
    }
    let x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
        let sum = 0;
        for (let j = i + 1; j < n; j++) sum += A[i][j] * x[j];
        if (Math.abs(A[i][i]) > 1e-10) x[i] = (b[i] - sum) / A[i][i];
    }
    return x;
}

// --- THUẬT TOÁN ARIMA CORE ---
function runARIMA(data, p, d, q, nF) {
    // 1. Xử lý Sai phân (d)
    let workingData = [...data];
    let diffHistory = [];
    for (let i = 0; i < d; i++) {
        let nextDiff = [];
        for (let j = 1; j < workingData.length; j++) {
            nextDiff.push(workingData[j] - workingData[j - 1]);
        }
        diffHistory.push(workingData[workingData.length - 1]);
        workingData = nextDiff;
    }

    // Khử trung bình (Mean centering)
    const mean = workingData.reduce((a, b) => a + b, 0) / workingData.length;
    let centered = workingData.map(v => v - mean);

    // 2. Ước lượng AR (p) bằng Yule-Walker
    let phi = [];
    if (p > 0 && centered.length > p) {
        let r = (lag) => {
            let num = 0, den = 0;
            for (let i = 0; i < centered.length; i++) {
                den += Math.pow(centered[i], 2);
                if (i >= lag) num += centered[i] * centered[i - lag];
            }
            return num / (den || 1);
        };
        let R_matrix = Array.from({length: p}, (_, i) => 
            Array.from({length: p}, (_, j) => r(Math.abs(i - j)))
        );
        let r_vector = Array.from({length: p}, (_, i) => r(i + 1));
        phi = solveLinearSystem(R_matrix, r_vector);
    }

    // 3. Dự báo tương lai trên chuỗi đã xử lý
    let forecastDiff = [...centered];
    for (let i = 0; i < nF; i++) {
        let pred = 0;
        for (let j = 0; j < p; j++) {
            pred += phi[j] * forecastDiff[forecastDiff.length - 1 - j];
        }
        forecastDiff.push(pred);
    }

    // 4. Khôi phục về giá trị gốc (Inverse Diff)
    let finalForecast = forecastDiff.map(v => v + mean);
    let results = [...data];
    let futureValues = finalForecast.slice(centered.length);

    for (let i = 0; i < nF; i++) {
        let lastVal = results[results.length - 1];
        results.push(lastVal + futureValues[i]);
    }

    return { full: results, phi };
}

// --- GIAO DIỆN & XỬ LÝ FILE ---
function calculateForecast() {
    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files[0]) return alert("Vui lòng chọn file!");

    const p = parseInt(document.getElementById('p_val').value);
    const d = parseInt(document.getElementById('d_val').value);
    const q = parseInt(document.getElementById('q_val').value);
    const nF = parseInt(document.getElementById('forecastPoints').value);

    const reader = new FileReader();
    reader.onload = (e) => {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws);
        
        const raw = json.map(r => parseFloat(r.Value || r.value || 0));
        const labels = json.map((r, i) => r.Period || r.period || `Kỳ ${i+1}`);

        const model = runARIMA(raw, p, d, q, nF);
        renderUI(raw, labels, model, nF);
    };
    reader.readAsBinaryString(fileInput.files[0]);
}

function renderUI(raw, labels, model, nF) {
    // Hiển thị hệ số
    document.getElementById('result-summary').classList.remove('hidden');
    document.getElementById('params-output').innerHTML = model.phi.length > 0 
        ? model.phi.map((v, i) => `<div>Hệ số AR $\phi_{${i+1}}$: <b>${v.toFixed(4)}</b></div>`).join('')
        : "Mô hình bậc 0";
    if(window.MathJax) MathJax.Hub.Queue(["Typeset", MathJax.Hub, "params-output"]);

    // Bảng kết quả
    const tableBody = document.getElementById('forecastTableBody');
    document.getElementById('table-card').classList.remove('hidden');
    tableBody.innerHTML = "";
    for (let i = raw.length; i < model.full.length; i++) {
        tableBody.innerHTML += `
            <tr class="border-b border-slate-50 dark:border-slate-800/50">
                <td class="py-3 text-slate-500 font-medium">Dự báo T+${i - raw.length + 1}</td>
                <td class="py-3 text-right font-bold text-primary">${model.full[i].toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
            </tr>`;
    }

    // Biểu đồ
    const ctx = document.getElementById('forecastChart').getContext('2d');
    if (myChart) myChart.destroy();
    const chartLabels = [...labels, ...Array.from({length: nF}, (_, i) => `Dự báo ${i+1}`)];

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [
                { label: 'Thực tế', data: raw, borderColor: '#137fec', backgroundColor: '#137fec10', fill: true, tension: 0.3 },
                { label: 'ARIMA Forecast', data: model.full, borderColor: '#ff4757', borderDash: [5, 5], tension: 0.3 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Space Grotesk' } } } },
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
                y: { ticks: { color: '#94a3b8' }, grid: { color: '#33415515' } }
            }
        }
    });
    currentData = { raw, full: model.full, labels: chartLabels };
}

function downloadTemplate() {
    const data = [["Period", "Value"], ["Jan", 100], ["Feb", 120], ["Mar", 110], ["Apr", 130], ["May", 150], ["Jun", 140], ["Jul", 160]];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ARIMA_Template");
    XLSX.writeFile(wb, "ARIMA_Template.xlsx");
}

function exportExcel() {
    const exportData = currentData.full.map((v, i) => ({
        "Giai đoạn": currentData.labels[i],
        "Giá trị": v.toFixed(2),
        "Trạng thái": i < currentData.raw.length ? "Lịch sử" : "Dự báo"
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ARIMA_Results");
    XLSX.writeFile(wb, "ARIMA_Forecast.xlsx");
}