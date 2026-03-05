// file: admin.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getDatabase, ref, get, set, remove, onValue, onChildAdded } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

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
const auth = getAuth(app);

// ============================================
// ADMIN AUTHENTICATION LOGIC
// ============================================
const adminLoginOverlay = document.getElementById('adminLoginOverlay');
const adminLoginForm = document.getElementById('adminLoginForm');
const adminLoginError = document.getElementById('adminLoginError');
const adminLoginLoader = document.getElementById('adminLoginLoader');
const btnAdminLogin = document.getElementById('btnAdminLogin');

let currentAdminUser = null;

// Listen to Auth State
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Kiểm tra quyền Admin
        try {
            const adminsRef = ref(db, 'admins');
            const snapshot = await get(adminsRef);

            if (!snapshot.exists()) {
                // Tình huống First-Run: Database chưa có ai làm Admin
                // Tự động cấp quyền Admin Tối cao cho người đầu tiên đăng nhập web này
                await set(ref(db, `admins/${user.uid}`), true);
                console.log("Cấp quyền Admin đầu tiên thành công cho:", user.email);
                grantAdminAccess(user);
            } else {
                // Đã có danh sách Admin, kiểm tra xem tài khoản này có nằm trong danh sách không
                if (snapshot.hasChild(user.uid)) {
                    grantAdminAccess(user);
                } else {
                    // Đăng nhập đúng Email/Pass nhưng KHÔNG có quyền Admin
                    throw new Error("Tài khoản của bạn không có quyền Quản Trị Viên!");
                }
            }
        } catch (error) {
            console.error(error);
            await signOut(auth);
            showAuthError(error.message || "Lỗi kiểm tra quyền hạn.");
        }
    } else {
        // Chưa đăng nhập, hiện màn hình Login
        adminLoginOverlay.style.display = 'flex';
        currentAdminUser = null;
    }
});

function grantAdminAccess(user) {
    currentAdminUser = user;
    adminLoginOverlay.style.display = 'none'; // Giấu màn hình đăng nhập
    showToast(`Xin chào Quản trị viên: ${user.email}`);
    // Load initial data
    loadOrders();
    loadBanners();
    loadProducts();
    loadCustomers();
}

function showAuthError(msg) {
    adminLoginError.textContent = msg;
    adminLoginError.style.display = 'block';
    adminLoginLoader.style.display = 'none';
    btnAdminLogin.style.display = 'block';
}

if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('adminEmail').value.trim();
        const password = document.getElementById('adminPassword').value;

        // UI Loading
        adminLoginError.style.display = 'none';
        btnAdminLogin.style.display = 'none';
        adminLoginLoader.style.display = 'block';

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // onAuthStateChanged sẽ tự động bắt sự kiện và kiểm tra quyền Admin
        } catch (error) {
            let msg = "Lỗi đăng nhập!";
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                msg = "Email hoặc Mật khẩu không chính xác!";
            } else if (error.code === 'auth/too-many-requests') {
                msg = "Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau!";
            }
            showAuthError(msg);
        }
    });
}

// Hàm Logout
window.logoutAdmin = async function () {
    try {
        await signOut(auth);
        window.location.reload();
    } catch (error) {
        showToast("Lỗi đăng xuất", true);
    }
}


// Global state
let currentBanners = [];
let allProducts = [];
let allOrders = [];
let allCustomers = [];

// ============================================
// SHARED UTILITIES
// ============================================
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    if (isError) toast.classList.add('error');
    else toast.classList.remove('error');

    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Re-using the excellent Image Compression logic
function compressImage(file, callback) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1200;
            const MAX_HEIGHT = 1200;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            callback(dataUrl);
        };
        img.onerror = () => { showToast("Lỗi phân tích hình ảnh.", true); callback(null); };
    };
    reader.onerror = () => { showToast("Lỗi đọc file ảnh.", true); callback(null); };
}

