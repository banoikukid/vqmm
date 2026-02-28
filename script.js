import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, push, runTransaction } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAwwtUtwGqXCyvgM4DVRQUsabwrgzjfDyc",
    authDomain: "vqmm-8a365.firebaseapp.com",
    projectId: "vqmm-8a365",
    storageBucket: "vqmm-8a365.firebasestorage.app",
    messagingSenderId: "124482176297",
    appId: "1:124482176297:web:35ae88be0af51c76516338",
    measurementId: "G-QD5NKBYHZV",
    databaseURL: "https://vqmm-8a365-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const canvas = document.getElementById('wheel');
const ctx = canvas.getContext('2d');
const spinBtn = document.getElementById('spinBtn');
const wheelContainer = document.querySelector('.wheel-container');
const messageEl = document.getElementById('message');
const nameInput = document.getElementById('name');
const phoneInput = document.getElementById('phone');
const winnersBody = document.getElementById('winnersBody');

// Modal Elements
const resultModal = document.getElementById('resultModal');
const modalTitle = document.getElementById('modalTitle');
const modalDesc = document.getElementById('modalDesc');
const closeModalBtn = document.getElementById('closeModal');

// Wheel configuration: 8 Slices
const slices = [
    { text: 'Giải Nhất 🥇', color: '#fbbf24', type: 'first' },
    { text: 'Chúc may mắn', color: '#334155', type: 'miss' },
    { text: 'Giải Nhì 🥈', color: '#38bdf8', type: 'second' },
    { text: 'Chúc may mắn', color: '#475569', type: 'miss' },
    { text: 'Chúc may mắn', color: '#1e293b', type: 'miss' },
    { text: 'Giải Nhì 🥈', color: '#38bdf8', type: 'second' },
    { text: 'Chúc may mắn', color: '#475569', type: 'miss' },
    { text: 'Chúc may mắn', color: '#334155', type: 'miss' }
];

const totalSlices = slices.length;
const arc = Math.PI * 2 / totalSlices;
let currentRotation = 0;
let isSpinning = false;
let currentWinners = [];
let currentState = { firstPrizeWon: false, secondPrizeCount: 0 };

// Initialize
function init() {
    drawWheel();

    const todayKey = getTodayKey();

    // Listen to Firebase Realtime Database for today's prize limits
    onValue(ref(db, `prize_state/${todayKey}`), (snapshot) => {
        if (snapshot.exists()) {
            currentState = snapshot.val();
        } else {
            currentState = { firstPrizeWon: false, secondPrizeCount: 0 };
        }
    });

    // Listen to all winners in Firebase securely
    onValue(ref(db, 'winners'), (snapshot) => {
        currentWinners = [];
        snapshot.forEach((childSnapshot) => {
            currentWinners.push(childSnapshot.val());
        });
        // Sort descending by timestamp -> newest at the top
        currentWinners.sort((a, b) => b.timestamp - a.timestamp);
        renderWinnersFromData(currentWinners);
    });
}

function getTodayKey() {
    const today = new Date();
    return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
}

// Draw the wheel on canvas
function drawWheel() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < totalSlices; i++) {
        const slice = slices[i];
        const startAngle = i * arc;
        const endAngle = startAngle + arc;

        ctx.beginPath();
        ctx.fillStyle = slice.color;
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.lineTo(centerX, centerY);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + arc / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = slice.type === 'miss' ? '#94a3b8' : '#0f172a';
        ctx.font = 'bold 20px Outfit, sans-serif';

        if (slice.type !== 'miss') {
            ctx.shadowColor = 'rgba(255,255,255,0.5)';
            ctx.shadowBlur = 5;
        }

        ctx.fillText(slice.text, radius - 30, 8);
        ctx.restore();
    }
}

