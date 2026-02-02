const sideA = document.getElementById('sideA');
const sideB = document.getElementById('sideB');
const sideC = document.getElementById('sideC');
const result = document.getElementById('result');

function calculateArea() {
    const a = parseFloat(sideA.value);
    const b = parseFloat(sideB.value);
    const c = parseFloat(sideC.value);

    if (!a || !b || !c || a <= 0 || b <= 0 || c <= 0) {
        result.textContent = 'Diện tích: -- cm²';
        return;
    }

    if (a + b <= c || a + c <= b || b + c <= a) {
        result.textContent = 'Ba cạnh không tạo thành tam giác';
        return;
    }

    const s = (a + b + c) / 2;
    const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));

    result.textContent = `Diện tích: ${area.toFixed(4)} cm²`;
}

sideA.addEventListener('input', calculateArea);
sideB.addEventListener('input', calculateArea);
sideC.addEventListener('input', calculateArea);