// Generate unique ID
function generateId() {
    return 'id_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

const CATEGORY_MAP = {
    'milktea': 'Trà Sữa Tuyệt Đỉnh',
    'combo': 'Combo Khuyến Mãi',
    'fruit': 'Trà Trái Cây Tươi',
    'topping': 'Topping Thêm'
};

const STATUS_MAP = {
    'pending': '<span class="status-badge status-pending">Chờ Xử Lý</span>',
    'completed': '<span class="status-badge status-completed">Đã Xong</span>'
};

// ============================================
// TAB: ORDERS MANAGEMENT
// ============================================
const ordersTableBody = document.getElementById('ordersTableBody');

let isInitialLoad = true;

function loadOrders() {
    const ordersRef = ref(db, 'orders');

    onValue(ordersRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            // Convert to array and reverse (newest first)
            allOrders = Object.keys(data).map(key => ({
                id: key,
                ...data[key]
            })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else {
            allOrders = [];
        }
        renderOrders();
    });

    // Listen for NEW orders to show the floating notification
    onChildAdded(ordersRef, (data) => {
        if (isInitialLoad) return; // Don't trigger for existing orders on first load

        const newOrder = data.val();
        // Only notify if it's a pending order
        if (newOrder.status === 'pending') {
            const notifEl = document.getElementById('newOrderNotification');
            const notifText = document.getElementById('newOrderText');

            if (notifEl && notifText) {
                // Play a tiny sound (optional, browser policies might block it without interaction, but worth a try)
                try {
                    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                    audio.play().catch(e => console.log("Audio play blocked by browser."));
                } catch (e) { }

                notifText.innerText = `${newOrder.customerName || 'Khách'} vừa chốt đơn ${(newOrder.totalAmount || 0).toLocaleString('vi-VN')}đ`;
                notifEl.classList.add('active');

                // Auto hide after 8 seconds
                setTimeout(() => {
                    notifEl.classList.remove('active');
                }, 8000);
            }
        }
    });

    // small delay to mark initial load complete
    setTimeout(() => { isInitialLoad = false; }, 2000);
}

function renderOrders() {
    const unreadCount = allOrders.filter(o => o.status === 'pending').length;
    const badgeEl = document.getElementById('unreadOrderCount');

    if (badgeEl) {
        if (unreadCount > 0) {
            badgeEl.textContent = unreadCount;
            badgeEl.style.display = 'inline-block';
        } else {
            badgeEl.style.display = 'none';
        }
    }

    ordersTableBody.innerHTML = '';
    if (allOrders.length === 0) {
        ordersTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#64748b;padding:2rem;">Chưa có đơn hàng nào.</td></tr>';
        return;
    }

    allOrders.forEach(order => {
        const tr = document.createElement('tr');

        // Format date
        const dateObj = new Date(order.createdAt);
        const dateStr = `${dateObj.getHours()}:${String(dateObj.getMinutes()).padStart(2, '0')} - ${dateObj.getDate()}/${dateObj.getMonth() + 1}`;

        // Format items array into html
        let itemsHtml = '<ul style="padding-left:1rem;margin:0;font-size:0.9rem;color:#64748b;">';
        if (order.items && Array.isArray(order.items)) {
            order.items.forEach(i => {
                itemsHtml += `<li>${i.quantity}x ${i.name}</li>`;
            });
        }
        itemsHtml += '</ul>';

        // Format total
        const totalFmt = (order.totalAmount || 0).toLocaleString('vi-VN') + 'đ';

        // Format customer info
        const custInfo = `
            <strong>${order.customerName || 'Vô danh'}</strong><br>
            <small style="color:#64748b;">${order.customerPhone || 'Không có SĐT'}</small><br>
            <small style="color:#64748b;display:block;max-width:200px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;" title="${order.deliveryAddress}">${order.deliveryAddress}</small>
        `;

        // Buttons
        let actionBtn = '';
        if (order.status === 'pending') {
            actionBtn = `<button class="btn btn-success" onclick="window.markOrderComplete('${order.id}')" style="padding:0.4rem 0.8rem;font-size:0.85rem;margin-right:0.5rem;">Xong Đơn</button>`;
        } else {
            actionBtn = `<button class="btn btn-outline" style="border-color:#e2e8f0;padding:0.4rem 0.8rem;font-size:0.85rem;margin-right:0.5rem;" disabled>Đã Giao</button>`;
        }
        actionBtn += `<button class="btn btn-danger" onclick="window.deleteOrder('${order.id}')" style="padding:0.4rem 0.8rem;font-size:0.85rem;">Xóa</button>`;

        tr.innerHTML = `
            <td style="font-weight:600;">${dateStr}</td>
            <td>${custInfo}</td>
            <td>${itemsHtml}</td>
            <td style="font-weight:700;color:#f59e0b;">${totalFmt}</td>
            <td>${STATUS_MAP[order.status] || order.status}</td>
            <td style="min-width:180px;">${actionBtn}</td>
        `;
        ordersTableBody.appendChild(tr);
    });
}

// Global scope for onclick bindings
window.markOrderComplete = async function (orderId) {
    if (!confirm("Bạn xác nhận đã hoàn thành và giao đơn này?")) return;
    try {
        await set(ref(db, `orders/${orderId}/status`), 'completed');
        showToast("Đã cập nhật trạng thái đơn hàng!");
    } catch (e) {
        console.error(e);
        showToast("Lỗi khi cập nhật trạng thái.", true);
    }
}

window.deleteOrder = async function (orderId) {
    if (!confirm("Bạn có chắc chắn muốn xóa đơn hàng này không? Hành động này không thể hoàn tác.")) return;
    try {
        await remove(ref(db, `orders/${orderId}`));
        showToast("Đã xóa đơn hàng thành công!");
    } catch (e) {
        console.error(e);
        showToast("Lỗi khi xóa đơn hàng.", true);
    }
}


// ============================================
// TAB: MENU MANAGEMENT
// ============================================
const productsTableBody = document.getElementById('productsTableBody');
const productForm = document.getElementById('productForm');

function loadProducts() {
    const productsRef = ref(db, 'products');
    onValue(productsRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            allProducts = Object.keys(data).map(key => ({
                id: key,
                ...data[key]
            }));
        } else {
            allProducts = [];
        }
        renderProducts();
    });
}

