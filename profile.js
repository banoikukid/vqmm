// file: profile.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getDatabase, ref, get, update, onValue, query, orderByChild, equalTo, push, set } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

// Firebase configuration
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

// DOM Elements
const authLoader = document.getElementById('authLoader');
const updateMessage = document.getElementById('updateMessage');

function showMessage(msg, isError = false) {
    updateMessage.textContent = msg;
    updateMessage.className = `message ${isError ? 'error' : 'success'}`;
    updateMessage.style.display = 'block';

    // Auto hide after 3 seconds
    setTimeout(() => {
        updateMessage.style.display = 'none';
    }, 3000);
}

function setBtnLoading(btnId, isLoading) {
    const btn = document.getElementById(btnId);
    if (isLoading) {
        btn.classList.add('loading');
        btn.disabled = true;
    } else {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

// Current logged in user ID
let currentUserId = null;

// Auth State Observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in
        currentUserId = user.uid;

        // Fetch user data from DB
        try {
            const snapshot = await get(ref(database, `users/${currentUserId}`));
            if (snapshot.exists()) {
                const userData = snapshot.val();

                // Populate Display Fields
                document.getElementById('displayTitleName').textContent = userData.name || 'Khách Hàng Vô Danh';
                document.getElementById('displayEmail').textContent = userData.email || user.email;
                document.getElementById('displayPoints').textContent = userData.points || 0;

                // Avatar initial
                const initial = (userData.name || 'T').charAt(0).toUpperCase();
                document.getElementById('avatarInitial').textContent = initial;

                // Populate Form Fields
                document.getElementById('inputName').value = userData.name || '';
                document.getElementById('inputPhone').value = userData.phone || '';
                document.getElementById('inputEmail').value = userData.email || user.email;
                document.getElementById('inputAddress').value = userData.address || '';
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
            showMessage("Không thể tải thông tin. Vui lòng tải lại trang.", true);
        } finally {
            // Hide Loader
            authLoader.style.display = 'none';
        }

        // Fetch User's Orders History
        loadUserOrders(currentUserId);

        // Fetch User's Vouchers
        loadUserVouchers(currentUserId);

    } else {
        // User is signed out, redirect to login
        window.location.href = "login.html";
    }
});

// STATUS MAP
const STATUS_MAP = {
    'pending': '<span style="background: #fef3c7; color: #d97706; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">Chờ Xử Lý</span>',
    'completed': '<span style="background: #d1fae5; color: #059669; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">Đã Xong</span>'
};

function loadUserOrders(uid) {
    const ordersRef = ref(database, 'orders');
    onValue(ordersRef, (snapshot) => {
        const orderHistoryContainer = document.getElementById('orderHistoryContainer');
        orderHistoryContainer.innerHTML = ''; // Selectively clear out old orders

        if (snapshot.exists()) {
            const allData = snapshot.val();
            // Filter orders belonging to this user
            const userOrders = Object.keys(allData)
                .map(key => ({ id: key, ...allData[key] }))
                .filter(o => o.userId === uid)
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Newest first

            if (userOrders.length === 0) {
                orderHistoryContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 1rem;">Bạn chưa có đơn hàng nào.</p>';
                return;
            }

            userOrders.forEach(order => {
                const orderCard = document.createElement('div');
                orderCard.style.cssText = `
                    background: #f8fafc;
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                `;

                const dateObj = new Date(order.createdAt);
                const dateStr = `${dateObj.getHours()}:${String(dateObj.getMinutes()).padStart(2, '0')} - ${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;

                let itemsHtml = '<ul style="list-style: none; padding: 0; margin: 0; font-size: 0.95rem; color: #475569;">';
                if (order.items && Array.isArray(order.items)) {
                    order.items.forEach(i => {
                        itemsHtml += `<li style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                            <span>${i.quantity}x ${i.name}</span>
                            <span style="font-weight: 600;">${(i.price * i.quantity).toLocaleString('vi-VN')}đ</span>
                        </li>`;
                    });
                }
                itemsHtml += '</ul>';

                const totalFmt = (order.totalAmount || 0).toLocaleString('vi-VN') + 'đ';
                const statusHtml = STATUS_MAP[order.status] || order.status;

                orderCard.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem;">
                        <span style="font-weight: 600; color: #0f172a;">${dateStr}</span>
                        ${statusHtml}
                    </div>
                    <div>
                        ${itemsHtml}
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #cbd5e1; padding-top: 1rem; margin-top: 0.5rem;">
                        <span style="font-weight: 600;">Tổng tiền:</span>
                        <span style="font-weight: 700; color: #f59e0b; font-size: 1.1rem;">${totalFmt}</span>
                    </div>
                `;
                orderHistoryContainer.appendChild(orderCard);
            });

        } else {
            orderHistoryContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 1rem;">Bạn chưa có đơn hàng nào.</p>';
        }
    });
}

