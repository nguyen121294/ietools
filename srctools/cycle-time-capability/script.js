/**
 * script.js - Cycle Time Capability Analysis
 * -----------------------------------------
 * Handles stopwatch, statistics, charts, and risk logic
 */

// --- State ---
let cycles = [];      // Recorded cycle times (seconds)
let isRunning = false;
let timerInterval = null;

// Stopwatch internals (Continuous Timing)
let totalTimeMs = 0;      // Total running time across pauses
let lastLapTimeMs = 0;    // The 'totalTimeMs' at the last LAP click
let sessionStartMs = 0;   // Wall clock when current start/resume was clicked

// --- DOM Elements ---
const timerDisplay = document.getElementById('timer-display');
const btnStartLap = document.getElementById('btn-start-lap');
const btnStopReset = document.getElementById('btn-stop-reset');
const labelStartLap = document.getElementById('label-start-lap');
const labelStopReset = document.getElementById('label-stop-reset');
const cycleList = document.getElementById('cycle-list');
const sampleCount = document.getElementById('sample-count');
const outN = document.getElementById('out-n');
const outMean = document.getElementById('out-mean');
const outSigma = document.getElementById('out-sigma');
const outUcl = document.getElementById('out-ucl');
const outLcl = document.getElementById('out-lcl');
const specTarget = document.getElementById('spec-target');
const specLtl = document.getElementById('spec-ltl');
const specUtl = document.getElementById('spec-utl');
const outCp = document.getElementById('out-cp');
const outCpk = document.getElementById('out-cpk');
const outPercent = document.getElementById('out-percent');
const riskPanel = document.getElementById('risk-panel');
const riskBadge = document.getElementById('risk-badge');
const riskAction = document.getElementById('risk-action');
const outNPrime = document.getElementById('out-n-prime');
const uploadData = document.getElementById('upload-data');

// Chart instances
let distributionChart = null;
let controlChart = null;
let qqChart = null;
let boxChart = null;

// --- Stopwatch Logic ---
function getCurrentTotal() {
    if (!isRunning) return totalTimeMs;
    return totalTimeMs + (Date.now() - sessionStartMs);
}

function tick() {
    const currentTotal = getCurrentTotal();
    timerDisplay.textContent = formatTime(currentTotal / 1000);
}

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

btnStartLap.addEventListener('click', () => {
    const now = Date.now();

    if (!isRunning) {
        // START or RESUME
        isRunning = true;
        sessionStartMs = now;
        timerInterval = setInterval(tick, 50);

        labelStartLap.textContent = 'LAP (VÒNG)';
        labelStopReset.textContent = 'TẠM DỪNG';
        btnStartLap.classList.remove('bg-primary', 'bg-slate-800');
        btnStartLap.classList.add('bg-emerald-600');
    } else {
        // Record the Total Runner Value (Cumulative)
        const currentTotal = getCurrentTotal();
        addCycle(currentTotal / 1000);

        // Visual Feedback
        timerDisplay.classList.add('text-emerald-400', 'scale-105');
        setTimeout(() => timerDisplay.classList.remove('text-emerald-400', 'scale-105'), 150);
    }
});

btnStopReset.addEventListener('click', () => {
    if (isRunning) {
        // PAUSE
        totalTimeMs += (Date.now() - sessionStartMs);
        clearInterval(timerInterval);
        isRunning = false;

        labelStartLap.textContent = 'TIẾP TỤC';
        labelStopReset.textContent = 'RESET';
        btnStartLap.classList.remove('bg-emerald-600');
        btnStartLap.classList.add('bg-primary');
    } else {
        // RESET
        if (cycles.length > 0 || totalTimeMs > 0) {
            if (!confirm('Bạn muốn xóa trắng toàn bộ dữ liệu mẫu và đồng hồ?')) return;
        }

        clearInterval(timerInterval);
        isRunning = false;
        totalTimeMs = 0;
        lastLapTimeMs = 0;
        sessionStartMs = 0;
        cycles = [];

        timerDisplay.textContent = '00:00.00';
        labelStartLap.textContent = 'BẮT ĐẦU';
        labelStopReset.textContent = 'DỪNG';
        btnStartLap.className = 'bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95 flex flex-col items-center justify-center gap-1';

        renderCycleList();
        calculateStats();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        btnStartLap.click();
    } else if (e.code === 'Escape' || e.code === 'KeyR') {
        btnStopReset.click();
    }
});

function addCycle(val) {
    cycles.push(val);
    renderCycleList();
    calculateStats();
}

/**
 * Calculates deltas (split times) from cumulative records
 */
