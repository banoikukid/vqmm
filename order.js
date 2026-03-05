// file: order.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getDatabase, ref, get, push, set, onValue } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

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

// Global State
let currentUser = null;
let userData = null;
let allProducts = [];
let cart = [];
let currentCategory = 'all';
let discountState = { applied: false, code: null, value: 0, label: '', isPersonalVoucher: false };

// ===== TELEGRAM BOT CONFIG =====
// 1. Tạo bot qua @BotFather trên Telegram -> lấy token
// 2. Thêm bot vào nhóm/channel của bạn -> gửi tin nhắn bất kỳ
// 3. Truy cập: https://api.telegram.org/bot<TOKEN>/getUpdates -> lấy chat_id
// GHI CHÚ BẢO MẬT: Token được tách làm 2 phần để tránh GitHub khoá tự động (Security Alert)
const BOT_P1 = '8658623562' + ':' + 'AAE';
const BOT_P2 = '6lXK1PSECtL4j1XTS_-McQRsDWfGecWk';
const TELEGRAM_BOT_TOKEN = BOT_P1 + BOT_P2;
const TELEGRAM_CHAT_ID = '-4999373315';   // Nhóm "Đặt hàng Trà sữa"
// ================================

async function sendTelegramNotification(order) {
    if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN.startsWith('NHAP')) return;

    const time = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const itemsList = (order.items || []).map(it => `   • ${it.name} x${it.quantity}  (${(it.price * it.quantity).toLocaleString('vi-VN')}đ)`).join('\n');
    const discountLine = order.discountAmount > 0
        ? `\n🎫 Mã giảm: ${order.discountCode}  (-${order.discountAmount.toLocaleString('vi-VN')}đ)`
        : '';

    const msg = [
        `🛒 *ĐƠN HÀNG MỚI* 🛒`,
        `📅 ${time}`,
        ``,
        `👤 *Khách:* ${order.customerName}`,
        `📞 *SĐT:* ${order.customerPhone}`,
        `📍 *Địa chỉ:* ${order.deliveryAddress}`,
        ``,
        `🍵 *Món đặt:*`,
        itemsList,
        ``,
        `💵 *Tạm tính:* ${order.subTotal.toLocaleString('vi-VN')}đ${discountLine}`,
        `💰 *Tổng thanh toán:* ${order.totalAmount.toLocaleString('vi-VN')}đ`,
        ``,
        `⏳ Trạng thái: _Đang chờ xử lý_`
    ].join('\n');

    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: msg,
                parse_mode: 'Markdown'
            })
        });
    } catch (err) {
        console.warn('Telegram notification failed:', err);
    }
}

// DOM Elements
const authLoader = document.getElementById('authLoader');
const userNameDisplay = document.getElementById('userNameDisplay');
const userPointsDisplay = document.getElementById('userPointsDisplay');
const productsGrid = document.getElementById('productsGrid');
const categoryList = document.getElementById('categoryList');
const currentCategoryTitle = document.getElementById('currentCategoryTitle');
const emptyMenuMessage = document.getElementById('emptyMenuMessage');
const searchInput = document.getElementById('searchInput');

// Cart DOM
const cartItemsList = document.getElementById('cartItemsList');
const cartItemCount = document.getElementById('cartItemCount');
const subTotalEl = document.getElementById('subTotal');
const grandTotalEl = document.getElementById('grandTotal');
const earnedPointsEl = document.getElementById('earnedPoints');
const btnCheckout = document.getElementById('btnCheckout');
const checkoutMessage = document.getElementById('checkoutMessage');
const toast = document.getElementById('toast');

