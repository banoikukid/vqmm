import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, update, query, orderByChild, equalTo } from "firebase/database";

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
const database = getDatabase(app);

async function run() {
    try {
        console.log("Fetching orders with unindexed query...");
        // the user id might be from one of the orders we see
        // Let's just fetch all orders and see the discrepancy
        const snap = await get(ref(database, 'orders'));
        const orders = snap.val();
        let uid = null;
        for (const k in orders) {
            if (orders[k].customerName === "Tuan Test" || orders[k].customerName === "Nguyễn Văn B") {
                uid = orders[k].userId;
                break;
            }
        }
        console.log("Found userId:", uid);

        // Try the query
        const q = query(ref(database, 'orders'), orderByChild('userId'), equalTo(uid));
        const userOrders = await get(q);
        console.log("Query matched:", userOrders.size, "orders");

        // Update them to "Nguyễn Văn B"
        const updates = {};
        userOrders.forEach(cs => {
            updates[`orders/${cs.key}/customerName`] = "Nguyễn Văn B";
        });
        await update(ref(database), updates);
        console.log("Updated!");
        process.exit(0);
    } catch (e) {
        console.error("ERROR:", e);
        process.exit(1);
    }
}
run();