function getDeltas() {
    return cycles.map((t, i) => i === 0 ? t : t - cycles[i - 1]);
}

function renderCycleList() {
    cycleList.innerHTML = '';
    sampleCount.textContent = cycles.length;

    const deltas = getDeltas();

    cycles.slice().reverse().forEach((val, revIdx) => {
        const idx = cycles.length - 1 - revIdx;
        const delta = deltas[idx];

        const div = document.createElement('div');
        div.className = 'grid grid-cols-12 gap-1 items-center text-[11px] py-1.5 border-b border-slate-800/50 hover:bg-slate-800/30 px-2 group';
        div.innerHTML = `
            <div class="col-span-2 text-slate-600 font-bold">#${idx + 1}</div>
            <div class="col-span-4 font-mono text-slate-400">${val.toFixed(2)}s</div>
            <div class="col-span-5 font-mono text-emerald-400 font-bold">${delta.toFixed(2)}s</div>
            <div class="col-span-1 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                <button onclick="removeCycle(${idx})" class="text-red-500 hover:text-red-400 leading-none text-sm">×</button>
            </div>
        `;
        cycleList.appendChild(div);
    });
}

function removeCycle(idx) {
    cycles.splice(idx, 1);
    renderCycleList();
    calculateStats();
}

document.getElementById('btn-clear-data').addEventListener('click', () => {
    if (confirm('Xóa toàn bộ dữ liệu mẫu?')) {
        cycles = [];
        totalTimeMs = 0;
        sessionStartMs = 0;
        lastLapTimeMs = 0;
        timerDisplay.textContent = '00:00.00';
        renderCycleList();
        calculateStats();
    }
});

// --- File Import ---
uploadData.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target.result;
        const rows = text.split(/\r?\n/);
        const newCycles = [];

        rows.forEach(row => {
            const val = parseFloat(row.trim());
            if (!isNaN(val)) newCycles.push(val);
        });

        if (newCycles.length > 0) {
            cycles = [...cycles, ...newCycles];
            renderCycleList();
            calculateStats();
        }
    };
    reader.readAsText(file);
});

// --- Stats Engine ---
function calculateStats() {
    const n = cycles.length;
    outN.textContent = n;

    // Use Deltas for all calculations
    const deltas = getDeltas();

    if (n < 2) {
        resetUI();
        return;
    }

    const mean = deltas.reduce((a, b) => a + b, 0) / n;
    const variance = deltas.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
    const sigma = Math.sqrt(variance);

    const ucl = Math.max(...deltas);
    const validDeltas = deltas.filter(v => v > 0);
    const lcl = validDeltas.length > 0 ? Math.min(...validDeltas) : 0;

    outMean.textContent = mean.toFixed(3) + 's';
    outSigma.textContent = sigma.toFixed(4);
    outUcl.textContent = ucl.toFixed(3);
    outLcl.textContent = lcl.toFixed(3);

    const utl = parseFloat(specUtl.value);
    const ltl = parseFloat(specLtl.value);
    const target = parseFloat(specTarget.value);

    // Initial validations
    if (sigma === 0) {
        showError("Dữ liệu không biến động (Sigma = 0). Kết quả không hợp lệ.");
        return;
    }

    if (!isNaN(utl) && !isNaN(ltl)) {
        if (ltl >= utl) {
            showError("LTL phải nhỏ hơn UTL.");
            return;
        }

        if (!isNaN(target) && (target <= ltl || target >= utl)) {
            showError("Target Mean phải nằm giữa LTL và UTL.");
            return;
        }

        const cp = (utl - ltl) / (6 * sigma);
        const cpu = (utl - mean) / (3 * sigma);
        const cpl = (mean - ltl) / (3 * sigma);
        const cpk = Math.min(cpu, cpl);

        const countOut = deltas.filter(x => x > utl || x < ltl).length;
        const percent = (countOut / n) * 100;

        outCp.textContent = cp.toFixed(2);
        outCpk.textContent = cpk.toFixed(2);
        outPercent.textContent = percent.toFixed(1) + '%';

        applyDecisionLogic(n, mean, sigma, cpk, percent, ltl, utl, target);
    } else {
        outCp.textContent = '--';
        outCpk.textContent = '--';
        outPercent.textContent = '--';
        riskPanel.classList.add('hidden');
    }

    // Recommendation n'
    const sumX = deltas.reduce((a, b) => a + b, 0);
    const sumX2 = deltas.reduce((a, b) => a + b * b, 0);
    const n_prime = Math.pow((40 * Math.sqrt(n * sumX2 - Math.pow(sumX, 2))) / sumX, 2);
    outNPrime.textContent = isFinite(n_prime) ? Math.ceil(n_prime) : '--';

    updateCharts(mean, sigma, ltl, utl, ucl, lcl, deltas);
}