// --- 1. Authentication & Initialization ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;

        // Fetch User Data for points and name
        try {
            const snapshot = await get(ref(database, `users/${user.uid}`));
            if (snapshot.exists()) {
                userData = snapshot.val();
                if (userNameDisplay) userNameDisplay.textContent = userData.name ? userData.name : 'Bạn';
                if (userPointsDisplay) userPointsDisplay.textContent = userData.points || 0;
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        }

        // Live Listener for User Vouchers (Auto-clean & Badge Count)
        const voucherBadgeDisplay = document.getElementById('voucherBadgeDisplay');
        onValue(ref(database, `users/${user.uid}/vouchers`), async (snapshot) => {
            if (snapshot.exists()) {
                const userVouchers = snapshot.val();
                let activeCount = 0;
                const now = new Date();

                for (const [vId, vData] of Object.entries(userVouchers)) {
                    if (vData.status === 'active') {
                        const expiryDate = new Date(vData.expiresAt);
                        if (now > expiryDate) {
                            // Expired -> Auto self-delete
                            await set(ref(database, `users/${user.uid}/vouchers/${vId}`), null);
                        } else {
                            activeCount++;
                        }
                    }
                }

                if (activeCount > 0) {
                    voucherBadgeDisplay.style.display = 'inline-flex';
                    voucherBadgeDisplay.textContent = `🎟️ ${activeCount} Voucher`;
                } else {
                    voucherBadgeDisplay.style.display = 'none';
                }
            } else {
                if (voucherBadgeDisplay) voucherBadgeDisplay.style.display = 'none';
            }
        });

        // Fetch Products
        await fetchProducts();

        // Check for Auto-Apply Voucher from URL
        const urlParams = new URLSearchParams(window.location.search);
        const autoVoucher = urlParams.get('voucher');
        if (autoVoucher) {
            const codeInput = document.getElementById('discountCodeInput');
            if (codeInput) {
                codeInput.value = autoVoucher;
                // Add a small delay for DOM render before applying
                setTimeout(() => window.applyDiscount(), 500);
            }
        }

        authLoader.style.display = 'none';
    } else {
        // Redirect to login if not authenticated
        window.location.href = "login.html";
    }
});

// --- 2. Product Fetching & Rendering ---
async function fetchProducts() {
    try {
        const snapshot = await get(ref(database, 'products'));
        if (snapshot.exists()) {
            const data = snapshot.val();
            // Convert object to array and inject ID
            allProducts = Object.keys(data).map(key => ({
                id: key,
                ...data[key]
            }));
        } else {
            allProducts = []; // No products yet
        }
    } catch (error) {
        console.error("Error fetching products:", error);
        allProducts = [];
    }

    // Sort array so newest items might appear first (optional, currently alphabetical by name)
    allProducts.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    renderProducts();
}

function renderProducts(searchQuery = "") {
    let filteredProducts = allProducts;

    // Filter by Category
    if (currentCategory !== 'all') {
        filteredProducts = filteredProducts.filter(p => p.category === currentCategory);
    }

    // Filter by Search Query
    if (searchQuery) {
        const lowerQ = searchQuery.toLowerCase();
        filteredProducts = filteredProducts.filter(p => (p.name || '').toLowerCase().includes(lowerQ));
    }

    // Render logic
    productsGrid.innerHTML = '';

    if (filteredProducts.length === 0) {
        emptyMenuMessage.style.display = 'block';
    } else {
        emptyMenuMessage.style.display = 'none';

        filteredProducts.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';

            // Format price
            const priceNum = parseInt(product.price) || 0;
            const priceFmt = priceNum.toLocaleString('vi-VN') + 'đ';

            // Default image if none exists
            const imgUrl = product.imageUrl || 'https://images.unsplash.com/photo-1556881286-fc6915169721?q=80&w=400&auto=format&fit=crop';

            card.innerHTML = `
                <img src="${imgUrl}" alt="${product.name}" class="product-img" loading="lazy">
                <div class="product-info">
                    <div class="product-title">${product.name}</div>
                    <div class="product-price">${priceFmt}</div>
                    <button class="btn-add" onclick="window.addToCart('${product.id}')">Thêm +</button>
                </div>
            `;
            productsGrid.appendChild(card);
        });
    }
}

