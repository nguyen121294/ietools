// calculator.js - [TÊN TOOL]

function calculate() {
    // Lấy giá trị input
    const input1 = parseFloat(document.getElementById('input1').value);
    const input2 = parseFloat(document.getElementById('input2').value);
    // const unit   = document.getElementById('unit').value;  // nếu có select

    const resultEl = document.getElementById('result');
    const detailedEl = document.getElementById('detailed-results');

    // Validation
    if (isNaN(input1) || isNaN(input2) /* || input1 <= 0 */) {
        resultEl.innerHTML = 'Vui lòng nhập đầy đủ các giá trị hợp lệ.';
        resultEl.classList.add('text-red-600');
        detailedEl.innerHTML = '';
        return;
    }

    // Tính toán (thay bằng logic của tool)
    const result = input1 + input2; // ví dụ đơn giản

    // Hiển thị kết quả chính
    resultEl.innerHTML = `
        Kết quả: ${result.toFixed(2)}<br>
        <span class="text-base">Giải thích ngắn...</span>
    `;
    resultEl.classList.remove('text-red-600');

    // Inject chi tiết (bảng, công thức phụ, v.v.)
    detailedEl.innerHTML = `
        <div class="ie-card">
            <h3 class="ie-section-title">Kết quả chi tiết</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 text-sm">
                <!-- Thêm các ô kết quả ở đây -->
            </div>
        </div>
    `;

    // Re-render MathJax nếu có công thức mới
    if (typeof MathJax !== 'undefined') {
        MathJax.Hub.Queue(["Typeset", MathJax.Hub, detailedEl]);
    }
}