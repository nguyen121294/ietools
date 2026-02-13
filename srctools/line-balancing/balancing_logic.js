/**
 * BALANCING LOGIC ENGINE
 */
window.lastResult = null; 
window.improvedResult = null;
var stationChartObj = null;

// Hàm lấy dữ liệu từ bảng UI
function getTasksFromUI() {
    return Array.from(document.querySelectorAll('#taskBody tr')).map(row => {
        const id = parseInt(row.cells[0].innerText);
        const nameInput = row.querySelector('.task-name');
        const timeInput = row.querySelector('.task-time');
        const predsInput = row.querySelector('.task-preds');
        const compatInput = row.querySelector('.task-compat');
        const machinesInput = row.querySelector('.task-machines');
        
        return {
            id: id,
            name: nameInput ? nameInput.value : '',
            time: timeInput ? parseFloat(timeInput.value) || 0 : 0,
            preds: (predsInput && predsInput.value) ? predsInput.value.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v)) : [],
            compat: (compatInput && compatInput.value) ? compatInput.value.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v)) : null,
            machines: machinesInput ? parseInt(machinesInput.value) || 1 : 1,
            cycleTime: (timeInput && machinesInput) ? (parseFloat(timeInput.value) / parseInt(machinesInput.value)) : 0
        };
    });
}

// 3. Logic giải bài toán (Line Balancing RPW)
function solve(tasks, takt, maxTasksPerStation) {
    let unassigned = [...tasks].map(t => ({...t, effTime: t.time / t.machines}));
    let stations = [];
    
    unassigned.forEach(t => {
        let successors = unassigned.filter(s => s.preds.includes(t.id));
        t.rpw = t.effTime + successors.reduce((a, b) => a + b.effTime, 0);
    });

    while (unassigned.length > 0) {
        let currentStation = { tasks: [], load: 0 };
        
        const findCandidates = (station) => {
            return unassigned.filter(t => {
                const predsSatisfied = t.preds.every(p => !unassigned.find(u => u.id === p));
                const timeFit = (station.load + t.effTime) <= (takt + 0.01);
                const countFit = station.tasks.length < maxTasksPerStation;
                const compatibilityFit = station.tasks.every(stTask => {
                    const stTaskAllowsT = !stTask.compat || stTask.compat.includes(t.id);
                    const tAllowsStTask = !t.compat || t.compat.includes(stTask.id);
                    return stTaskAllowsT && tAllowsStTask;
                });
                return predsSatisfied && timeFit && countFit && compatibilityFit;
            }).sort((a, b) => b.rpw - a.rpw);
        };

        let candidates = findCandidates(currentStation);
        if (candidates.length === 0) {
            let readyTasks = unassigned.filter(t => t.preds.every(p => !unassigned.find(u => u.id === p))).sort((a,b) => b.rpw - a.rpw);
            if(readyTasks.length > 0) {
                let forceTask = readyTasks[0];
                stations.push({ tasks: [forceTask], load: forceTask.effTime });
                unassigned = unassigned.filter(u => u.id !== forceTask.id);
            } else break;
            continue;
        }
        while (candidates.length > 0) {
            let selected = candidates[0];
            currentStation.tasks.push(selected);
            currentStation.load += selected.effTime;
            unassigned = unassigned.filter(u => u.id !== selected.id);
            candidates = findCandidates(currentStation);
        }
        stations.push(currentStation);
    }
    const totalTime = tasks.reduce((a, b) => a + (b.time/b.machines), 0);
    const si = Math.sqrt(stations.reduce((acc, s) => acc + Math.pow(takt - s.load, 2), 0) / stations.length);
    return { stations, takt, totalTime, si };
}