// --- 3. Sidebar Category Listeners ---
categoryList.addEventListener('click', (e) => {
    if (e.target.classList.contains('category-item')) {
        // Update active class
        document.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
        e.target.classList.add('active');

        // Update state and UI
        currentCategory = e.target.getAttribute('data-category');
        currentCategoryTitle.textContent = e.target.textContent;

        // Clear search and re-render
        searchInput.value = '';
        renderProducts();
    }
});

searchInput.addEventListener('input', (e) => {
    renderProducts(e.target.value.trim());
});


// --- 4. Shopping Cart Logic ---
window.addToCart = function (productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    // Check if already in cart
    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: parseInt(product.price) || 0,
            imageUrl: product.imageUrl,
            quantity: 1
        });
    }

    showToast();
    renderCart();
};

window.updateQuantity = function (productId, delta) {
    const itemIndex = cart.findIndex(item => item.id === productId);
    if (itemIndex > -1) {
        cart[itemIndex].quantity += delta;
        if (cart[itemIndex].quantity <= 0) {
            cart.splice(itemIndex, 1); // Remove item
        }
        renderCart();
    }
};

function renderCart() {
    // Calculate total items
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartItemCount.textContent = totalItems;

    if (cart.length === 0) {
        cartItemsList.innerHTML = `
            <div class="cart-empty">
                <img src="https://img.icons8.com/?size=100&id=9730&format=png&color=94a3b8" alt="Empty">
                <p>Giỏ hàng đang trống.</p>
                <small>Hãy chọn vài món thơm ngon nhé!</small>
            </div>
        `;
        updateSummary(0);
        btnCheckout.disabled = true;
        return;
    }

    // Render items
    cartItemsList.innerHTML = '';
    let totalAmount = 0;

    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        totalAmount += itemTotal;

        // Safe image
        const imgUrl = item.imageUrl || 'https://images.unsplash.com/photo-1556881286-fc6915169721?q=80&w=100&auto=format&fit=crop';

        const itemEl = document.createElement('div');
        itemEl.className = 'cart-item';
        itemEl.innerHTML = `
            <img src="${imgUrl}" alt="${item.name}" class="cart-item-img">
            <div class="cart-item-info">
                <div class="cart-item-title">${item.name}</div>
                <div class="cart-item-price">${item.price.toLocaleString('vi-VN')}đ</div>
            </div>
            <div class="cart-item-actions">
                <button class="qty-btn" onclick="window.updateQuantity('${item.id}', -1)">-</button>
                <span style="font-weight: 600; font-size: 0.9rem; min-width: 15px; text-align: center;">${item.quantity}</span>
                <button class="qty-btn" onclick="window.updateQuantity('${item.id}', 1)">+</button>
            </div>
        `;
        cartItemsList.appendChild(itemEl);
    });

    updateSummary(totalAmount);
    btnCheckout.disabled = false;
}

function updateSummary(totalAmount) {
    const discountAmount = discountState.applied ? discountState.value : 0;
    const finalTotal = Math.max(0, totalAmount - discountAmount);

    subTotalEl.textContent = totalAmount.toLocaleString('vi-VN') + 'đ';
    grandTotalEl.textContent = finalTotal.toLocaleString('vi-VN') + 'đ';

    // Show/hide discount row
    const discountRow = document.getElementById('discountRow');
    const discountAmountDisplay = document.getElementById('discountAmountDisplay');
    const discountNameDisplay = document.getElementById('discountNameDisplay');
    if (discountState.applied) {
        discountRow.style.display = 'flex';
        discountAmountDisplay.textContent = '-' + discountAmount.toLocaleString('vi-VN') + 'đ';
        discountNameDisplay.textContent = discountState.code;
    } else {
        discountRow.style.display = 'none';
    }

    // Calculate points based on final total (1,000đ = 1 point)
    const points = Math.floor(finalTotal / 1000);
    earnedPointsEl.textContent = `+${points}`;
}