function renderProducts() {
    productsTableBody.innerHTML = '';
    if (allProducts.length === 0) {
        productsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#64748b;padding:2rem;">Chưa có món nào trong thực đơn. Cần thêm mới.</td></tr>';
        return;
    }

    allProducts.forEach(product => {
        const tr = document.createElement('tr');

        const priceFmt = (parseInt(product.price) || 0).toLocaleString('vi-VN') + 'đ';
        const imgUrl = product.imageUrl || 'https://via.placeholder.com/50';
        const catName = CATEGORY_MAP[product.category] || product.category;

        tr.innerHTML = `
            <td>
                <div class="product-cell">
                    <img src="${imgUrl}" alt="${product.name}">
                    <span style="font-weight:600;">${product.name}</span>
                </div>
            </td>
            <td><span style="background:#f1f5f9;padding:0.2rem 0.6rem;border-radius:4px;font-size:0.85rem;">${catName}</span></td>
            <td style="font-weight:700;">${priceFmt}</td>
            <td style="text-align:right;">
                <button class="btn btn-outline" style="padding:0.4rem 0.8rem;font-size:0.85rem;margin-right:0.5rem;" onclick="window.editProduct('${product.id}')">Sửa</button>
                <button class="btn btn-danger" style="padding:0.4rem 0.8rem;font-size:0.85rem;" onclick="window.deleteProduct('${product.id}')">Xóa</button>
            </td>
        `;
        productsTableBody.appendChild(tr);
    });
}

// Product Form Submission
productForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Disable button to prevent double submit
    const btn = document.getElementById('btnSaveProduct');
    btn.textContent = 'ĐANG LƯU...';
    btn.disabled = true;

    const id = document.getElementById('prodId').value || generateId();
    const name = document.getElementById('prodName').value.trim();
    const price = document.getElementById('prodPrice').value;
    const category = document.getElementById('prodCategory').value;
    const imageUrl = document.getElementById('prodImageUrl').value; // from hidden input

    if (!imageUrl) {
        showToast("Vui lòng tải ảnh món ăn lên trước khi lưu!", true);
        btn.textContent = 'LƯU SẢN PHẨM';
        btn.disabled = false;
        return;
    }

    try {
        await set(ref(db, `products/${id}`), {
            name: name,
            price: price,
            category: category,
            imageUrl: imageUrl,
            updatedAt: new Date().toISOString()
        });
        showToast("Lưu món ăn thành công!");
        document.getElementById('productModal').classList.remove('active');
    } catch (error) {
        console.error("Save product error:", error);
        showToast("Lỗi khi lưu dữ liệu. Thử lại sau!", true);
    } finally {
        btn.textContent = 'LƯU SẢN PHẨM';
        btn.disabled = false;
    }
});

// Delete Product
window.deleteProduct = async function (id) {
    if (!confirm("Bạn có chắc muốn XÓA món này khỏi thực đơn không? (Không thể hoàn tác!)")) return;
    try {
        await remove(ref(db, `products/${id}`));
        showToast("Đã xóa sản phẩm.");
    } catch (e) {
        showToast("Lỗi khi xóa.", true);
    }
};

// Edit Product (populate modal)
window.editProduct = function (id) {
    const product = allProducts.find(p => p.id === id);
    if (!product) return;

    // Populate Fields
    document.getElementById('modalTitle').textContent = 'Sửa Thông Tin Món';
    document.getElementById('prodId').value = product.id;
    document.getElementById('prodName').value = product.name;
    document.getElementById('prodPrice').value = product.price;
    document.getElementById('prodCategory').value = product.category;

    // Image
    document.getElementById('prodImageUrl').value = product.imageUrl || '';
    if (product.imageUrl) {
        const preview = document.getElementById('prodImagePreview');
        preview.src = product.imageUrl;
        preview.style.display = 'block';
        document.getElementById('uploadText').textContent = 'Đã tải ảnh lên (Nhấn để thay đổi)';
    }

    // Show Modal
    document.getElementById('productModal').classList.add('active');
};

// Image Upload handler for Product Modal
document.getElementById('prodImageUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        document.getElementById('uploadText').textContent = 'Đang nén ảnh...';
        compressImage(file, (base64String) => {
            if (base64String) {
                document.getElementById('prodImageUrl').value = base64String;
                const preview = document.getElementById('prodImagePreview');
                preview.src = base64String;
                preview.style.display = 'block';
                document.getElementById('uploadText').textContent = 'Ảnh đã sẵn sàng! (Nhấn đổi)';
                showToast("Tải ảnh và nén thành công!");
            } else {
                document.getElementById('uploadText').textContent = 'Lỗi ảnh. Thử lại.';
            }
        });
    }
});


// ============================================
// TAB: BANNERS MANAGEMENT (Existing logic preserved)
// ============================================
const bannerListEl = document.getElementById('bannerList');
const loadingElBanner = document.getElementById('loading');
const saveAllBannersBtn = document.getElementById('saveAllBtn');
const addBannerForm = document.getElementById('addBannerForm');