// Hàm tối ưu giảm máy (Loop Optimization)
function optimizeMachines(originalTasks, takt, maxTasks, sigma, initialResult) {
    let currentTasks = JSON.parse(JSON.stringify(originalTasks));
    let improved = false;
    let reductions = [];

    // Loop giảm máy
    for (let i = 0; i < currentTasks.length; i++) {
        while (currentTasks[i].machines > 1) {
            currentTasks[i].machines -= 1;
            currentTasks[i].cycleTime = currentTasks[i].time / currentTasks[i].machines;

            if (currentTasks[i].cycleTime <= takt) {
                let testResult = solve(currentTasks, takt, maxTasks);
                
                // Logic so sánh: Tốt hơn về số trạm HOẶC bằng số trạm nhưng Smooth hơn
                if (testResult.stations.length < initialResult.stations.length || 
                   (testResult.stations.length === initialResult.stations.length && testResult.si <= initialResult.si)) {
                    
                    reductions.push({
                        task: currentTasks[i].name,
                        from: currentTasks[i].machines + 1,
                        to: currentTasks[i].machines
                    });
                    improved = true;
                    initialResult = testResult; 
                    window.improvedResult = testResult; 
                } else {
                    currentTasks[i].machines += 1;
                    currentTasks[i].cycleTime = currentTasks[i].time / currentTasks[i].machines;
                    break;
                }
            } else {
                currentTasks[i].machines += 1;
                currentTasks[i].cycleTime = currentTasks[i].time / currentTasks[i].machines;
                break;
            }
        }
    }

    if (improved) {
        let reductionMsg = reductions.map(r => `• ${r.task}: giảm ${r.from} → ${r.to} máy`).join("<br>");
        const improvementHtml = `
            <div class="bg-emerald-900/20 border border-emerald-500 p-4 rounded-lg mb-4">
                <h4 class="text-emerald-400 font-bold mb-2">ĐỀ XUẤT CẢI THIỆN (TIẾT KIỆM MÁY):</h4>
                <div class="text-sm text-emerald-200">${reductionMsg}</div>
            </div>
        `;
        document.getElementById('resultsArea').innerHTML += improvementHtml;
        renderResult(initialResult, "KẾT QUẢ SAU CẢI THIỆN", sigma);
    }
}

// --- LOGIC MỚI: SIMULATION ---
function runSimulation(result) {
    const shiftTimeMinutes = parseFloat(document.getElementById('shiftTime').value) || 480;
    const sigmaPercent = parseFloat(document.getElementById('sigma').value) / 100;
    const shiftTimeSeconds = shiftTimeMinutes * 60;

    // 1. Tìm Trạm Bottleneck (Trạm có tải cao nhất)
    let maxLoad = 0;
    result.stations.forEach(s => {
        if (s.load > maxLoad) maxLoad = s.load;
    });

    // 2. Tính toán thống kê
    // Mean Cycle Time = Bottleneck Load
    const meanCT = maxLoad; 
    
    // Độ lệch chuẩn của trạm Bottleneck (giả định theo sigma input)
    const stdDev = meanCT * sigmaPercent;

    // Cycle Time "An toàn" ở mức 95% tin cậy (Z = 1.645 cho 1 phía)
    // Tức là 95% số sản phẩm sẽ hoàn thành trong thời gian này hoặc nhanh hơn
    const safeCT = meanCT + (1.645 * stdDev);

    // 3. Tính Output
    const meanOutput = Math.floor(shiftTimeSeconds / meanCT);
    const safeOutput = Math.floor(shiftTimeSeconds / safeCT);

    // 4. Render kết quả Simulation
    const simHtml = `
    <div class="ie-card border-l-4 border-purple-500 shadow-xl bg-slate-800 p-6 rounded-xl">
        <h3 class="ie-card-title text-purple-400 underline underline-offset-8 decoration-2 mb-6">KẾT QUẢ MÔ PHỎNG SẢN XUẤT (SIMULATION)</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                <span class="text-xs uppercase font-bold opacity-60 text-slate-300">Bottleneck (Cycle Time)</span>
                <div class="text-3xl font-bold text-white mt-1">${meanCT.toFixed(2)}s</div>
                <div class="text-xs text-slate-400 mt-1">Sigma: ±${(stdDev*3).toFixed(2)}s</div>
            </div>

            <div class="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                <span class="text-xs uppercase font-bold opacity-60 text-amber-400">Output Trung Bình (Mean)</span>
                <div class="text-3xl font-bold text-amber-400 mt-1">${meanOutput} <small class="text-sm">pcs</small></div>
                <div class="text-xs text-slate-400 mt-1">Dựa trên Cycle Time trung bình</div>
            </div>

            <div class="p-4 bg-slate-700/50 rounded-lg border border-purple-500/50">
                <span class="text-xs uppercase font-bold opacity-60 text-purple-400">Output Tin Cậy 95%</span>
                <div class="text-3xl font-bold text-purple-400 mt-1">${safeOutput} <small class="text-sm">pcs</small></div>
                <div class="text-xs text-slate-400 mt-1">Cam kết sản xuất được (95% Confidence)</div>
            </div>
        </div>
        
        <div class="mt-4 text-sm text-slate-400 italic">
            * Tính toán dựa trên thời gian ca: <strong>${shiftTimeMinutes} phút</strong> và độ biến thiên σ: <strong>${(sigmaPercent*100)}%</strong>.
        </div>
    </div>
    `;

    const simArea = document.getElementById('simulationArea');
    simArea.classList.remove('hidden');
    simArea.innerHTML = simHtml;
}