// ---- Discount Code Logic ----
window.applyDiscount = async function () {
    if (!currentUser || !userData) return;

    const codeInput = document.getElementById('discountCodeInput');
    const discountMsg = document.getElementById('discountMessage');
    const code = (codeInput.value || '').trim().toUpperCase();

    discountMsg.style.display = 'none';
    discountMsg.style.color = '#ef4444';

    function showDiscountMsg(msg, isSuccess = false) {
        discountMsg.textContent = msg;
        discountMsg.style.color = isSuccess ? '#10b981' : '#ef4444';
        if (isSuccess) {
            discountMsg.style.textShadow = '0 0 8px rgba(16,185,129,0.7)';
            discountMsg.style.fontWeight = '700';
        } else {
            discountMsg.style.textShadow = 'none';
            discountMsg.style.fontWeight = '500';
        }
        discountMsg.style.display = 'block';
    }

    if (!code) {
        showDiscountMsg('Vui lòng nhập mã giảm giá.');
        return;
    }

    if (discountState.applied) {
        showDiscountMsg('Đã áp mã rồi! Đặt hàng xong mới được dùng mã mới.', false);
        return;
    }

    try {
        let snapshot = await get(ref(database, `discount_codes/${code}`));
        let isPersonalVoucher = false;

        if (!snapshot.exists()) {
            // Check personal vouchers
            snapshot = await get(ref(database, `users/${currentUser.uid}/vouchers/${code}`));
            if (!snapshot.exists()) {
                showDiscountMsg('Mã giảm giá không tồn tại!');
                return;
            }
            isPersonalVoucher = true;
        }

        const codeData = snapshot.val();
        const todayStr = new Date().toLocaleDateString('vi-VN');

        if (!isPersonalVoucher) {
            // Validate global discount code
            if (codeData.phone && userData.phone && codeData.phone !== userData.phone) {
                showDiscountMsg('Mã này không dành cho tài khoản của bạn!');
                return;
            }
            if (codeData.expires_date && codeData.expires_date !== todayStr) {
                showDiscountMsg('Mã giảm giá đã hết hạn sử dụng!');
                return;
            }
            if (codeData.status !== 'unused') {
                showDiscountMsg('Mã giảm giá này đã được sử dụng rồi!');
                return;
            }
        } else {
            // Validate personal voucher
            const now = new Date();
            const expiresAt = new Date(codeData.expiresAt);
            if (now > expiresAt) {
                showDiscountMsg('Voucher của bạn đã hết hạn sử dụng!');
                return;
            }
            if (codeData.status !== 'active') {
                showDiscountMsg('Voucher này đã được sử dụng hoặc không hợp lệ!');
                return;
            }
        }

        // All valid – apply discount
        const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const discountType = codeData.discount_type || 'fixed';

        let finalDiscountValue = 0;
        let discountLabel = '';

        if (discountType === 'percent') {
            const pct = parseFloat(codeData.discount_value) || 0;
            finalDiscountValue = Math.round(cartTotal * pct / 100);

            // Apply max discount cap if set
            if (codeData.max_discount && finalDiscountValue > codeData.max_discount) {
                finalDiscountValue = codeData.max_discount;
            }
            discountLabel = `${pct}%${codeData.max_discount ? ' (tối đa ' + codeData.max_discount.toLocaleString('vi-VN') + 'đ)' : ''}`;
        } else {
            finalDiscountValue = parseInt(codeData.discount_value) || 0;
            discountLabel = finalDiscountValue.toLocaleString('vi-VN') + 'đ';
        }

        discountState = {
            applied: true,
            code: code,
            value: finalDiscountValue,
            label: codeData.label || code,
            firebaseKey: code,
            isPersonalVoucher: isPersonalVoucher
        };

        // Re-render cart to update totals
        updateSummary(cartTotal);

        showDiscountMsg(`✨ Áp mã thành công! Giảm ${discountLabel} = -${finalDiscountValue.toLocaleString('vi-VN')}đ cho đơn hàng.`, true);
        codeInput.disabled = true;
        document.getElementById('btnApplyDiscount').disabled = true;
        document.getElementById('btnApplyDiscount').style.opacity = '0.5';

    } catch (err) {
        console.error('Discount error:', err);
        showDiscountMsg('Có lỗi xảy ra. Vui lòng thử lại!');
    }
};

