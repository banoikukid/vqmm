// file: order.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getDatabase, ref, get, push, set } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

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
                userNameDisplay.textContent = userData.name ? userData.name.split(' ').pop() : 'Bạn';
                userPointsDisplay.textContent = userData.points || 0;
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        }

        // Fetch Products
        await fetchProducts();

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
    const fmtTotal = totalAmount.toLocaleString('vi-VN') + 'đ';
    subTotalEl.textContent = fmtTotal;
    grandTotalEl.textContent = fmtTotal;

    // Calculate points (10,000đ = 1 point)
    const points = Math.floor(totalAmount / 10000);
    earnedPointsEl.textContent = `+${points}`;
}

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
        const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const earnedPoints = Math.floor(totalAmount / 10000);

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
            totalAmount: totalAmount,
            status: "pending",               // "pending" -> "processing" -> "completed"
            createdAt: new Date().toISOString()
        };

        await set(newOrderRef, orderData);

        // Wait for admin approval to add points

        // 3. Success Feedback
        cart = [];
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
