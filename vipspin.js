import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getDatabase, ref, get, update, push, set, serverTimestamp, runTransaction, onValue, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

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
const auth = getAuth(app);
const database = getDatabase(app);

// VIP Wheel Segments (Sum of degrees = 360)
// Made big prizes visually massive to trigger FOMO, actual odds are backend-controlled.
const vipSegments = [
    { label: "10 Ly Trà Sữa", type: "first", degrees: 40, color: '#fef08a', stroke: '#eab308' },
    { label: "Voucher 5K", type: "third", degrees: 50, color: '#fff1f2', stroke: '#fda4af' },
    { label: "Combo 3 Ly", type: "second", degrees: 40, color: '#bae6fd', stroke: '#0ea5e9' },
    { label: "Voucher 5K", type: "third", degrees: 50, color: '#fefce8', stroke: '#fde047' },
    { label: "10 Ly Trà Sữa", type: "first", degrees: 40, color: '#fef08a', stroke: '#eab308' },
    { label: "Voucher 5K", type: "third", degrees: 50, color: '#fdf4ff', stroke: '#f5d0fe' },
    { label: "Combo 3 Ly", type: "second", degrees: 40, color: '#bae6fd', stroke: '#0ea5e9' },
    { label: "Voucher 5K", type: "third", degrees: 50, color: '#f8fafc', stroke: '#cbd5e1' }
];

let wheelRotation = 0;
let isSpinning = false;
let currentUserId = null;
let currentUserName = "Khách";

const btnVipSpin = document.getElementById('btnVipSpin');
const vipSpinStatus = document.getElementById('vipSpinStatus');
const vipWheelCanvas = document.getElementById('vipWheelCanvas');
const vipCtx = vipWheelCanvas ? vipWheelCanvas.getContext('2d') : null;

// Draw Wheel with varying sizes
function drawVipWheel() {
    if (!vipCtx) return;
    const width = vipWheelCanvas.width;
    const height = vipWheelCanvas.height;
    const radius = width / 2;
    const centerX = width / 2;
    const centerY = height / 2;

    vipCtx.clearRect(0, 0, width, height);

    let startAngle = 0;
    for (let i = 0; i < vipSegments.length; i++) {
        const sliceAngle = (vipSegments[i].degrees * Math.PI) / 180;

        vipCtx.beginPath();
        vipCtx.fillStyle = vipSegments[i].color;
        vipCtx.moveTo(centerX, centerY);
        vipCtx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle, false);
        vipCtx.lineTo(centerX, centerY);
        vipCtx.fill();

        vipCtx.lineWidth = 1.5;
        vipCtx.strokeStyle = vipSegments[i].stroke;
        vipCtx.stroke();

        // Draw Text
        vipCtx.save();
        vipCtx.translate(centerX, centerY);
        // Rotate to middle of slice
        vipCtx.rotate(startAngle + sliceAngle / 2);
        vipCtx.textAlign = 'right';
        vipCtx.textBaseline = 'middle';

        if (vipSegments[i].type === 'first') {
            vipCtx.fillStyle = '#b91c1c';
            vipCtx.font = '900 13px Outfit, sans-serif';
        } else if (vipSegments[i].type === 'second') {
            vipCtx.fillStyle = '#1d4ed8';
            vipCtx.font = '900 15px Outfit, sans-serif';
        } else {
            vipCtx.fillStyle = '#64748b';
            vipCtx.font = 'bold 16px Outfit, sans-serif';
        }

        // Push text to edge nicely
        vipCtx.fillText(vipSegments[i].label, radius - 15, 0);
        vipCtx.restore();

        startAngle += sliceAngle;
    }
}

if (vipWheelCanvas) {
    drawVipWheel();
}

// Auth Observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid;
        try {
            const snap = await get(ref(database, `users/${user.uid}`));
            if (snap.exists()) {
                currentUserName = snap.val().name || "Khách";
            }
        } catch (e) {
            console.error(e);
        }
    } else {
        currentUserId = null;
    }
});

// Calculate Max First Prizes based on time distribution
function getMaxFirstPrizes() {
    const day = new Date().getDate();
    if (day <= 7) return 1;
    if (day <= 14) return 2;
    if (day <= 21) return 3;
    return 5;
}

const MAX_SECOND_PRIZES = 10;