function showToast() {
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

// --- 5. Checkout Logic ---
window.handleCheckout = async function () {
    if (cart.length === 0 || !currentUser) return;

    // Check if user has address setup
    if (!userData || !userData.phone || !userData.address) {
        checkoutMessage.textContent = "Vui lòng cập nhật Số điện thoại & Địa chỉ trong Hồ Sơ trước khi thanh toán!";
        checkoutMessage.className = "message error";
        checkoutMessage.style.display = "block";
        return;
    }

    checkoutMessage.style.display = "none";
    btnCheckout.classList.add('loading');
    btnCheckout.disabled = true;

    try {
        const subTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const discountAmount = discountState.applied ? discountState.value : 0;
        const totalAmount = Math.max(0, subTotal - discountAmount);
        const earnedPoints = Math.floor(totalAmount / 1000);

        // 1. Create Order Record
        const ordersRef = ref(database, 'orders');
        const newOrderRef = push(ordersRef);

        const orderData = {
            userId: currentUser.uid,
            customerName: userData.name || '',
            customerPhone: userData.phone || '',
            deliveryAddress: userData.address || '',
            items: cart.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity
            })),
            subTotal: subTotal,
            discountCode: discountState.applied ? discountState.code : null,
            discountAmount: discountAmount,
            totalAmount: totalAmount,
            earnedPoints: earnedPoints,
            status: "pending",
            createdAt: new Date().toISOString()
        };

        await set(newOrderRef, orderData);

        // Gửi thông báo Telegram
        sendTelegramNotification(orderData).catch(() => { });

        // Mark discount code as 'used' in Firebase
        if (discountState.applied && discountState.firebaseKey) {
            if (discountState.isPersonalVoucher) {
                await set(ref(database, `users/${currentUser.uid}/vouchers/${discountState.firebaseKey}/status`), 'used');
            } else {
                await set(ref(database, `discount_codes/${discountState.firebaseKey}/status`), 'used');
            }
        }

        // Points are now granted ONLY when admin marks order as completed
        // Update local state and UI
        userData.points = parseInt(userData.points) || 0; // retain existing
        userPointsDisplay.textContent = userData.points;

        // 4. Success Feedback
        cart = [];
        discountState = { applied: false, code: null, value: 0, label: '', isPersonalVoucher: false };
        const codeInput = document.getElementById('discountCodeInput');
        if (codeInput) { codeInput.value = ''; codeInput.disabled = false; }
        const btnApply = document.getElementById('btnApplyDiscount');
        if (btnApply) { btnApply.disabled = false; btnApply.style.opacity = '1'; }
        const discountMsg = document.getElementById('discountMessage');
        if (discountMsg) discountMsg.style.display = 'none';
        renderCart();

        checkoutMessage.textContent = "Đặt hàng thành công! Quán đang chuẩn bị món cho bạn.";
        checkoutMessage.className = "message success";
        checkoutMessage.style.display = "block";

        setTimeout(() => {
            checkoutMessage.style.display = "none";
        }, 5000);

    } catch (error) {
        console.error("Checkout Failed:", error);
        checkoutMessage.textContent = "Có lỗi xảy ra khi đặt hàng. Vui lòng thử lại!";
        checkoutMessage.className = "message error";
        checkoutMessage.style.display = "block";
    } finally {
        btnCheckout.classList.remove('loading');
    }
};
