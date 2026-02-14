let movingAverageChart = null;

function parseHistoryInput(input) {
    return input
        .split(",")
        .map(v => parseFloat(v.trim()))
        .filter(v => !Number.isNaN(v));
}

function average(values) {
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calculateMovingAverageForecast() {
    const resultEl = document.getElementById("result");
    const tableBody = document.getElementById("forecastTableBody");

    const historyRaw = document.getElementById("historyInput").value;
    const windowSize = parseInt(document.getElementById("windowSize").value, 10);
    const forecastPeriods = parseInt(document.getElementById("forecastPeriods").value, 10);

    const history = parseHistoryInput(historyRaw);

    if (history.length < 2) {
        resultEl.innerHTML = "Vui lòng nhập ít nhất 2 điểm dữ liệu lịch sử.";
        resultEl.classList.add("text-red-600");
        tableBody.innerHTML = "";
        if (movingAverageChart) movingAverageChart.destroy();
        return;
    }

    if (Number.isNaN(windowSize) || windowSize < 2 || windowSize > history.length) {
        resultEl.innerHTML = "Window size phải >= 2 và <= số điểm dữ liệu lịch sử.";
        resultEl.classList.add("text-red-600");
        tableBody.innerHTML = "";
        if (movingAverageChart) movingAverageChart.destroy();
        return;
    }

    if (Number.isNaN(forecastPeriods) || forecastPeriods < 1) {
        resultEl.innerHTML = "Số kỳ dự báo phải >= 1.";
        resultEl.classList.add("text-red-600");
        tableBody.innerHTML = "";
        if (movingAverageChart) movingAverageChart.destroy();
        return;
    }

    const series = [...history];
    const forecastValues = [];

    for (let i = 0; i < forecastPeriods; i++) {
        const recentWindow = series.slice(series.length - windowSize);
        const nextForecast = average(recentWindow);
        forecastValues.push(nextForecast);
        series.push(nextForecast);
    }

    const firstForecast = forecastValues[0];
    resultEl.innerHTML = `Dự báo kỳ kế tiếp: <strong>${firstForecast.toFixed(2)}</strong>`;
    resultEl.classList.remove("text-red-600");

    tableBody.innerHTML = "";
    forecastValues.forEach((value, idx) => {
        const row = document.createElement("tr");
        row.className = "border-b border-slate-50 dark:border-slate-800/50";
        row.innerHTML = `
            <td class="py-2 font-medium">Dự báo kỳ ${idx + 1}</td>
            <td class="py-2 text-right font-semibold text-primary">${value.toFixed(2)}</td>
        `;
        tableBody.appendChild(row);
    });

    const labels = [];
    for (let i = 1; i <= history.length; i++) labels.push(`Lịch sử ${i}`);
    for (let i = 1; i <= forecastPeriods; i++) labels.push(`Dự báo ${i}`);

    const historyDataset = [...history, ...new Array(forecastPeriods).fill(null)];
    const forecastDataset = [...new Array(history.length - 1).fill(null), history[history.length - 1], ...forecastValues];

    const ctx = document.getElementById("forecastChart").getContext("2d");
    if (movingAverageChart) movingAverageChart.destroy();

    movingAverageChart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Dữ liệu lịch sử",
                    data: historyDataset,
                    borderColor: "#137fec",
                    backgroundColor: "#137fec20",
                    tension: 0.2,
                    fill: false
                },
                {
                    label: "Moving Average Forecast",
                    data: forecastDataset,
                    borderColor: "#ff4757",
                    borderDash: [6, 6],
                    tension: 0.2,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { ticks: { color: "#94a3b8" } },
                y: { ticks: { color: "#94a3b8" } }
            }
        }
    });
}
