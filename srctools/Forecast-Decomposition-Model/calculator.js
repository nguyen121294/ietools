let myChart = null;
let currentData = { raw: [], labels: [], full: [] };

// --- CORE: DECOMPOSITION FORECASTING ENGINE ---
function decompositionForecast(data, L, nF) {
    const n = data.length;
    if (n < L) return [];

    // 1. TÍNH TREND BẰNG LINEAR REGRESSION (y = at + b)
    let sumT = 0, sumY = 0, sumTY = 0, sumT2 = 0;
    for (let t = 0; t < n; t++) {
        sumT += t;
        sumY += data[t];
        sumTY += t * data[t];
        sumT2 += t * t;
    }
    const a = (n * sumTY - sumT * sumY) / (n * sumT2 - sumT * sumT); // Độ dốc
    const b = (sumY - a * sumT) / n; // Điểm cắt

    // 2. TÍNH CHỈ SỐ MÙA VỤ (SEASONAL INDICES)
    // Tính tỷ lệ Thực tế / Trend
    let ratios = data.map((y, t) => y / (a * t + b));
    
    // Trung bình tỷ lệ cho từng vị trí trong chu kỳ L
    let seasonalIndices = new Array(L).fill(0);
    let counts = new Array(L).fill(0);
    
    for (let t = 0; t < n; t++) {
        seasonalIndices[t % L] += ratios[t];
        counts[t % L]++;
    }
    
    // Chuẩn hóa Seasonal Indices
    seasonalIndices = seasonalIndices.map((val, i) => val / counts[i]);
    const avgSeasonal = seasonalIndices.reduce((s, v) => s + v, 0) / L;
    seasonalIndices = seasonalIndices.map(v => v / avgSeasonal);

    // 3. TỔNG HỢP DỰ BÁO
    let fullResult = [];
    
    // Giá trị fitted (quá khứ)
    for (let t = 0; t < n; t++) {
        fullResult.push((a * t + b) * seasonalIndices[t % L]);
    }
    
    // Giá trị dự báo (tương lai)
    for (let m = 0; m < nF; m++) {
        let tFuture = n + m;
        let forecastVal = (a * tFuture + b) * seasonalIndices[tFuture % L];
        fullResult.push(forecastVal);
    }

    return {
        results: fullResult,
        slope: a,
        intercept: b,
        seasons: seasonalIndices
    };
}

// --- UI & FILE HANDLING ---
function downloadTemplate() {
    const data = [["Period", "Value"], ["W1", 100], ["W2", 120], ["W3", 110], ["W4", 150], ["W5", 105], ["W6", 125], ["W7", 115], ["W8", 155]];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Decomposition_Template.xlsx");
}

function calculateForecast() {
    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files[0]) return alert("Vui lòng tải lên file Excel!");

    const L = parseInt(document.getElementById('seasonLen').value) || 4;
    const nF = parseInt(document.getElementById('forecastPoints').value) || 4;

    const reader = new FileReader();
    reader.onload = (e) => {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws);
        
        const raw = json.map(r => parseFloat(r.Value || r.value || 0));
        const labels = json.map((r, i) => r.Period || r.period || `Kỳ ${i+1}`);

        if (raw.length < L) return alert(`Cần ít nhất ${L} điểm dữ liệu.`);

        const model = decompositionForecast(raw, L, nF);
        renderUI(raw, labels, model, nF);
    };
    reader.readAsBinaryString(fileInput.files[0]);
}

function renderUI(raw, labels, model, nF) {
    const { results, slope, intercept } = model;

    // Hiển thị thông số
    document.getElementById('result-summary').classList.remove('hidden');
    document.getElementById('params-output').innerHTML = `
        <div class="flex justify-between"><span>Xu hướng (Trend):</span> <b>${slope > 0 ? 'Tăng' : 'Giảm'}</b></div>
        <div class="flex justify-between"><span>Độ dốc (Slope):</span> <b>${slope.toFixed(2)} đơn vị/kỳ</b></div>
    `;

    // Hiển thị bảng
    const tableBody = document.getElementById('forecastTableBody');
    document.getElementById('table-card').classList.remove('hidden');
    tableBody.innerHTML = "";
    for (let i = raw.length; i < results.length; i++) {
        tableBody.innerHTML += `
            <tr class="border-b border-slate-50 dark:border-slate-800/50">
                <td class="py-3 text-slate-500 font-medium">Dự báo kỳ ${i - raw.length + 1}</td>
                <td class="py-3 text-right font-bold text-primary">${results[i].toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
            </tr>`;
    }

    // Biểu đồ
    const ctx = document.getElementById('forecastChart').getContext('2d');
    if (myChart) myChart.destroy();
    
    const chartLabels = [...labels];
    for(let i=1; i<=nF; i++) chartLabels.push(`Dự báo ${i}`);

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [
                { label: 'Thực tế', data: raw, borderColor: '#137fec', backgroundColor: '#137fec15', fill: true, tension: 0.2 },
                { label: 'Dự báo/Fitted', data: results, borderColor: '#ff4757', borderDash: [5, 5], tension: 0.2 }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            scales: {
                x: { ticks: { color: '#94a3b8' } },
                y: { ticks: { color: '#94a3b8' } }
            }
        }
    });
    currentData = { raw, full: results, labels: chartLabels };
}

function exportExcel() {
    const exportData = currentData.full.map((v, i) => ({
        "Giai đoạn": currentData.labels[i],
        "Giá trị": v.toFixed(2),
        "Loại": i < currentData.raw.length ? "Lịch sử" : "Dự báo"
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dự báo");
    XLSX.writeFile(wb, "Forecast_Decomposition.xlsx");
}