function loadBanners() {
    onValue(ref(db, 'config/banners'), (snapshot) => {
        if (snapshot.exists()) {
            currentBanners = snapshot.val() || [];
        } else {
            currentBanners = [];
        }
        renderBanners();
        loadingElBanner.style.display = 'none';
        bannerListEl.style.display = 'block';
        if (currentBanners.length > 0) saveAllBannersBtn.style.display = 'block';
    });
}

function renderBanners() {
    bannerListEl.innerHTML = '';

    // Ensure save button visibility based on banners
    saveAllBannersBtn.style.display = currentBanners.length > 0 ? 'inline-block' : 'none';

    if (currentBanners.length === 0) {
        bannerListEl.innerHTML = '<p class="loading-text">Chưa có banner nào.</p>';
        return;
    }

    currentBanners.forEach((b, index) => {
        const item = document.createElement('div');
        item.className = 'banner-item';

        const safeHeadline = (b.headline || '').replace(/"/g, '&quot;');
        const safeSub = (b.subheadline || '').replace(/"/g, '&quot;');

        item.innerHTML = `
            <img src="${b.imageUrl}" alt="Banner Preview" class="banner-img-preview" onerror="this.src='https://via.placeholder.com/150x80?text=Lỗi+Ảnh'">
            <div class="banner-info" data-index="${index}">
                <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem; align-items: flex-end;">
                    <div style="flex:1;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <small>Link Ảnh (Bắt buộc)</small>
                            <label class="btn btn-outline" style="padding: 0.2rem 0.6rem; font-size: 0.75rem; cursor: pointer;">
                                Đổi Ảnh Lên
                                <input type="file" class="upload-existing-img" data-index="${index}" accept="image/*" style="display: none;">
                            </label>
                        </div>
                        <input type="text" class="edit-img" value="${b.imageUrl}" style="margin-bottom: 0;">
                    </div>
                    <div style="width: 150px;">
                        <small style="display: block; margin-bottom: 0.5rem;">Nút bấm</small>
                        <input type="text" class="edit-btn" value="${b.buttonText}" style="margin-bottom: 0;">
                    </div>
                </div>
                <div><small>Tiêu đề (Cho phép HTML)</small><input type="text" class="edit-headline" value="${safeHeadline}"></div>
                <div><small>Mô tả nhỏ</small><input type="text" class="edit-sub" value="${safeSub}"></div>
                
                <div class="banner-actions">
                    <button type="button" class="btn btn-danger btn-delete" data-index="${index}">Xóa</button>
                    ${index > 0 ? `<button type="button" class="btn btn-outline btn-move-up" data-index="${index}" style="padding: 0.4rem 0.8rem;">Lên ↑</button>` : ''}
                    ${index < currentBanners.length - 1 ? `<button type="button" class="btn btn-outline btn-move-down" data-index="${index}" style="padding: 0.4rem 0.8rem;">Xuống ↓</button>` : ''}
                </div>
            </div>
        `;
        bannerListEl.appendChild(item);
    });

    attachBannerListEvents();
}

function attachBannerListEvents() {
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (!confirm("Xóa banner này?")) return;
            const index = parseInt(e.target.getAttribute('data-index'));
            currentBanners.splice(index, 1);
            saveBannersToFirebase("Đã xóa banner", true);
        });
    });

    document.querySelectorAll('.btn-move-up').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'));
            if (idx > 0) {
                syncCurrentValues();
                const temp = currentBanners[idx];
                currentBanners[idx] = currentBanners[idx - 1];
                currentBanners[idx - 1] = temp;
                renderBanners();
            }
        });
    });

    document.querySelectorAll('.btn-move-down').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'));
            if (idx < currentBanners.length - 1) {
                syncCurrentValues();
                const temp = currentBanners[idx];
                currentBanners[idx] = currentBanners[idx + 1];
                currentBanners[idx + 1] = temp;
                renderBanners();
            }
        });
    });

    document.querySelectorAll('.upload-existing-img').forEach(input => {
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            const idx = parseInt(e.target.getAttribute('data-index'));
            if (file) {
                e.target.parentElement.innerHTML = 'Đang nén...';
                compressImage(file, (base64String) => {
                    if (base64String) {
                        currentBanners[idx].imageUrl = base64String;
                        renderBanners();
                        showToast("Đã tải ảnh lên thành công. Nhớ bấm LƯU TẤT CẢ!");
                    } else {
                        showToast("Lỗi nén ảnh.", true);
                    }
                });
            }
        });
    });
}

function syncCurrentValues() {
    const items = document.querySelectorAll('.banner-info');
    items.forEach(item => {
        const idx = parseInt(item.getAttribute('data-index'));
        currentBanners[idx].imageUrl = item.querySelector('.edit-img').value;
        currentBanners[idx].headline = item.querySelector('.edit-headline').value;
        currentBanners[idx].subheadline = item.querySelector('.edit-sub').value;
        currentBanners[idx].buttonText = item.querySelector('.edit-btn').value;
    });
}