// MAIN FUNCTION: RUN BALANCING
function runBalancing(mode) {
    const tasks = getTasksFromUI();
    if (tasks.length === 0) return alert("Vui lòng thêm công việc!");
    
    let targetTakt = parseFloat(document.getElementById('targetTakt').value);
    const maxTasks = parseInt(document.getElementById('maxTasks').value);
    const sigma = parseFloat(document.getElementById('sigma').value) / 100;

    // Reset vùng hiển thị
    document.getElementById('resultsArea').innerHTML = "";
    document.getElementById('simulationArea').innerHTML = ""; // Reset Simulation
    document.getElementById('simulationArea').classList.add('hidden');
    window.improvedResult = null; 

    // --- LOGIC AUTO MỚI: TỰ TÌM TAKT TIME ---
    if (mode === 'auto') {
        // Tìm Cycle Time lớn nhất trong danh sách (dựa trên số máy hiện tại)
        // CT = Time / Machines
        const maxCT = Math.max(...tasks.map(t => t.cycleTime));
        
        // Gán ngược lại vào ô Input để user thấy
        document.getElementById('targetTakt').value = maxCT;
        targetTakt = maxCT; 
        
        // Mode auto bây giờ thực chất là chạy fixed với Takt = Max CT
    }

    // --- BƯỚC 1: KIỂM TRA ĐIỀU KIỆN TIÊN QUYẾT ---
    const invalidTasks = tasks.filter(t => t.cycleTime > targetTakt + 0.001);
    if (invalidTasks.length > 0) {
        const names = invalidTasks.map(t => t.name).join(", ");
        alert(`LỖI: Các công việc [${names}] có Cycle Time (${invalidTasks[0].cycleTime.toFixed(2)}s) > Takt Time mục tiêu (${targetTakt}s).`);
        return;
    }

    // --- BƯỚC 2: CHẠY KẾT QUẢ BAN ĐẦU ---
    // Luôn dùng hàm solve vì 'auto' đã tìm ra Takt cụ thể rồi
    let initialResult = solve(tasks, targetTakt, maxTasks);
    
    window.lastResult = initialResult;
    renderResult(initialResult, "KẾT QUẢ BAN ĐẦU", sigma);

    document.getElementById('stationChartContainer').classList.remove('hidden');
    drawStationChart(initialResult);

    // --- BƯỚC 3: TỐI ƯU GIẢM MÁY (Luôn chạy cho cả Fixed và Auto) ---
    // Vì 'auto' bản chất là tìm điểm bắt đầu tốt nhất, sau đó vẫn nên thử giảm máy
    optimizeMachines(tasks, targetTakt, maxTasks, sigma, initialResult);
    
    // Nếu có kết quả cải thiện, cập nhật lại biểu đồ
    if (window.improvedResult) {
        drawStationChart(window.improvedResult);
    }

    // --- BƯỚC 4: CHẠY SIMULATION ---
    // Lấy kết quả tốt nhất hiện có (Cải thiện hoặc Ban đầu)
    const finalResult = window.improvedResult ? window.improvedResult : initialResult;
    runSimulation(finalResult);

    document.getElementById('btnExportResult').classList.remove('hidden');
}