function showError(msg) {
    riskPanel.classList.remove('hidden');
    riskBadge.textContent = "LỖI DỮ LIỆU";
    riskBadge.className = "px-3 py-1 rounded text-xs font-bold uppercase tracking-wider bg-red-900/50 text-red-200 border border-red-500/50";
    riskAction.textContent = msg;
    outCp.textContent = 'ERR';
    outCpk.textContent = 'ERR';
}

function applyDecisionLogic(n, mean, sigma, cpk, outPercent, ltl, utl, target) {
    riskPanel.classList.remove('hidden');
    let risk = '';
    let action = '';
    let colorClass = '';

    const meanOutsideSpec = (!isNaN(ltl) && mean < ltl) || (!isNaN(utl) && mean > utl);

    if (n < 25) {
        risk = "CHƯA ĐỦ DỮ LIỆU";
        action = `Số lượng mẫu (n=${n}) thấp hơn mức tối thiểu 25. Hãy bấm giờ thêm ít nhất ${25 - n} mẫu để kết quả có ý nghĩa thống kê.`;
        colorClass = "bg-slate-700 text-slate-300";
    } else if (cpk >= 1.67 && outPercent === 0) {
        risk = "RỦI RO RẤT THẤP";
        action = "Xuất sắc! Quy trình rất ổn định. Không cần xử lý.";
        colorClass = "bg-emerald-600 text-white";
    } else if (cpk >= 1.33 && outPercent < 1) {
        risk = "RỦI RO THẤP";
        action = "Đạt yêu cầu. Hãy tiếp tục theo dõi xu hướng.";
        colorClass = "bg-blue-600 text-white";
    } else if ((cpk >= 1.0 && cpk < 1.33) || (outPercent >= 1 && outPercent <= 5)) {
        risk = "RỦI RO TRUNG BÌNH";
        action = "Cận biên. Đánh giá kỹ thuật, tìm nguyên nhân gốc rễ.";
        colorClass = "bg-amber-600 text-white";
    } else if (cpk < 1.0 || outPercent > 5 || meanOutsideSpec) {
        risk = "RỦI RO CAO";
        action = "KHÔNG ĐẠT. Điều chỉnh quy trình ngay lập tức và xác nhận lại (re-validation).";
        colorClass = "bg-red-600 text-white";
    }

    riskBadge.textContent = risk;
    riskBadge.className = 'px-3 py-1 rounded text-xs font-bold uppercase tracking-wider ' + colorClass;
    riskAction.textContent = action;
}

function resetUI() {
    outCpk.textContent = '--';
    outCp.textContent = '--';
    outMean.textContent = '--';
    outPercent.textContent = '--';
    riskPanel.classList.add('hidden');
    outNPrime.textContent = '--';
    outSigma.textContent = '--';
    outUcl.textContent = '--';
    outLcl.textContent = '--';
}