async function saveBannersToFirebase(successMsg = "Đã lưu tất cả thay đổi!", isDelete = false) {
    if (!isDelete) syncCurrentValues();
    try {
        await set(ref(db, 'config/banners'), currentBanners);
        showToast(successMsg);
    } catch (e) {
        showToast("Lỗi khi lưu dữ liệu.", true);
    }
}

saveAllBannersBtn.addEventListener('click', () => {
    saveBannersToFirebase();
});

addBannerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newBanner = {
        imageUrl: document.getElementById('newImgUrl').value.trim(),
        headline: document.getElementById('newHeadline').value.trim(),
        subheadline: document.getElementById('newSubheadline').value.trim(),
        buttonText: document.getElementById('newBtnText').value.trim()
    };

    currentBanners.push(newBanner);
    syncCurrentValues(); // Sync before re-rendering
    saveBannersToFirebase("Đã thêm banner mới!");
    addBannerForm.reset();
});

// New Banner Image Upload
document.getElementById('imageUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        e.target.parentElement.innerHTML = 'Đang tải và nén...';
        compressImage(file, (base64String) => {
            if (base64String) {
                document.getElementById('newImgUrl').value = base64String;
                document.querySelector('.btn-outline').innerHTML = `
                    Tải Xong!
                    <input type="file" id="imageUpload" accept="image/*" style="display: none;">
                `;
                // reattach listener since we modified innerHTML
                document.getElementById('imageUpload').addEventListener('change', arguments.callee);
                showToast("Nén ảnh thành công!");
            } else {
                showToast("Lỗi tải ảnh.", true);
            }
        });
    }
});


// ============================================
// TAB: CUSTOMERS MANAGEMENT
// ============================================
const customersTableBody = document.getElementById('customersTableBody');

function loadCustomers() {
    const usersRef = ref(db, 'users');
    onValue(usersRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            allCustomers = Object.keys(data).map(key => ({
                id: key,
                ...data[key]
            })).sort((a, b) => (b.points || 0) - (a.points || 0)); // Sort by points descending
        } else {
            allCustomers = [];
        }
        renderCustomers();
    });
}

function renderCustomers() {
    if (!customersTableBody) return; // Guard clause in case HTML isn't loaded yet

    customersTableBody.innerHTML = '';
    if (allCustomers.length === 0) {
        customersTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#64748b;padding:2rem;">Chưa có hội viên nào.</td></tr>';
        return;
    }

    allCustomers.forEach(customer => {
        const tr = document.createElement('tr');

        // Format points
        const pointsFmt = (customer.points || 0).toLocaleString('vi-VN');

        const custInfo = `
            <strong>${customer.name || 'Khách Vô Danh'}</strong>
        `;

        const contactInfo = `
            ${customer.phone || 'Chưa cập nhật SĐT'}<br>
            <small style="color:#64748b;">${customer.email || 'Chưa cập nhật Email'}</small>
        `;

        tr.innerHTML = `
            <td>${custInfo}</td>
            <td>${contactInfo}</td>
            <td style="text-align: right; font-weight: 700; color: #f59e0b;">${pointsFmt} điểm</td>
        `;
        customersTableBody.appendChild(tr);
    });
}

// ============================================
// INITIALIZATION AND LOGIN
// ============================================

let isAdminLoggedIn = false;

window.checkAdminPin = function (e) {
    if (e) e.preventDefault();
    if (isAdminLoggedIn) return;

    const pin = document.getElementById('adminPin').value.trim();
    const errorMsg = document.getElementById('adminLoginError');

    // Mật khẩu cứng (Ví dụ: "admin" hoặc "686868")
    if (pin === 'admin' || pin === '686868') {
        isAdminLoggedIn = true;
        // Correct pin
        document.getElementById('adminLoginOverlay').style.display = 'none';

        // Start listening to the DB immediately
        loadOrders();
        loadProducts();
        loadBanners();
        loadCustomers();

        showToast("Đăng nhập Admin thành công!");
    } else {
        errorMsg.style.display = 'block';
        setTimeout(() => { errorMsg.style.display = 'none'; }, 2000);
    }
};

// Allow pressing Enter to submit PIN
const pinInput = document.getElementById('adminPin');
if (pinInput) {
    pinInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            checkAdminPin(e);
        }
    });
}

// Global Nav Mobile Menu Toggle
const mobileMenu = document.getElementById('mobile-menu');
const navLinks = document.getElementById('nav-links');

if (mobileMenu && navLinks) {
    mobileMenu.addEventListener('click', () => {
        mobileMenu.classList.toggle('is-active');
        navLinks.classList.toggle('active');
    });

    // Close menu when clicking a link
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.remove('is-active');
            navLinks.classList.remove('active');
        });
    });
}

// ============================================
// DISCOUNT CODE MANAGEMENT
// ============================================

function generateCodeString(length = 8) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing chars
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

