/**
 * BALANCING LOGIC ENGINE
 */
window.lastResult = null; 

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

// Hàm solve, optimizeTakt, runBalancing, renderResult giữ nguyên như bạn đã gửi
// CHÚ Ý: Đảm bảo hàm runBalancing gọi getTasksFromUI()

// 3. Logic giải bài toán (Line Balancing)
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

// 4. HÀM TỐI ƯU TAKT TIME (Hàm bị thiếu của bạn)
function optimizeTakt(tasks, maxTasks) {
    let best = null;
    let minSI = Infinity;
    const minTakt = Math.max(...tasks.map(t => t.time / t.machines));
    const maxTakt = tasks.reduce((a,b) => a + b.time, 0);

    // Quét các giá trị Takt Time để tìm Smoothness Index thấp nhất
    for (let t = minTakt; t <= maxTakt; t += 0.5) {
        let res = solve(tasks, t, maxTasks);
        if (res.stations.length > 0 && res.si < minSI) {
            minSI = res.si;
            best = {...res, takt: t};
        }
    }
    return best;
}

// 5. Điều phối tính toán
/**
 * BALANCING LOGIC - CẬP NHẬT TỐI ƯU HÓA SỐ MÁY
 */

function runBalancing(mode) {
    const tasks = getTasksFromUI();
    if (tasks.length === 0) return alert("Vui lòng thêm công việc!");
    
    const targetTakt = parseFloat(document.getElementById('targetTakt').value);
    const maxTasks = parseInt(document.getElementById('maxTasks').value);
    const sigma = parseFloat(document.getElementById('sigma').value) / 100;

    // --- BƯỚC 1: KIỂM TRA ĐIỀU KIỆN TIÊN QUYẾT (CASE 1) ---
    const invalidTasks = tasks.filter(t => t.cycleTime > targetTakt + 0.001);
    if (invalidTasks.length > 0) {
        const names = invalidTasks.map(t => t.name).join(", ");
        alert(`LỖI: Các công việc [${names}] có Cycle Time > Takt Time mục tiêu. \n\nVui lòng tăng số máy hoặc giảm thời gian công việc.`);
        return;
    }

    // --- BƯỚC 2: CHẠY KẾT QUẢ BAN ĐẦU ---
    let initialResult = solve(tasks, targetTakt, maxTasks);
    window.lastResult = initialResult; // Lưu để xuất excel
    
    document.getElementById('resultsArea').innerHTML = "";
    renderResult(initialResult, "KẾT QUẢ BAN ĐẦU", sigma);

    // --- BƯỚC 3: LOOP TỐI ƯU GIẢM MÁY (MACHINE REDUCTION OPTIMIZER) ---
    if (mode === 'fixed') {
        optimizeMachines(tasks, targetTakt, maxTasks, sigma, initialResult);
    } else {
        // Nếu là mode auto, bạn có thể gọi hàm optimizeTakt cũ hoặc nâng cấp tương tự
        let autoRes = optimizeTakt(tasks, maxTasks);
        renderResult(autoRes, "TỐI ƯU TỔNG THỂ (AUTO)", sigma);
    }

    document.getElementById('btnExportResult').classList.remove('hidden');
}

function optimizeMachines(originalTasks, takt, maxTasks, sigma, initialResult) {
    let currentTasks = JSON.parse(JSON.stringify(originalTasks));
    let improved = false;
    let reductions = [];

    // Thử giảm máy cho từng task (ưu tiên những task có nhiều máy trước)
    for (let i = 0; i < currentTasks.length; i++) {
        while (currentTasks[i].machines > 1) {
            // Giả định giảm 1 máy
            currentTasks[i].machines -= 1;
            currentTasks[i].cycleTime = currentTasks[i].time / currentTasks[i].machines;

            // Kiểm tra xem sau khi giảm, CT có vi phạm Takt không
            if (currentTasks[i].cycleTime <= takt) {
                let testResult = solve(currentTasks, takt, maxTasks);
                
                // Điều kiện để chấp nhận cải tiến: 
                // 1. Hiệu suất (Efficiency) tăng lên hoặc bằng
                // 2. Smoothness Index (SI) không tệ đi quá nhiều (hoặc cải thiện)
                if (testResult.stations.length <= initialResult.stations.length) {
                    reductions.push({
                        task: currentTasks[i].name,
                        from: currentTasks[i].machines + 1,
                        to: currentTasks[i].machines
                    });
                    improved = true;
                    // Cập nhật kết quả tốt nhất hiện tại
                    initialResult = testResult; 
                } else {
                    // Không tốt hơn thì hoàn tác (Rollback)
                    currentTasks[i].machines += 1;
                    currentTasks[i].cycleTime = currentTasks[i].time / currentTasks[i].machines;
                    break;
                }
            } else {
                // Vi phạm Takt thì hoàn tác và dừng giảm cho task này
                currentTasks[i].machines += 1;
                currentTasks[i].cycleTime = currentTasks[i].time / currentTasks[i].machines;
                break;
            }
        }
    }

    if (improved) {
        window.improvedResult = initialResult; // Lưu kết quả cải thiện
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

