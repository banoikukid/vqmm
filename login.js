// file: login.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

// Firebase configuration (Same as script.js)
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
const authMessage = document.getElementById('authMessage');

function showMessage(msg, isError = false) {
    authMessage.textContent = msg;
    authMessage.className = `message ${isError ? 'error' : 'success'}`;
    authMessage.style.display = 'block';
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

// Global functions for HTML access
window.handleRegister = async function (e) {
    e.preventDefault();
    const name = document.getElementById('regName').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;

    if (!/(84|0[3|5|7|8|9])+([0-9]{8})\b/.test(phone)) {
        showMessage("Số điện thoại không hợp lệ!", true);
        return;
    }

    setBtnLoading('btnRegister', true);

    try {
        // 1. Create user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Save additional data to Realtime Database
        await set(ref(database, 'users/' + user.uid), {
            name: name,
            phone: phone,
            email: email,
            points: 0,
            address: "", // For future delivery
            createdAt: new Date().toISOString()
        });

        showMessage("Đăng ký thành công! Đang chuyển hướng...");

        // Auto redirect to Ordering page
        setTimeout(() => {
            window.location.href = "order.html";
        }, 1500);

    } catch (error) {
        let errorMsg = "Lỗi đăng ký. Vui lòng thử lại!";
        if (error.code === 'auth/email-already-in-use') {
            errorMsg = "Email này đã được sử dụng. Vui lòng đăng nhập!";
        } else if (error.code === 'auth/weak-password') {
            errorMsg = "Mật khẩu quá yếu. Cần ít nhất 6 ký tự.";
        }
        showMessage(errorMsg, true);
    } finally {
        setBtnLoading('btnRegister', false);
    }
};

window.handleLogin = async function (e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    setBtnLoading('btnLogin', true);

    try {
        await signInWithEmailAndPassword(auth, email, password);
        showMessage("Đăng nhập thành công! Đang chuyển hướng...");

        // redirect to Ordering page
        setTimeout(() => {
            window.location.href = "order.html";
        }, 1000);

    } catch (error) {
        let errorMsg = "Email hoặc mật khẩu không đúng!";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            errorMsg = "Sai thông tin đăng nhập. Bộ gõ có viết hoa hay không?";
        }
        showMessage(errorMsg, true);
    } finally {
        setBtnLoading('btnLogin', false);
    }
};

window.handleResetPassword = async function (e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();

    if (!email) {
        showMessage("Vui lòng điền Email vào ô trống phía trên trước khi bấm 'Quên mật khẩu'", true);
        return;
    }

    try {
        await sendPasswordResetEmail(auth, email);
        showMessage("Hệ thống đã gửi link đổi mật khẩu vào Email của bạn. Vui lòng kiểm tra Hộp thư đến (hoặc thư Rác)!");
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            showMessage("Email này chưa được đăng ký trong hệ thống!", true);
        } else {
            showMessage("Lỗi gửi email reset. Vui lòng thử lại sau.", true);
        }
    }
};