window.updateDcValueLabel = function () {
    const type = document.getElementById('dcType').value;
    const label = document.getElementById('dcValueLabel');
    const input = document.getElementById('dcValue');
    const maxGroup = document.getElementById('dcMaxGroup');
    if (type === 'percent') {
        label.textContent = 'Phần Trăm Giảm (%)';
        input.placeholder = 'VD: 20 (giảm 20%)';
        input.max = 100;
        maxGroup.style.display = 'block';
    } else {
        label.textContent = 'Giá Trị Giảm (VNĐ)';
        input.placeholder = 'VD: 20000';
        input.removeAttribute('max');
        maxGroup.style.display = 'none';
        document.getElementById('dcMaxValue').value = '';
    }
};

window.generateDiscountCode = async function () {
    const phone = document.getElementById('dcPhone').value.trim();
    const valueRaw = document.getElementById('dcValue').value.trim();
    const label = document.getElementById('dcLabel').value.trim();
    const qty = parseInt(document.getElementById('dcQty').value) || 1;
    const dcType = document.getElementById('dcType').value; // 'fixed' | 'percent'
    const maxRaw = document.getElementById('dcMaxValue').value.trim();
    const dcCreateMsg = document.getElementById('dcCreateMsg');

    function showMsg(msg, isErr = false) {
        dcCreateMsg.innerHTML = msg;
        dcCreateMsg.style.color = isErr ? '#ef4444' : '#10b981';
        dcCreateMsg.style.display = 'block';
        if (!isErr) setTimeout(() => dcCreateMsg.style.display = 'none', 8000);
    }

    if (!valueRaw) {
        showMsg('Vui lòng nhập Giá trị giảm!', true);
        return;
    }

    const discountValue = parseFloat(valueRaw);
    if (isNaN(discountValue) || discountValue <= 0) {
        showMsg('Giá trị giảm phải là số dương!', true);
        return;
    }
    if (dcType === 'percent' && discountValue > 100) {
        showMsg('Phần trăm giảm không được vượt quá 100%!', true);
        return;
    }
    if (qty < 1 || qty > 100) {
        showMsg('Số lượng phải từ 1 đến 100!', true);
        return;
    }

    const maxValue = maxRaw ? parseInt(maxRaw) : null;
    const todayStr = new Date().toLocaleDateString('vi-VN');
    const createdCodes = [];

    try {
        for (let i = 0; i < qty; i++) {
            const code = generateCodeString(8);
            const codeData = {
                discount_type: dcType,
                discount_value: discountValue,
                label: label || (dcType === 'percent' ? `Giảm ${discountValue}%` : 'Mã Khuyến Mãi'),
                status: 'unused',
                created_date: todayStr,
                expires_date: todayStr
            };
            if (phone) codeData.phone = phone;
            if (maxValue && dcType === 'percent') codeData.max_discount = maxValue;

            await set(ref(db, `discount_codes/${code}`), codeData);
            createdCodes.push(code);
        }

        const valueLabel = dcType === 'percent'
            ? `${discountValue}%${maxValue ? ' (tối đa ' + maxValue.toLocaleString('vi-VN') + 'đ)' : ''}`
            : `${discountValue.toLocaleString('vi-VN')}đ`;
        const codeList = createdCodes.map(c => `<code style="background:#f0fdf4;padding:2px 8px;border-radius:4px;font-weight:700;color:#166534;">${c}</code>`).join(' ');
        showMsg(`✅ Tạo thành công <b>${createdCodes.length}</b> mã (Giảm ${valueLabel}/mã - HSD hôm nay):<br>${codeList}`);

        document.getElementById('dcPhone').value = '';
        document.getElementById('dcValue').value = '';
        document.getElementById('dcLabel').value = '';
        document.getElementById('dcQty').value = '1';
        document.getElementById('dcMaxValue').value = '';

        loadDiscountCodes();
    } catch (err) {
        console.error(err);
        showMsg('Lỗi tạo mã. Thử lại!', true);
    }
};

