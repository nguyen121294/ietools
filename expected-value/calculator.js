const rowsContainer = document.getElementById('rows');
const addRowBtn = document.getElementById('addRow');
const result = document.getElementById('result');

function calculateEV() {
    const rows = document.querySelectorAll('.ev-row');

    let ev = 0;
    let totalProbability = 0;

    rows.forEach(row => {
        const value = parseFloat(row.querySelector('.value').value);
        const probability = parseFloat(row.querySelector('.probability').value);

        if (!isNaN(value) && !isNaN(probability)) {
            ev += value * probability;
            totalProbability += probability;
        }
    });

    if (totalProbability > 1.001 || totalProbability < 0.999) {
        result.textContent = `⚠ Tổng xác suất = ${totalProbability.toFixed(2)} (nên = 1)`;
        return;
    }

    result.textContent = `Expected Value: ${ev.toFixed(4)}`;
}

function addRow() {
    const row = document.createElement('div');
    row.className = 'input-group ev-row';

    row.innerHTML = `
        <label>Giá trị (x)</label>
        <input type="number" class="value">

        <label>Xác suất (p)</label>
        <input type="number" class="probability" step="0.01" min="0" max="1">
    `;

    rowsContainer.appendChild(row);

    row.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', calculateEV);
    });
}

// Event
addRowBtn.addEventListener('click', addRow);

// Bắt sự kiện input dòng đầu
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', calculateEV);
});