// --- Charting ---
function setupCharts() {
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';

    // 1. Distribution Chart
    distributionChart = new Chart(document.getElementById('chart-distribution').getContext('2d'), {
        type: 'bar',
        data: { labels: [], datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { display: false }, ticks: { display: false } },
                x: { grid: { display: false } }
            }
        }
    });

    // 2. Control Chart
    controlChart = new Chart(document.getElementById('chart-control').getContext('2d'), {
        type: 'line',
        data: { labels: [], datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: false } }
        }
    });

    // 3. QQ Plot
    qqChart = new Chart(document.getElementById('chart-qq').getContext('2d'), {
        type: 'scatter',
        data: { datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: 'Theoretical Quantiles' } },
                y: { title: { display: true, text: 'Observed Values' } }
            }
        }
    });

    // 4. Box Plot
    boxChart = new Chart(document.getElementById('chart-boxplot').getContext('2d'), {
        type: 'boxplot',
        data: {
            labels: ['Cycle Times'],
            datasets: [{
                label: 'Data Distribution',
                backgroundColor: 'rgba(19, 127, 236, 0.3)',
                borderColor: '#137fec',
                borderWidth: 1,
                outlierColor: '#f87171',
                padding: 20,
                itemRadius: 2,
                data: []
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}

function updateCharts(mean, sigma, ltl, utl, ucl, lcl, deltas) {
    if (!deltas.length) return;

    // --- Control Chart: Plot Split Times (Deltas) ---
    controlChart.data.labels = deltas.map((_, i) => i + 1);
    controlChart.data.datasets = [
        {
            label: 'Cycle Time/Unit',
            data: deltas,
            borderColor: '#137fec',
            tension: 0.1,
            pointRadius: 4,
            pointBackgroundColor: '#137fec'
        },
        {
            label: 'Mean',
            data: new Array(deltas.length).fill(mean),
            borderColor: 'rgba(255,255,255,0.5)',
            borderDash: [5, 5],
            pointRadius: 0
        },
        {
            label: 'Control Limits',
            data: new Array(deltas.length).fill(ucl),
            borderColor: '#f87171',
            borderDash: [2, 2],
            pointRadius: 0
        },
        {
            label: '',
            data: new Array(deltas.length).fill(lcl),
            borderColor: '#f87171',
            borderDash: [2, 2],
            pointRadius: 0
        }
    ];
    controlChart.update('none');

    // --- Distribution ---
    const sorted = [...deltas].sort((a, b) => a - b);
    const min = Math.min(sorted[0], ltl || sorted[0]) - 1;
    const max = Math.max(sorted[deltas.length - 1], utl || sorted[deltas.length - 1]) + 1;

    // Histogram bins
    const binsCount = 10;
    const binWidth = (max - min) / binsCount;
    const bins = new Array(binsCount).fill(0);
    sorted.forEach(x => {
        let b = Math.floor((x - min) / binWidth);
        if (b === binsCount) b--;
        bins[b]++;
    });

    // Normal Curve points
    const curvePoints = [];
    for (let i = min; i <= max; i += (max - min) / 50) {
        const y = (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((i - mean) / sigma, 2));
        curvePoints.push({ x: i.toFixed(2), y: y * deltas.length * binWidth });
    }

    distributionChart.data.labels = Array.from({ length: binsCount }, (_, i) => (min + (i + 0.5) * binWidth).toFixed(1));
    distributionChart.data.datasets = [
        {
            type: 'bar',
            data: bins,
            backgroundColor: 'rgba(19, 127, 236, 0.3)',
            barPercentage: 1,
            categoryPercentage: 1
        },
        {
            type: 'line',
            data: curvePoints.map(p => p.y),
            borderColor: '#137fec',
            pointRadius: 0,
            tension: 0.4
        }
    ];
    distributionChart.update('none');

    // --- QQ Plot ---
    const n = deltas.length;
    const qqData = sorted.map((val, i) => {
        const p = (i + 1 - 0.5) / n;
        const q = 4.91 * (Math.pow(p, 0.14) - Math.pow(1 - p, 0.14));
        return { x: q, y: val };
    });

    qqChart.data.datasets = [{
        label: 'Samples',
        data: qqData,
        backgroundColor: '#137fec'
    }];
    qqChart.update('none');

    // --- Box Plot ---
    boxChart.data.datasets[0].data = [deltas];
    boxChart.update('none');
}

// --- Export ---
document.getElementById('btn-export').addEventListener('click', () => {
    const deltas = getDeltas();
    if (!deltas.length) return;

    let csvContent = "data:text/csv;charset=utf-8,ID,Record (s),Cycle Time/Unit (s)\n";
    cycles.forEach((v, i) => {
        csvContent += `${i + 1},${v.toFixed(2)},${deltas[i].toFixed(2)}\n`;
    });

    csvContent += `\nSUMMARY,,STATISTICS\n`;
    csvContent += `,Mean,${outMean.textContent}\n`;
    csvContent += `,Sigma,${outSigma.textContent}\n`;
    csvContent += `,Cpk,${outCpk.textContent}\n`;
    csvContent += `,Risk,${riskBadge.textContent}\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `cycle_time_study_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
});

function downloadTemplate() {
    const csvContent = "data:text/csv;charset=utf-8,Cycle Time (s)\n10.50\n11.20\n12.00\n11.80\n10.95\n11.50\n10.80\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "cycle_time_study_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

document.getElementById('btn-download-template')?.addEventListener('click', downloadTemplate);

// Event listeners for inputs to real-time update stats
[specTarget, specLtl, specUtl].forEach(el => {
    el.addEventListener('input', calculateStats);
});

function loadFromLocalStorage() {
    const saved = localStorage.getItem('ietools_cycle_times');
    if (saved) {
        cycles = JSON.parse(saved);
        renderCycleList();
        calculateStats();
    }
}

// Draw buttons event listeners
document.getElementById('btn-draw-control')?.addEventListener('click', calculateStats);
document.getElementById('btn-draw-qq')?.addEventListener('click', calculateStats);

setupCharts();
loadFromLocalStorage();

window.addEventListener('beforeunload', () => {
    localStorage.setItem('ietools_cycle_times', JSON.stringify(cycles));
});
