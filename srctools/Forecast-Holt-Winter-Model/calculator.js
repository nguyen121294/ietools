/**
 * CALCULATOR.JS - HOLT-WINTERS FORECASTING ENGINE
 * Đã sửa lỗi NA khi kỳ dự báo dài hơn chu kỳ (n > L)
 */

let myChart = null;
let currentData = { raw: [], labels: [], full: [] };

// --- 1. THUẬT TOÁN HOLT-WINTERS (TRIPLE EXPONENTIAL SMOOTHING) ---
function holtWinters(data, alpha, beta, gamma, L, nF) {
    if (!data || data.length < L) return [];
    
    let result = [];
    
    // Khởi tạo Level (Mức độ), Trend (Xu hướng) và Seasonality (Mùa vụ)
    let level = data[0];
    let trend = (data.length >= L) ? (data[L-1] - data[0]) / (L - 1) : 0;
    
    // Khởi tạo mảng mùa vụ ban đầu (L phần tử)
    let seasons = [];
    for (let i = 0; i < L; i++) {
        seasons[i] = data[i] / (level || 1);
    }

    let levels = [level];
    let trends = [trend];
    // Mảng seasons sẽ được cập nhật liên tục, ta giữ độ dài cố định là L
    // nhưng dùng phép toán modulo để truy cập

    // GIAI ĐOẠN 1: Chạy qua dữ liệu lịch sử để "huấn luyện" các hệ số
    for (let i = 0; i < data.length; i++) {
        let val = data[i];
        let lastL = levels[i];
        let lastT = trends[i];
        let sIdx = i % L; // Chỉ số mùa vụ hiện tại
        let lastS = seasons[sIdx];

        // Công thức Holt-Winters (Multiplicative)
        let nextL = alpha * (val / (lastS || 1)) + (1 - alpha) * (lastL + lastT);
        let nextT = beta * (nextL - lastL) + (1 - beta) * lastT;
        let nextS = gamma * (val / (nextL || 1)) + (1 - gamma) * lastS;

        levels.push(nextL);
        trends.push(nextT);
        seasons[sIdx] = nextS; // Cập nhật lại mùa vụ cho chu kỳ sau

        // Giá trị khớp (fitted value)
        result.push((lastL + lastT) * lastS);
    }

    // GIAI ĐOẠN 2: DỰ BÁO TƯƠNG LAI (Đây là nơi xử lý lỗi NA)
    let lastLevel = levels[levels.length - 1];
    let lastTrend = trends[trends.length - 1];

    for (let m = 1; m <= nF; m++) {
        // i là chỉ số thời gian tuyệt đối trong tương lai
        let i = data.length + m - 1;
        let sIdx = i % L; // XOAY VÒNG CHU KỲ: Lấy lại hệ số mùa vụ đã học được
        
        let forecastValue = (lastLevel + m * lastTrend) * seasons[sIdx];
        result.push(forecastValue);
    }

    return result;
}

// --- 2. NELDER-MEAD OPTIMIZER (Đảm bảo kết quả 10 lần như 1) ---
const Optimizer = {
    loss: (p, data, L) => {
        const [a, b, g] = p;
        if (a < 0 || a > 1 || b < 0 || b > 1 || g < 0 || g > 1) return 1e15;
        const preds = holtWinters(data, a, b, g, L, 0);
        let mse = 0;
        for (let i = 0; i < data.length; i++) mse += Math.pow(data[i] - (preds[i] || 0), 2);
        return mse / data.length;
    },

    solve: function(data, L) {
        // Các điểm bắt đầu cố định để kết quả luôn nhất quán
        const seeds = [[0.2, 0.1, 0.1], [0.5, 0.2, 0.2], [0.8, 0.3, 0.3]];
        let bestP = [0.4, 0.1, 0.1], minLoss = Infinity;

        seeds.forEach(start => {
            let res = this.nelderMead((p) => this.loss(p, data, L), start);
            let l = this.loss(res, data, L);
            if (l < minLoss) { minLoss = l; bestP = res; }
        });
        return bestP;
    },

    nelderMead: function(fn, start) {
        let n = start.length;
        let s = [start];
        for (let i = 0; i < n; i++) {
            let p = [...start]; p[i] += 0.1; s.push(p);
        }
        for (let k = 0; k < 100; k++) {
            s.sort((a, b) => fn(a) - fn(b));
            let b = s[0], w = s[n], c = b.map((v, i) => (v + s[n-1][i]) / 2);
            let r = c.map((v, i) => 2 * v - w[i]);
            if (fn(r) < fn(s[0])) s[n] = r;
            else s[n] = c.map((v, i) => 0.5 * v + 0.5 * w[i]);
        }
        return s[0];
    }
};