function loadUserVouchers(uid) {
    const vouchersRef = ref(database, `users/${uid}/vouchers`);
    onValue(vouchersRef, (snapshot) => {
        const vouchersContainer = document.getElementById('vouchersContainer');
        vouchersContainer.innerHTML = '';

        if (snapshot.exists()) {
            const data = snapshot.val();
            const now = new Date();

            let html = '';
            let activeCount = 0;

            for (const key in data) {
                const v = data[key];
                const expiresAt = new Date(v.expiresAt);
                const isExpired = now > expiresAt;

                if (v.status === 'used') continue; // Hide totally used vouchers

                // Auto delete if expired
                if (isExpired) {
                    set(ref(database, `users/${uid}/vouchers/${key}`), null);
                    continue; // Skip rendering
                }

                const timeRemaining = expiresAt - now;
                const hoursRemaining = Math.max(0, Math.floor(timeRemaining / (1000 * 60 * 60)));
                const expiryString = `Hết hạn sau ${hoursRemaining} giờ (${expiresAt.toLocaleTimeString('vi-VN')} ${expiresAt.toLocaleDateString('vi-VN')})`;

                activeCount++;
                html += `
                <div style="border: 2px dashed #fbbf24; background: #fffbeb; padding: 1.5rem; text-align: center; border-radius: 12px; position: relative;">
                    <div style="font-weight: 800; font-size: 1.2rem; color: #d97706; margin-bottom: 0.5rem;">${v.label}</div>
                    <div style="font-size: 1.5rem; font-weight: 800; letter-spacing: 2px; color: #1e293b; margin-bottom: 0.5rem; background: #fff; padding: 0.5rem; border-radius: 6px; border: 1px solid #e2e8f0;">${v.code}</div>
                    <div style="font-size: 0.85rem; color: #64748b; font-weight: 600;">${expiryString}</div>
                    <button class="btn btn-outline" style="width: 100%; margin-top: 1rem; border-color: #fbbf24; color: #d97706;" onclick="navigator.clipboard.writeText('${v.code}'); showMessage('Đã chép mã!');">Copy Mã</button>
                </div>`;
            }

            // Update Badge
            const badge = document.getElementById('voucherTabBadge');
            if (badge) {
                if (activeCount > 0) {
                    badge.style.display = 'inline-block';
                    badge.textContent = activeCount;
                } else {
                    badge.style.display = 'none';
                }
            }

            if (html === '') {
                vouchersContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 1rem; grid-column: 1/-1;">Bạn không có voucher nào chưa sử dụng.</p>';
            } else {
                vouchersContainer.innerHTML = html;
            }

        } else {
            vouchersContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 1rem; grid-column: 1/-1;">Bạn chưa có voucher nào. Hãy thử tham gia Vòng Quay May Mắn nhé!</p>';
            const badge = document.getElementById('voucherTabBadge');
            if (badge) badge.style.display = 'none';
        }
    });
}

