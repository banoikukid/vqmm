// file: profile.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getDatabase, ref, get, update } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

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

    } else {
        // User is signed out, redirect to login
        window.location.href = "login.html";
    }
});

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