window.loadDiscountCodes = async function () {
    const tbody = document.getElementById('discountsTableBody');
    tbody.innerHTML = '<tr><td colspan="7" class="loading-text">Đang tải...</td></tr>';
    const todayStr = new Date().toLocaleDateString('vi-VN');

    try {
        const snap = await get(ref(db, 'discount_codes'));
        const codes = snap.exists() ? snap.val() : {};
        // Show all codes for today
        const todayCodes = Object.entries(codes).filter(([, v]) => v.expires_date === todayStr);

        // Fetch Lucky Wheel Codes
        const lwSnap = await get(ref(db, 'lucky_wheel/winners'));
        let todayLwCodes = [];
        if (lwSnap.exists()) {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const startOfDayTs = startOfDay.valueOf();

            const lwWinners = lwSnap.val();
            const lwPromises = Object.values(lwWinners)
                .filter(v => v.timestamp >= startOfDayTs && v.voucherId)
                .map(async (v) => {
                    const vSnap = await get(ref(db, `users/${v.uid}/vouchers/${v.voucherId}`));
                    const vData = vSnap.exists() ? vSnap.val() : null;
                    return [
                        v.voucherId,
                        {
                            label: `Vòng Quay - ${v.prizeLabel}`,
                            phone: `${v.name || 'Khách'} (VQMM)`,
                            discount_value: v.prizeType === 'special' ? 100 : 10000,
                            isPercent: v.prizeType === 'special',
                            expires_date: todayStr,
                            status: vData ? (vData.status === 'active' ? 'unused' : vData.status) : 'deleted',
                            isLuckyWheel: true,
                            uid: v.uid
                        }
                    ];
                });
            todayLwCodes = await Promise.all(lwPromises);
        }

        const allCodes = [...todayCodes, ...todayLwCodes];

        if (allCodes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="loading-text">Không có mã nào trong hôm nay.</td></tr>';
            return;
        }

        tbody.innerHTML = allCodes.map(([code, data]) => {
            const isUnused = data.status === 'unused';
            const valueDisplay = data.isPercent ? `-${data.discount_value}%` : `-${parseInt(data.discount_value).toLocaleString('vi-VN')}đ`;

            return `
            <tr>
                <td><strong style="font-family:monospace; color:#4f46e5; font-size:1rem;">${code}</strong></td>
                <td>${data.label || '-'}</td>
                <td>${data.phone || 'Tất cả'}</td>
                <td style="color:#10b981; font-weight:700;">${valueDisplay}</td>
                <td>${data.expires_date}</td>
                <td>
                    <span style="padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.8rem; font-weight: 700;
                        background: ${isUnused ? '#dcfce7' : '#fee2e2'};
                        color: ${isUnused ? '#166534' : '#991b1b'};">
                        ${isUnused ? '✅ Còn Hiệu Lực' : '❌ Đã Dùng / Hết Hạn'}
                    </span>
                </td>
                <td>
                    ${data.isLuckyWheel ?
                    `<span style="color:#94a3b8; font-size:0.8rem;">Từ VQMM</span>` :
                    `<button onclick="deleteDiscountCode('${code}')" class="btn btn-danger btn-sm" style="padding:0.3rem 0.7rem; font-size:0.8rem; background:#ef4444; color:white; border:none; border-radius:6px; cursor:pointer;">Xóa</button>`
                }
                </td>
            </tr>
            `;
        }).join('');
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="7" class="loading-text">Lỗi tải dữ liệu.</td></tr>';
    }
};

window.deleteDiscountCode = async function (code) {
    if (!confirm(`Bạn chắc chắn muốn xóa mã "${code}"?`)) return;
    try {
        await set(ref(db, `discount_codes/${code}`), null);
        loadDiscountCodes();
    } catch (err) {
        alert('Lỗi xóa mã!');
    }
};

// ============================================
// SALES STATISTICS
// ============================================

// Set date picker to today on page load
(function () {
    const picker = document.getElementById('statsDatePicker');
    if (picker) {
        const today = new Date();
        picker.value = today.toISOString().split('T')[0]; // YYYY-MM-DD
    }
})();