// Validation
function validateInput() {
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();

    if (!name || !phone) {
        showMessage('Vui lòng nhập đầy đủ Họ tên và Số điện thoại.', 'error');
        return false;
    }

    const phoneRegex = /(84|0[3|5|7|8|9])+([0-9]{8})\b/;
    if (!phoneRegex.test(phone)) {
        showMessage('Số điện thoại không hợp lệ (VD: 0912345678).', 'error');
        return false;
    }

    // Check if phone already played today using global Realtime connection
    const todayStr = new Date().toLocaleDateString('vi-VN');

    if (currentWinners.some(w => w.phone === phone && w.time.includes(todayStr))) {
        showMessage('Số điện thoại này đã tham gia quay số hôm nay!', 'error');
        return false;
    }

    // Check if all prizes for today have been distributed globally
    if (currentState.firstPrizeWon && currentState.secondPrizeCount >= 2) {
        showMessage('Hôm nay tất cả giải thưởng đã được phát. Hẹn bạn ngày mai nhé!', 'error');
        return false;
    }

    hideMessage();
    return { name, phone };
}

function showMessage(msg, type) {
    messageEl.textContent = msg;
    messageEl.className = `message ${type}`;
}

function hideMessage() {
    messageEl.className = 'message hidden';
}

// Spin Animation with Async Firebase Transactions
async function spin() {
    if (isSpinning) return;

    const user = validateInput();
    if (!user) return;

    isSpinning = true;
    spinBtn.disabled = true;

    // 1. Roll locally based on known state (100% win rate for testing)
    let targetType = 'miss';

    // Luôn ưu tiên phát giải nếu còn
    if (!currentState.firstPrizeWon) {
        targetType = 'first';
    } else if (currentState.secondPrizeCount < 2) {
        targetType = 'second';
    }

    // 2. Safely reserve prize in Firebase before spinning to prevent duplication
    if (targetType !== 'miss') {
        const todayKey = getTodayKey();
        const stateRef = ref(db, `prize_state/${todayKey}`);

        try {
            const transactionResult = await runTransaction(stateRef, (state) => {
                if (!state) {
                    state = { firstPrizeWon: false, secondPrizeCount: 0 };
                }

                if (targetType === 'first') {
                    if (state.firstPrizeWon) return; // aborts transaction
                    state.firstPrizeWon = true;
                } else if (targetType === 'second') {
                    if (state.secondPrizeCount >= 2) return; // aborts transaction
                    state.secondPrizeCount = (state.secondPrizeCount || 0) + 1;
                }
                return state;
            });

            if (!transactionResult.committed) {
                targetType = 'miss'; // Prize taken moments before by someone else concurrency!
            }
        } catch (error) {
            console.error("Firebase transaction failed: ", error);
            targetType = 'miss'; // Fallback to miss if DB is unavailable
        }
    }

    // Now securely bind outcome
    const possibleIndexes = [];
    slices.forEach((slice, index) => {
        if (slice.type === targetType) {
            possibleIndexes.push(index);
        }
    });

    const targetIndex = possibleIndexes[Math.floor(Math.random() * possibleIndexes.length)];
    const result = { targetIndex, targetType, slice: slices[targetIndex] };

    // Spin math
    const sliceAngle = 360 / totalSlices;
    const targetSliceCenterAngle = (result.targetIndex * sliceAngle) + (sliceAngle / 2);

    const targetAngle = 270 - targetSliceCenterAngle;
    const randomFriction = (Math.random() * (sliceAngle - 10)) - ((sliceAngle - 10) / 2);
    const finalAngle = targetAngle + randomFriction;

    // Calculate how much we need to rotate to align with finalAngle
    let delta = (finalAngle - (currentRotation % 360));
    if (delta < 0) delta += 360;

    // Add 5 full spins
    const totalRotation = currentRotation + delta + (360 * 5);
    currentRotation = totalRotation;

    wheelContainer.style.transform = `rotate(${totalRotation}deg)`;

    // Wait for animation to finish
    setTimeout(() => {
        isSpinning = false;
        spinBtn.disabled = false;
        handleResult(user, result);
    }, 5000);
}

