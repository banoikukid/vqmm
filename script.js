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

// Wheel configuration: 8 Slices (Gold & Deep Blue aesthetic)
const slices = [
    { text: 'Giải Nhất 🥇', color: '#fbbf24', type: 'first' }, // Gold
    { text: 'Chúc may mắn', color: '#1e3a8a', type: 'miss' }, // Deep Blue
    { text: 'Giải Nhì 🥈', color: '#93c5fd', type: 'second' }, // Light Blue
    { text: 'Chúc may mắn', color: '#0f172a', type: 'miss' }, // Very Dark Blue
    { text: 'Chúc may mắn', color: '#1e3a8a', type: 'miss' }, // Deep Blue
    { text: 'Giải Nhì 🥈', color: '#93c5fd', type: 'second' }, // Light Blue
    { text: 'Chúc may mắn', color: '#0f172a', type: 'miss' }, // Very Dark Blue
    { text: 'Chúc may mắn', color: '#1e3a8a', type: 'miss' }  // Deep Blue
];

const totalSlices = slices.length;
const arc = Math.PI * 2 / totalSlices;
let currentRotation = 0;
let isSpinning = false;
let currentWinners = [];
let currentState = { firstPrizeWon: false, secondPrizeCount: 0 };

const defaultBanners = [
    {
        imageUrl: "https://images.unsplash.com/photo-1558160074-4d7d8bdf4256?q=80&w=2070&auto=format&fit=crop",
        headline: "<span class='highlight-blue'>FUN FRESH</span><br>FRIENDLY",
        subheadline: "Thưởng thức trà sữa Matcha tươi mát siêu cuốn, mang đến niềm vui và năng lượng tích cực cho cả ngày dài!",
        buttonText: "Đặt Món Ngay"
    },
    {
        imageUrl: "https://images.unsplash.com/photo-1576092762791-dd9e22205948?q=80&w=2070&auto=format&fit=crop",
        headline: "<span class='highlight-blue'>HƯƠNG VỊ</span><br>NGUYÊN BẢN",
        subheadline: "Sự kết hợp hoàn hảo giữa trà xanh nguyên lá thượng hạng và trân châu dai giòn sần sật.",
        buttonText: "Xem Menu"
    },
    {
        imageUrl: "https://images.unsplash.com/photo-1598515089851-dceb2929de28?q=80&w=2070&auto=format&fit=crop",
        headline: "<span class='highlight-blue'>FREE ƯU ĐÃI</span><br>CHO THÀNH VIÊN",
        subheadline: "Trở thành hội viên TeaNgon ngay hôm nay để nhận được hàng ngàn voucher và dễ dàng đổi điểm lấy quà siêu to.",
        buttonText: "Đăng Ký Khách Hàng"
    }
];

// Initialize
async function init() {
    await initBanners();
    await fetchHotProducts();
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

async function initBanners() {
    const bannerRef = ref(db, 'config/banners');
    try {
        const snapshot = await get(bannerRef);
        let banners = [];
        if (snapshot.exists()) {
            banners = snapshot.val();
        } else {
            // Seed DB with defaults if emptiness
            await set(bannerRef, defaultBanners);
            banners = defaultBanners;
        }
        renderBanners(banners);
    } catch (e) {
        console.error("Failed to load banners from DB, falling back to default.", e);
        renderBanners(defaultBanners);
    }
}

function renderBanners(banners) {
    const bannerWrapper = document.getElementById('bannerWrapper');
    if (!bannerWrapper) return;
    bannerWrapper.innerHTML = '';

    banners.forEach(b => {
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';
        slide.innerHTML = `
            <div class="slide-bg" style="background-image: url('${b.imageUrl}');"></div>
            <div class="slide-overlay split-overlay"></div>
            <div class="slide-content split-layout">
                <div class="slide-text">
                    <h2 class="slide-headline dark-text">${b.headline}</h2>
                    <p class="slide-subheadline dark-text">${b.subheadline}</p>
                    <button class="slide-btn glow-btn">${b.buttonText}</button>
                </div>
            </div>
        `;
        bannerWrapper.appendChild(slide);
    });

    // Start Swiper AFTER rendering
    new Swiper('.hero-swiper', {
        loop: true,
        autoplay: { delay: 5000, disableOnInteraction: false },
        pagination: { el: '.swiper-pagination', clickable: true },
        navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
        effect: 'fade',
        fadeEffect: { crossFade: true }
    });
}

async function fetchHotProducts() {
    const grid = document.getElementById('hotItemsGrid');
    if (!grid) return;

    try {
        const snapshot = await get(ref(db, 'products'));
        if (snapshot.exists()) {
            const data = snapshot.val();
            let products = Object.keys(data).map(key => ({ id: key, ...data[key] }));

            // Take the first 4 products
            const hotProducts = products.slice(0, 4);

            grid.innerHTML = '';
            hotProducts.forEach((p, index) => {
                const imgUrl = p.imageUrl || "https://images.unsplash.com/photo-1556881286-fc6915169721?q=80&w=1974&auto=format&fit=crop";
                grid.innerHTML += `
                    <div class="hot-card">
                        <div class="hot-badge">Hot 🔥</div>
                        <img src="${imgUrl}" alt="${p.name}">
                        <div class="hot-info">
                            <h3>${p.name}</h3>
                            <p class="hot-desc">Món uống được yêu thích tại TeaNgon.</p>
                            <div class="hot-price-row">
                                <span class="hot-price">${parseInt(p.price).toLocaleString('vi-VN')}đ</span>
                                <a href="order.html" class="hot-btn">Mua ngay</a>
                            </div>
                        </div>
                    </div>
                `;
            });
        } else {
            grid.innerHTML = '<p style="text-align:center; grid-column: 1 / -1; color: var(--text-muted);">Hiện chưa có Món nào để hiển thị.</p>';
        }
    } catch (e) {
        console.error("Error fetching hot products:", e);
        grid.innerHTML = '<p style="text-align:center; grid-column: 1 / -1; color: red;">Lỗi tải dữ liệu Món.</p>';
    }
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
        // Set contrasting text colors based on background
        ctx.fillStyle = (slice.color === '#fbbf24' || slice.color === '#93c5fd') ? '#020617' : '#e2e8f0';
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
        if (result.targetType === 'first') {
            const winSound = document.getElementById('winSound');
            if (winSound) {
                winSound.currentTime = 0;
                winSound.play().catch(e => console.log('Audio autoplay blocked', e));
            }
            fireFireworks(); // Special fireworks for 1st prize
            modalTitle.textContent = 'CHÚC MỪNG BẠN ĐÃ ĐẠT GIẢI NHẤT!';
            modalTitle.style.fontSize = '2rem';
        } else {
            fireConfetti(); // Normal confetti for 2nd prize
            modalTitle.textContent = '🎉 CHÚC MỪNG 🎉';
            modalTitle.style.fontSize = '2.5rem';
        }

        modalTitle.style.background = 'linear-gradient(to right, #fbbf24, #fcd34d)';
        modalTitle.style.webkitBackgroundClip = 'text';
        modalDesc.innerHTML = `${user.name} đã trúng<br><strong style="color: #fbbf24; font-size: 1.5rem;">${result.slice.text}</strong>!`;
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

function fireFireworks() {
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };

    function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function () {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
            return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);

        confetti(Object.assign({}, defaults, {
            particleCount,
            origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        }));
        confetti(Object.assign({}, defaults, {
            particleCount,
            origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        }));
    }, 250);
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