// --- 3. GIAO DIỆN & FILE HANDLING ---
function downloadTemplate() {
    const data = [["Period", "Value"], ["W1", 100], ["W2", 120], ["W3", 110], ["W4", 150], ["W5", 160], ["W6", 180], ["W7", 170], ["W8", 210]];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, "Template_Du_Bao.xlsx");
}

function calculateForecast() {
    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files[0]) return alert("Vui lòng chọn file Excel!");

    const L = parseInt(document.getElementById('seasonLen').value) || 4;
    const nF = parseInt(document.getElementById('forecastPoints').value) || 4;

    const reader = new FileReader();
    reader.onload = (e) => {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws);
        
        const raw = json.map(r => parseFloat(r.Value || r.value || 0));
        const labels = json.map((r, i) => r.Period || r.period || `Kỳ ${i+1}`);

        if (raw.length < L) {
            alert(`Dữ liệu quá ngắn! Cần ít nhất ${L} điểm dữ liệu cho chu kỳ này.`);
            return;
        }

        let a = 0.3, b = 0.1, g = 0.1;
        if (document.getElementById('autoOptimize').checked) {
            [a, b, g] = Optimizer.solve(raw, L);
        }

        const fullForecast = holtWinters(raw, a, b, g, L, nF);
        renderUI(raw, labels, fullForecast, a, b, g, nF);
    };
    reader.readAsBinaryString(fileInput.files[0]);
}

function renderUI(raw, labels, full, a, b, g, nF) {
    // Hiển thị thông số
    document.getElementById('result-summary').classList.remove('hidden');
    document.getElementById('params-output').innerHTML = `
        <div class="flex justify-between text-sm"><span>Alpha ($\alpha$):</span> <span class="font-bold text-primary">${a.toFixed(4)}</span></div>
        <div class="flex justify-between text-sm"><span>Beta ($\beta$):</span> <span class="font-bold text-primary">${b.toFixed(4)}</span></div>
        <div class="flex justify-between text-sm"><span>Gamma ($\gamma$):</span> <span class="font-bold text-primary">${g.toFixed(4)}</span></div>
    `;
    if(window.MathJax) MathJax.Hub.Queue(["Typeset", MathJax.Hub, "params-output"]);

    // Hiển thị bảng
    const tableBody = document.getElementById('forecastTableBody');
    document.getElementById('table-card').classList.remove('hidden');
    tableBody.innerHTML = "";
    for (let i = raw.length; i < full.length; i++) {
        tableBody.innerHTML += `
            <tr class="border-b border-slate-50 dark:border-slate-800/50">
                <td class="py-3 text-slate-500 font-medium">Dự báo kỳ ${i - raw.length + 1}</td>
                <td class="py-3 text-right font-bold text-primary">${full[i].toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
            </tr>`;
    }

    // Vẽ biểu đồ
    const ctx = document.getElementById('forecastChart').getContext('2d');
    if (myChart) myChart.destroy();
    
    const chartLabels = [...labels];
    for(let i=1; i<=nF; i++) chartLabels.push(`Dự báo ${i}`);

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [
                { label: 'Thực tế', data: raw, borderColor: '#137fec', backgroundColor: '#137fec15', fill: true, tension: 0.3 },
                { label: 'Dự báo', data: full, borderColor: '#ff4757', borderDash: [5, 5], tension: 0.3, fill: false }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#94a3b8' } } },
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
                y: { ticks: { color: '#94a3b8' }, grid: { color: '#33415533' } }
            }
        }
    });
    currentData = { raw, full, labels: chartLabels };
}

function exportExcel() {
    const exportData = currentData.full.map((v, i) => ({
        "Giai đoạn": currentData.labels[i],
        "Giá trị": v.toFixed(2),
        "Loại": i < currentData.raw.length ? "Thực tế/Fitted" : "Dự báo"
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ket_Qua");
    XLSX.writeFile(wb, "Ket_Qua_Du_Bao.xlsx");
}