function renderResult(data, title, sigma) {
    const eff = (data.totalTime / (data.stations.length * data.takt)) * 100;
    const queueMax = Math.round(data.si * sigma * 10); 

    const html = `
    <div class="ie-card border-l-4 border-[#137fec] shadow-xl">
        <h3 class="ie-card-title text-[#137fec] underline underline-offset-8 decoration-2">${title}</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="p-3 bg-slate-100 dark:bg-slate-800 rounded">
                <span class="text-xs uppercase font-bold opacity-60">Số trạm</span>
                <div class="text-2xl font-bold">${data.stations.length}</div>
            </div>
            <div class="p-3 bg-slate-100 dark:bg-slate-800 rounded">
                <span class="text-xs uppercase font-bold opacity-60">Hiệu suất</span>
                <div class="text-2xl font-bold text-emerald-500">${eff.toFixed(1)}%</div>
            </div>
            <div class="p-3 bg-slate-100 dark:bg-slate-800 rounded">
                <span class="text-xs uppercase font-bold opacity-60">Smoothness</span>
                <div class="text-2xl font-bold text-amber-500">${data.si.toFixed(2)}</div>
            </div>
            <div class="p-3 bg-slate-100 dark:bg-slate-800 rounded">
                <span class="text-xs uppercase font-bold opacity-60">Max Queue</span>
                <div class="text-2xl font-bold text-red-500">${queueMax} <small class="text-xs">pcs</small></div>
            </div>
        </div>
        <div class="space-y-3">
            ${data.stations.map((s, i) => `
                <div class="p-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg flex flex-wrap items-center gap-3">
                    <span class="station-badge bg-[#137fec] text-white p-1 px-3 rounded-full text-xs font-bold">TRẠM ${i+1}</span>
                    <div class="flex-1 font-bold text-sm">
                        ${s.tasks.map(t => `<span class="mr-2 opacity-80">${t.name}</span>`).join(' • ')}
                    </div>
                    <div class="text-right">
                        <div class="text-xs opacity-50 uppercase">Tải trọng</div>
                        <div class="font-bold ${s.load > data.takt ? 'text-red-500' : ''}">${s.load.toFixed(2)}s</div>
                    </div>
                </div>
            `).join('')}
        </div>
    </div>`;
    document.getElementById('resultsArea').innerHTML += html;
}

function drawStationChart(result) {
    const canvas = document.getElementById('stationChart');
    if (!canvas) return;

    if (stationChartObj) stationChartObj.destroy();

    const labels = result.stations.map((_, i) => `Trạm ${i + 1}`);
    const dataLoads = result.stations.map(s => s.load);
    const taktLines = Array(result.stations.length).fill(result.takt);

    stationChartObj = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Tải trọng trạm (s)',
                    data: dataLoads,
                    backgroundColor: dataLoads.map(load => load > result.takt + 0.01 ? '#ef4444' : '#10b981'), 
                    borderRadius: 5,
                    order: 2
                },
                {
                    label: 'Takt Time',
                    data: taktLines,
                    type: 'line',
                    borderColor: '#f59e0b',
                    borderWidth: 2,
                    borderDash: [10, 5],
                    pointRadius: 0,
                    fill: false,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    beginAtZero: true, 
                    grid: { color: '#334155' },
                    ticks: { color: '#cbd5f5' },
                    title: { display: true, text: 'Giây (s)', color: '#cbd5f5' }
                },
                x: { ticks: { color: '#cbd5f5' } }
            },
            plugins: {
                legend: { labels: { color: '#cbd5f5' } },
                tooltip: {
                    callbacks: {
                        afterBody: (context) => {
                            const stationIdx = context[0].dataIndex;
                            const tasks = result.stations[stationIdx].tasks.map(t => t.name).join('\n');
                            return `Công việc:\n${tasks}`;
                        }
                    }
                }
            }
        }
    });
}