function handleResult(user, result) {
    if (result.targetType !== 'miss') {
        fireConfetti();

        modalTitle.textContent = '🎉 CHÚC MỪNG 🎉';
        modalTitle.style.background = 'linear-gradient(to right, #fbbf24, #f59e0b)';
        modalTitle.style.webkitBackgroundClip = 'text';
        modalDesc.innerHTML = `${user.name} đã trúng<br><strong>${result.slice.text}</strong>!`;
    } else {
        modalTitle.textContent = 'Rất tiếc!';
        modalTitle.style.background = 'linear-gradient(to right, #94a3b8, #cbd5e1)';
        modalTitle.style.webkitBackgroundClip = 'text';
        modalDesc.innerHTML = `Chúc ${user.name} may mắn lần sau nhé!`;
    }

    // Save history persistently to Firebase
    const maskedPhone = user.phone.substring(0, user.phone.length - 3) + '***';
    const newWinnerRef = push(ref(db, 'winners'));
    set(newWinnerRef, {
        timestamp: Date.now(),
        time: new Date().toLocaleString('vi-VN'),
        name: user.name,
        phone: user.phone,
        maskedPhone: maskedPhone,
        prizeName: result.slice.text,
        type: result.targetType
    });

    // Auto-hide the message after winning if we hit the limit
    if (currentState.firstPrizeWon && currentState.secondPrizeCount >= 2) {
        showMessage('Hôm nay tất cả giải thưởng đã được phát. Hẹn bạn ngày mai nhé!', 'error');
    }

    resultModal.classList.remove('hidden');
}

function fireConfetti() {
    const duration = 3000;
    const end = Date.now() + duration;

    (function frame() {
        confetti({
            particleCount: 5,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#fbbf24', '#38bdf8', '#ec4899']
        });
        confetti({
            particleCount: 5,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#fbbf24', '#38bdf8', '#ec4899']
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
}

closeModalBtn.addEventListener('click', () => {
    resultModal.classList.add('hidden');
    nameInput.value = '';
    phoneInput.value = '';
});

// Realtime Interface Updates
function renderWinnersFromData(winners) {
    winnersBody.innerHTML = '';

    if (winners.length === 0) {
        winnersBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#64748b;">Chưa có lượt dự thưởng nào.</td></tr>';
        return;
    }

    winners.forEach(w => {
        const tr = document.createElement('tr');

        let badgeHtml = w.prizeName;
        if (w.type === 'first') {
            badgeHtml = `<span class="prize-badge first">${w.prizeName}</span>`;
        } else if (w.type === 'second') {
            badgeHtml = `<span class="prize-badge second">${w.prizeName}</span>`;
        } else {
            badgeHtml = `<span style="color: #94a3b8">${w.prizeName}</span>`;
        }

        tr.innerHTML = `
            <td>${w.time}</td>
            <td><strong>${w.name}</strong></td>
            <td>${w.maskedPhone}</td>
            <td>${badgeHtml}</td>
        `;
        winnersBody.appendChild(tr);
    });
}

// Reset Data for Testing (Across Firebase)
const resetDataBtn = document.getElementById('resetDataBtn');
if (resetDataBtn) {
    resetDataBtn.addEventListener('click', async () => {
        if (confirm('Bạn có chắc chắn muốn xóa TOÀN BỘ dữ liệu trên Realtime Database? Hành động này sẽ cập nhật trên tất cả các màn hình!')) {
            try {
                const todayKey = getTodayKey();
                await set(ref(db, `prize_state/${todayKey}`), { firstPrizeWon: false, secondPrizeCount: 0 });
                await set(ref(db, 'winners'), null);
                alert('Đã xóa toàn bộ dữ liệu.');
                // Note: Triggers onValue() cleanly!
            } catch (err) {
                alert('Firebase Error: Bạn chưa cấu hình đúng quyền (Database Rules) hoặc mạng lỗi. \nChi tiết: ' + err.message);
            }
        }
    });
}

// Event Listeners
spinBtn.addEventListener('click', spin);

// Init
init();