// Tab Switching Logic
window.switchTab = function (tabId, btn) {
    // 1. Hide all tabs
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.remove('active');
    });
    // 2. Remove active state from all buttons
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('active');
    });
    // 3. Show targeted tab
    document.getElementById(tabId).classList.add('active');
    // 4. Set button to active
    if (btn) btn.classList.add('active');
};

window.handleUpdateProfile = async function (e) {
    e.preventDefault();
    if (!currentUserId) return;

    const name = document.getElementById('inputName').value.trim();
    const phone = document.getElementById('inputPhone').value.trim();
    const address = document.getElementById('inputAddress').value.trim();

    if (!/(84|0[3|5|7|8|9])+([0-9]{8})\b/.test(phone)) {
        showMessage("Số điện thoại không hợp lệ!", true);
        return;
    }

    setBtnLoading('btnUpdate', true);

    try {
        await update(ref(database, `users/${currentUserId}`), {
            name: name,
            phone: phone,
            address: address
        });

        // Query all orders by this user and update customerName and customerPhone
        const ordersRef = ref(database, 'orders');
        const userOrdersQuery = query(ordersRef, orderByChild('userId'), equalTo(currentUserId));
        const snapshot = await get(userOrdersQuery);

        if (snapshot.exists()) {
            const updates = {};
            snapshot.forEach((childSnapshot) => {
                const orderKey = childSnapshot.key;
                updates[`orders/${orderKey}/customerName`] = name;
                updates[`orders/${orderKey}/customerPhone`] = phone;
                updates[`orders/${orderKey}/deliveryAddress`] = address;
            });
            await update(ref(database), updates);
        }

        // Update Title Display
        document.getElementById('displayTitleName').textContent = name;
        document.getElementById('avatarInitial').textContent = name.charAt(0).toUpperCase();

        showMessage("Cập nhật thông tin thành công!");
    } catch (error) {
        console.error("Update error:", error);
        showMessage("Lỗi hệ thống khi lưu thông tin. Vui lòng thử lại!", true);
    } finally {
        setBtnLoading('btnUpdate', false);
    }
};

window.handleLogout = async function () {
    try {
        await signOut(auth);
        // Observer will handle the redirect automatically
    } catch (error) {
        showMessage("Lỗi đăng xuất. Vui lòng thử lại.", true);
    }
};

window.redeemGift = async function (giftId, giftName, cost) {
    if (!currentUserId) return;

    // Retrieve latest user data to ensure accurate points
    try {
        const snapshot = await get(ref(database, `users/${currentUserId}`));
        if (!snapshot.exists()) return;
        const userData = snapshot.val();
        const currentPoints = parseInt(userData.points) || 0;

        if (currentPoints < cost) {
            showMessage(`Bạn không đủ điểm! Cần thêm ${cost - currentPoints} điểm nữa.`, true);
            return;
        }

        if (!confirm(`Bạn có chắc muốn đổi ${cost} điểm để nhận "${giftName}" không?`)) {
            return;
        }

        // Deduct points
        const newPoints = currentPoints - cost;
        await update(ref(database, `users/${currentUserId}`), {
            points: newPoints
        });
        document.getElementById('displayPoints').textContent = newPoints; // Update UI immediately

        // Create a special order for the admin
        const ordersRef = ref(database, 'orders');
        const newOrderRef = push(ordersRef);

        const orderData = {
            userId: currentUserId,
            customerName: userData.name || '',
            customerPhone: userData.phone || '',
            deliveryAddress: userData.address || '',
            items: [{
                id: giftId,
                name: `[QUÀ TẶNG] ${giftName}`,
                price: 0,
                quantity: 1
            }],
            totalAmount: 0,
            status: "pending",
            createdAt: new Date().toISOString()
        };

        await set(newOrderRef, orderData);

        showMessage(`Đổi quà thành công! Quán đã nhận được yêu cầu lấy "${giftName}" của bạn.`);
    } catch (err) {
        console.error("Gift redemption error:", err);
        showMessage("Lỗi hệ thống khi đổi quà. Vui lòng thử lại.", true);
    }
};