function getMonthString() {
    const d = new Date();
    return `${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function handleVipSpin() {
    if (!currentUserId) {
        window.location.href = "login.html";
        return;
    }

    if (isSpinning) return;

    vipSpinStatus.textContent = "Đang kiểm tra điểm...";
    btnVipSpin.disabled = true;

    try {
        const userRef = ref(database, `users/${currentUserId}`);
        const userSnap = await get(userRef);

        if (!userSnap.exists()) {
            vipSpinStatus.textContent = "Không tìm thấy dữ liệu người dùng.";
            btnVipSpin.disabled = false;
            return;
        }

        const userData = userSnap.val();
        let currentPoints = parseInt(userData.points) || 0;

        if (currentPoints < 50) {
            vipSpinStatus.textContent = `Bạn chỉ có ${currentPoints}đ. Cần 50đ để tham gia!`;
            btnVipSpin.disabled = false;
            return;
        }

        // Deduct points safely
        await update(userRef, { points: currentPoints - 50 });

        // Log Point History
        await push(ref(database, `users/${currentUserId}/point_history`), {
            amount: 50,
            reason: `Quay Vòng Quay Siêu Cấp`,
            type: "spend",
            timestamp: serverTimestamp()
        });

        // Determine Prize Logic
        vipSpinStatus.textContent = "Đang quay...";
        isSpinning = true;

        const monthStr = getMonthString();
        const poolRef = ref(database, `vip_pool/${monthStr}`);
        const poolSnap = await get(poolRef);
        let poolData = poolSnap.exists() ? poolSnap.val() : { current_first: 0, current_second: 0 };

        const maxFirst = getMaxFirstPrizes();
        let firstAvail = Math.max(0, maxFirst - (poolData.current_first || 0));
        let secondAvail = Math.max(0, MAX_SECOND_PRIZES - (poolData.current_second || 0));

        let wonType = 'third'; // Default Voucher 5k
        const rand = Math.random() * 100;

        // 2.5% First Prize
        if (rand < 2.5 && firstAvail > 0) {
            wonType = 'first';
        } else if (rand < 7.5 && secondAvail > 0) {
            // 5% Second Prize (from 2.5 to 7.5)
            wonType = 'second';
        }

        // Try to claim the pool quota
        if (wonType === 'first' || wonType === 'second') {
            const txResult = await runTransaction(poolRef, (currentData) => {
                if (currentData === null) currentData = { current_first: 0, current_second: 0 };

                if (wonType === 'first') {
                    if (currentData.current_first >= maxFirst) return; // abort
                    currentData.current_first++;
                } else {
                    if (currentData.current_second >= MAX_SECOND_PRIZES) return; // abort
                    currentData.current_second++;
                }
                return currentData;
            });

            if (!txResult.committed) {
                wonType = 'third'; // Fallback if someone else snatched it
            }
        }

        animateWheelAndResolve(wonType);

    } catch (e) {
        console.error("Spin error:", e);
        vipSpinStatus.textContent = "Lỗi hệ thống. Vui lòng thử lại.";
        btnVipSpin.disabled = false;
        isSpinning = false;
    }
}

function animateWheelAndResolve(wonType) {
    // Find matching segments for wonType
    const matchingSegments = [];
    let startAngle = 0;

    for (let i = 0; i < vipSegments.length; i++) {
        const deg = vipSegments[i].degrees;
        if (vipSegments[i].type === wonType) {
            matchingSegments.push({
                index: i,
                midAngle: startAngle + (deg / 2)
            });
        }
        startAngle += deg;
    }

    // Pick a random matching segment
    const targetSeg = matchingSegments[Math.floor(Math.random() * matchingSegments.length)];

    const targetDeg = targetSeg.midAngle;
    const currentDeg = wheelRotation % 360;

    // Calculate rotation to stop at pointer (pointer is at top = 270 degrees in canvas coords)
    // Canvas 0 is right (3 o'clock). Top is 270 deg / -90 deg.
    // So if target is at targetDeg, to align it to top:
    let rotateToTop = 270 - targetDeg;
    if (rotateToTop < 0) rotateToTop += 360;

    const spins = 5 * 360; // 5 full spins
    const totalRotation = spins + rotateToTop - currentDeg;

    const duration = 5000;
    const startTime = performance.now();
    const easeOutCirc = (x) => Math.sqrt(1 - Math.pow(x - 1, 2));

    function step(currentTime) {
        const elapsed = currentTime - startTime;
        let progress = elapsed / duration;
        if (progress > 1) progress = 1;

        const easedProgress = easeOutCirc(progress);
        wheelRotation = currentDeg + (totalRotation * easedProgress);

        vipWheelCanvas.style.transform = `rotate(${wheelRotation}deg)`;

        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            wheelRotation = wheelRotation % 360;
            processWin(wonType);
        }
    }
    requestAnimationFrame(step);
}

function anonymizeData(name, phone) {
    const parts = name.split(' ');
    let shortName = "Khách Hàng";
    if (parts.length > 0) {
        shortName = parts[parts.length - 1]; // Get last name
    }
    const safePhone = phone ? phone.substring(0, 4) + 'xxx' + phone.substring(phone.length - 3) : '-------';
    return { shortName: shortName + '***', safePhone };
}

async function processWin(wonType) {
    let giftName, discountType, discountValue;

    if (wonType === 'first') {
        giftName = "Thẻ VIP 10 Ly Trà Sữa MIỄN PHÍ";
        discountType = 'fixed';
        discountValue = 200000; // Valued loosely for orders 
    } else if (wonType === 'second') {
        giftName = "Combo 3 Ly Trà Sữa MIỄN PHÍ";
        discountType = 'fixed';
        discountValue = 60000;
    } else {
        giftName = "Voucher Giảm 5K";
        discountType = 'fixed';
        discountValue = 5000;
    }

    // Generate Voucher
    const voucherId = 'VIP_' + Date.now().toString(36).toUpperCase();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30); // 30 days expiry for VIP Spin
    expiryDate.setHours(23, 59, 59, 999);

    try {
        await set(ref(database, `users/${currentUserId}/vouchers/${voucherId}`), {
            code: voucherId,
            discount_type: discountType,
            discount_value: discountValue,
            label: `[Quà Siêu Cấp] ${giftName}`,
            origin: 'vip_spin',
            expiresAt: expiryDate.toISOString(),
            status: 'active',
            createdAt: new Date().toISOString()
        });

        // Record major wins to global broadcast
        if (wonType === 'first' || wonType === 'second') {
            const userSnap = await get(ref(database, `users/${currentUserId}`));
            const phone = userSnap.exists() ? userSnap.val().phone : '';
            const { shortName, safePhone } = anonymizeData(currentUserName, phone);

            await push(ref(database, 'vip_winners'), {
                timestamp: serverTimestamp(),
                name: shortName,
                phone: safePhone,
                prize: giftName,
                type: wonType
            });
        }

        showWinModal(wonType, giftName, voucherId);

    } catch (e) {
        console.error(e);
    }

    isSpinning = false;
    btnVipSpin.disabled = false;
    vipSpinStatus.textContent = "";
}

function showWinModal(type, title, voucherCode) {
    const modal = document.getElementById('vipResultModal');
    const msgEl = document.getElementById('vipResultMsg');
    const codeEl = document.getElementById('vipResultCode');
    const iconEl = document.getElementById('vipResultIcon');
    const fbShare = document.getElementById('vipFbShare');

    msgEl.textContent = `Chúc mừng bạn đã trúng ${title}!`;
    codeEl.textContent = voucherCode;

    if (type === 'first') {
        iconEl.textContent = '👑';
        fbShare.style.display = 'block';
        launchConfetti();
    } else if (type === 'second') {
        iconEl.textContent = '🍹';
        fbShare.style.display = 'block';
        launchConfetti();
    } else {
        iconEl.textContent = '🎉';
        fbShare.style.display = 'none';
    }

    modal.style.display = 'flex';

    document.getElementById('btnVipUseNow').onclick = () => {
        window.location.href = `order.html?voucher=${voucherCode}`;
    };
}

function launchConfetti() {
    const canvas = document.getElementById('vipConfetti');
    canvas.style.opacity = 1;
    const myConfetti = confetti.create(canvas, { resize: true, useWorker: true });
    myConfetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    setTimeout(() => { canvas.style.opacity = 0; }, 4000);
}

if (btnVipSpin) {
    btnVipSpin.addEventListener('click', handleVipSpin);
}

// ------------------------------------
// TOAST NOTIFICATION LOGIC
// ------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // We will listen for new entries in vip_winners 
    const winnersRef = query(ref(database, 'vip_winners'), limitToLast(5));

    // We don't want to show notifications for old data on load, so we use a timestamp baseline
    const loadTime = Date.now();
    let initialLoad = true;

    onValue(winnersRef, (snapshot) => {
        if (!snapshot.exists()) return;

        let newWinners = [];
        snapshot.forEach(child => {
            newWinners.push(child.val());
        });

        if (initialLoad) {
            initialLoad = false;
            return;
        }

        // Display the most recent winner if it was added AFTER load time
        const latestWinner = newWinners[newWinners.length - 1];
        if (latestWinner && latestWinner.timestamp > loadTime) {
            showToast(latestWinner);
        }
    });
});

const toastQueue = [];
let isToastShowing = false;

function showToast(winnerData) {
    toastQueue.push(winnerData);
    processToastQueue();
}

function processToastQueue() {
    if (isToastShowing || toastQueue.length === 0) return;
    isToastShowing = true;

    const data = toastQueue.shift();
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const emoji = data.type === 'first' ? '👑' : '🍹';

    const card = document.createElement('div');
    card.className = 'toast-card';
    card.innerHTML = `
        <div class="toast-img">${emoji}</div>
        <div class="toast-content">
            <div class="toast-title">🔔 Ai đó vừa trúng thật!</div>
            <div class="toast-desc">Bạn <strong>${data.name}</strong> (${data.phone}) vừa ẵm trọn <span>${data.prize}</span>!</div>
        </div>
    `;

    container.appendChild(card);

    // Animate In
    setTimeout(() => { card.classList.add('show'); }, 100);

    // Animate Out & Remove
    setTimeout(() => {
        card.classList.remove('show');
        setTimeout(() => {
            card.remove();
            isToastShowing = false;
            processToastQueue();
        }, 500);
    }, 5000);
}

// ------------------------------------
// WINNERS MODAL LOGIC
// ------------------------------------
const btnViewVipWinners = document.getElementById('btnViewVipWinners');
const vipWinnersModal = document.getElementById('vipWinnersModal');
const vipWinnersList = document.getElementById('vipWinnersList');
const btnViewAllVipWinners = document.getElementById('btnViewAllVipWinners');

let loadedWinnersHTML = [];

if (btnViewVipWinners) {
    btnViewVipWinners.addEventListener('click', async () => {
        vipWinnersModal.style.display = 'flex';
        if (btnViewAllVipWinners) btnViewAllVipWinners.style.display = 'none';
        vipWinnersList.innerHTML = '<p style="text-align: center; color: #94a3b8;">Đang tải danh sách...</p>';

        const q = query(ref(database, 'vip_winners'), limitToLast(100)); // Load more to find top ones
        try {
            const snap = await get(q);
            if (!snap.exists()) {
                vipWinnersList.innerHTML = '<p style="text-align: center; color: #94a3b8;">Tháng này chưa có ai rinh giải độc đắc. Bạn sẽ người đầu tiên chứ?</p>';
                return;
            }

            const winners = [];
            snap.forEach(child => winners.push(child.val()));

            // Sort by Best Prize (first > second > third) then by Time
            const rankMap = { 'first': 3, 'second': 2, 'third': 1 };
            winners.sort((a, b) => {
                const rankA = rankMap[a.type] || 0;
                const rankB = rankMap[b.type] || 0;
                if (rankA !== rankB) return rankB - rankA;
                return b.timestamp - a.timestamp;
            });

            loadedWinnersHTML = winners.map((w, index) => {
                const dateOpts = { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' };
                const dateStr = new Date(w.timestamp).toLocaleDateString('vi-VN', dateOpts);

                let emoji = '🎉';
                let styleType = 'background: #f8fafc; border: 1px solid #e2e8f0;';
                if (w.type === 'first') { emoji = '👑'; styleType = 'background: #fef08a; border: 2px solid #f59e0b;'; }
                else if (w.type === 'second') { emoji = '🍹'; styleType = 'background: #e0f2fe; border: 1px solid #7dd3fc;'; }

                let rankBadge = '';
                if (index < 3) {
                    const badgeColors = ['#fbbf24', '#cbd5e1', '#d97706'];
                    rankBadge = `<div style="position: absolute; top: -10px; left: -10px; width: 24px; height: 24px; background: ${badgeColors[index]}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2); z-index: 5;">${index + 1}</div>`;
                }

                return `
                    <div class="winner-row" style="position: relative; display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-radius: 12px; ${styleType} margin-bottom: 0.5rem; transition: all 0.3s ease;">
                        ${rankBadge}
                        <div style="display: flex; gap: 1rem; align-items: center;">
                            <div style="font-size: 1.5rem; background: rgba(255,255,255,0.8); width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">${emoji}</div>
                            <div>
                                <div style="font-weight: 800; color: #1e293b;">${w.name} <span style="font-weight: 500; font-size: 0.85rem; color: #64748b;">(${w.phone})</span></div>
                                <div style="font-size: 0.85rem; color: #64748b;">${dateStr}</div>
                            </div>
                        </div>
                        <div style="font-weight: 900; color: ${w.type === 'first' ? '#b91c1c' : '#0ea5e9'}; text-align: right; max-width: 120px;">${w.prize}</div>
                    </div>
                `;
            });

            renderWinners(10); // Show top 10

        } catch (e) {
            vipWinnersList.innerHTML = '<p style="text-align: center; color: #ef4444;">Lỗi tải dữ liệu.</p>';
        }
    });
}

function renderWinners(limit) {
    vipWinnersList.innerHTML = loadedWinnersHTML.slice(0, limit).join('');

    if (loadedWinnersHTML.length > limit) {
        if (btnViewAllVipWinners) {
            btnViewAllVipWinners.style.display = 'block';
            btnViewAllVipWinners.onclick = () => renderWinners(loadedWinnersHTML.length);
        }
    } else {
        if (btnViewAllVipWinners) btnViewAllVipWinners.style.display = 'none';
    }
}

// ------------------------------------
// HOMEPAGE INIT: TOP 3 & MARQUEE
// ------------------------------------
async function loadHomepageWinners() {
    const vipTop3List = document.getElementById('vipTop3List');
    const vipMarqueeContent = document.getElementById('vipMarqueeContent');
    if (!vipTop3List || !vipMarqueeContent) return;

    try {
        const q = query(ref(database, 'vip_winners'), limitToLast(50));
        const snap = await get(q);

        if (!snap.exists()) {
            vipTop3List.innerHTML = '<p style="text-align: center; color: #94a3b8; font-size: 0.9rem;">Chưa có người trúng giải. Hãy là người đầu tiên!</p>';
            vipMarqueeContent.innerHTML = '✨ Cơ hội trúng 10 Ly Trà Sữa Miễn Phí đang chờ đón bạn! Quay ngay hôm nay! ✨';
            return;
        }

        const winners = [];
        snap.forEach(child => winners.push(child.val()));

        // 1. Marquee (Recent 5)
        const recentWinners = [...winners].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
        const marqueeStrings = recentWinners.map(w => {
            const emoji = w.type === 'first' ? '👑' : (w.type === 'second' ? '🍹' : '🎉');
            return `${emoji} Chúc mừng <b>${w.name}</b> (${w.phone}) vừa trúng thưởng <b>${w.prize}</b>!`;
        });
        vipMarqueeContent.innerHTML = marqueeStrings.join('&nbsp;&nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp;&nbsp;') + '&nbsp;&nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp;&nbsp;' + marqueeStrings.join('&nbsp;&nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp;&nbsp;');

        // 2. Top 3 List
        const rankMap = { 'first': 3, 'second': 2, 'third': 1 };
        const topWinners = [...winners].sort((a, b) => {
            const rankA = rankMap[a.type] || 0;
            const rankB = rankMap[b.type] || 0;
            if (rankA !== rankB) return rankB - rankA;
            return b.timestamp - a.timestamp;
        }).slice(0, 3);

        vipTop3List.innerHTML = topWinners.map((w, index) => {
            const dateOpts = { day: '2-digit', month: '2-digit' };
            const dateStr = new Date(w.timestamp).toLocaleDateString('vi-VN', dateOpts);

            let emoji = '🎉';
            let styleType = 'background: rgba(255,255,255,0.8); border: 1px solid #e2e8f0;';
            if (w.type === 'first') { emoji = '👑'; styleType = 'background: #fef08a; border: 2px solid #f59e0b;'; }
            else if (w.type === 'second') { emoji = '🍹'; styleType = 'background: #e0f2fe; border: 1px solid #7dd3fc;'; }

            const badgeColors = ['#fbbf24', '#cbd5e1', '#d97706'];
            const rankBadge = `<div style="position: absolute; top: -8px; left: -8px; width: 22px; height: 22px; background: ${badgeColors[index]}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2); z-index: 5;">${index + 1}</div>`;

            return `
                <div style="position: relative; display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-radius: 12px; ${styleType} margin-bottom: 0.2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    ${rankBadge}
                    <div style="display: flex; gap: 0.75rem; align-items: center;">
                        <div style="font-size: 1.2rem; background: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">${emoji}</div>
                        <div>
                            <div style="font-weight: 800; color: #1e293b; font-size: 0.9rem;">${w.name}</div>
                            <div style="font-size: 0.75rem; color: #64748b;">${dateStr}</div>
                        </div>
                    </div>
                    <div style="font-weight: 900; color: ${w.type === 'first' ? '#b91c1c' : '#0ea5e9'}; font-size: 0.85rem; text-align: right; max-width: 100px;">${w.prize}</div>
                </div>
            `;
        }).join('');

    } catch (e) {
        console.error("Error loading homepage winners:", e);
    }
}

// Call on load
document.addEventListener('DOMContentLoaded', loadHomepageWinners);