window.loadStats = async function () {
    const picker = document.getElementById('statsDatePicker');
    const selectedDate = picker ? picker.value : null; // YYYY-MM-DD

    // Reset UI
    ['statTotalOrders', 'statRevenue', 'statDiscountUsed', 'statTotalDiscount', 'statPoints'].forEach(id => {
        document.getElementById(id).textContent = '...';
    });
    document.getElementById('statsTopProducts').innerHTML = '<tr><td colspan="4" style="padding:1rem;color:#94a3b8;text-align:center;">Đang tải...</td></tr>';
    document.getElementById('statsOrdersBody').innerHTML = '<tr><td colspan="7" class="loading-text">Đang tải...</td></tr>';
    document.getElementById('statsStatusBreakdown').innerHTML = '<p style="color:#94a3b8;text-align:center;">Đang tải...</p>';

    try {
        const snap = await get(ref(db, 'orders'));
        if (!snap.exists()) {
            document.getElementById('statsOrdersBody').innerHTML = '<tr><td colspan="7" class="loading-text">Chưa có đơn hàng nào.</td></tr>';
            return;
        }

        const allOrders = snap.val();
        // Filter by selected date
        const dayOrders = Object.entries(allOrders).filter(([, o]) => {
            if (!o.createdAt) return false;
            const orderDate = o.createdAt.split('T')[0]; // YYYY-MM-DD
            return orderDate === selectedDate;
        });

        // ----- Aggregations -----
        let totalRevenue = 0, totalDiscount = 0, discountUsedCount = 0, totalPoints = 0;
        const productSales = {}; // { name: { qty, revenue } }
        const statusCount = {};

        dayOrders.forEach(([, o]) => {
            const total = parseInt(o.totalAmount) || 0;
            const discount = parseInt(o.discountAmount) || 0;

            // Status count (tất cả đơn)
            statusCount[o.status] = (statusCount[o.status] || 0) + 1;

            // Chỉ tính doanh thu từ đơn đã xác nhận (processing / completed)
            if (o.status === 'pending') return;

            totalRevenue += total;
            totalDiscount += discount;
            if (o.discountCode) discountUsedCount++;
            totalPoints += Math.floor(total / 10000);

            // Products
            if (Array.isArray(o.items)) {
                o.items.forEach(item => {
                    if (!productSales[item.name]) productSales[item.name] = { qty: 0, revenue: 0 };
                    productSales[item.name].qty += item.quantity || 1;
                    productSales[item.name].revenue += (item.price || 0) * (item.quantity || 1);
                });
            }
        });

        // KPI Cards
        document.getElementById('statTotalOrders').textContent = dayOrders.length;
        document.getElementById('statRevenue').textContent = totalRevenue.toLocaleString('vi-VN') + 'đ';
        document.getElementById('statDiscountUsed').textContent = discountUsedCount;
        document.getElementById('statTotalDiscount').textContent = totalDiscount > 0 ? '-' + totalDiscount.toLocaleString('vi-VN') + 'đ' : '0đ';
        document.getElementById('statPoints').textContent = '+' + totalPoints;

        // Top Products
        const sortedProducts = Object.entries(productSales)
            .sort((a, b) => b[1].qty - a[1].qty)
            .slice(0, 10);

        const topProdTbody = document.getElementById('statsTopProducts');
        if (sortedProducts.length === 0) {
            topProdTbody.innerHTML = '<tr><td colspan="4" style="padding:1rem;color:#94a3b8;text-align:center;">Không có dữ liệu</td></tr>';
        } else {
            topProdTbody.innerHTML = sortedProducts.map(([name, data], i) => `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:0.7rem 1rem; font-weight:700; color:${i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : '#64748b'};">${i + 1}</td>
                    <td style="padding:0.7rem 1rem;">${name}</td>
                    <td style="padding:0.7rem 1rem; text-align:right; font-weight:700;">${data.qty}</td>
                    <td style="padding:0.7rem 1rem; text-align:right; color:#16a34a; font-weight:600;">${data.revenue.toLocaleString('vi-VN')}đ</td>
                </tr>
            `).join('');
        }

        // Status Breakdown
        const statusLabels = { pending: '⏳ Chờ Xử Lý', processing: '🔄 Đang Làm', completed: '✅ Hoàn Thành' };
        const statusColors = { pending: '#fef3c7', processing: '#dbeafe', completed: '#dcfce7' };
        const statusTextColors = { pending: '#92400e', processing: '#1e40af', completed: '#166534' };
        const breakdownHtml = Object.entries(statusCount).map(([status, count]) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem 1rem; margin-bottom:0.5rem; border-radius:8px; background:${statusColors[status] || '#f1f5f9'};">
                <span style="font-weight:600; color:${statusTextColors[status] || '#334155'}">${statusLabels[status] || status}</span>
                <span style="font-size:1.5rem; font-weight:800; color:${statusTextColors[status] || '#334155'}">${count}</span>
            </div>
        `).join('');
        document.getElementById('statsStatusBreakdown').innerHTML = breakdownHtml || '<p style="color:#94a3b8;text-align:center;">Không có dữ liệu</p>';

        // Full Orders Table
        const ordersTbody = document.getElementById('statsOrdersBody');
        if (dayOrders.length === 0) {
            ordersTbody.innerHTML = '<tr><td colspan="7" class="loading-text">Không có đơn hàng nào trong ngày này.</td></tr>';
        } else {
            // Sort newest first
            dayOrders.sort((a, b) => new Date(b[1].createdAt) - new Date(a[1].createdAt));
            ordersTbody.innerHTML = dayOrders.map(([, o]) => {
                const time = o.createdAt ? new Date(o.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '–';
                const items = Array.isArray(o.items)
                    ? o.items.map(it => `${it.name} (x${it.quantity})`).join(', ')
                    : '–';
                const subTotal = parseInt(o.subTotal || o.totalAmount) || 0;
                const discount = parseInt(o.discountAmount) || 0;
                const total = parseInt(o.totalAmount) || 0;
                const statusMap = { pending: '⏳ Chờ', processing: '🔄 Làm', completed: '✅ Xong' };
                return `
                    <tr>
                        <td style="white-space:nowrap;">${time}</td>
                        <td>${o.customerName || '–'}<br><small style="color:#94a3b8">${o.customerPhone || ''}</small></td>
                        <td style="max-width:220px; word-break:break-word; font-size:0.85rem;">${items}</td>
                        <td>${subTotal.toLocaleString('vi-VN')}đ</td>
                        <td style="color:${discount > 0 ? '#10b981' : '#94a3b8'};">${discount > 0 ? '-' + discount.toLocaleString('vi-VN') + 'đ<br><small>' + o.discountCode + '</small>' : '–'}</td>
                        <td style="font-weight:700; color:#0f172a;">${total.toLocaleString('vi-VN')}đ</td>
                        <td>${statusMap[o.status] || o.status}</td>
                    </tr>
                `;
            }).join('');
        }

    } catch (err) {
        console.error('Stats error:', err);
        document.getElementById('statsOrdersBody').innerHTML = '<tr><td colspan="7" class="loading-text">Lỗi tải dữ liệu thống kê.</td></tr>';
    }
};

window.printStats = function () {
    window.print();
};
