const https = require('https');

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

function request(url, method, body) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const req = https.request({
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

const DB_URL = "https://vqmm-8a365-default-rtdb.asia-southeast1.firebasedatabase.app";

async function run() {
    try {
        console.log("Fetching orders via REST...");
        const orders = await fetchJson(`${DB_URL}/orders.json`);
        if (!orders) {
            console.log("No orders found.");
            return;
        }

        let userToFix = null;
        let phone = null;
        let addr = null;

        // Find the user who has "Tuan Test" and "Nguyễn Văn B" orders
        for (const k in orders) {
            if (orders[k].customerName === "Nguyễn Văn B") {
                userToFix = orders[k].userId;
                phone = orders[k].customerPhone;
                addr = orders[k].deliveryAddress;
                break;
            }
        }

        if (!userToFix) {
            console.log("Could not find the target user.");
            return;
        }

        console.log("Target user:", userToFix);

        const updates = {};
        for (const k in orders) {
            if (orders[k].userId === userToFix) {
                if (orders[k].customerName !== "Nguyễn Văn B") {
                    console.log("Fixing order:", k, "old name:", orders[k].customerName);
                    updates[`orders/${k}/customerName`] = "Nguyễn Văn B";
                    updates[`orders/${k}/customerPhone`] = phone;
                    updates[`orders/${k}/deliveryAddress`] = addr;
                }
            }
        }

        if (Object.keys(updates).length > 0) {
            console.log("Sending updates:", updates);
            await request(`${DB_URL}/.json`, 'PATCH', updates);
            console.log("Database updated successfully.");
        } else {
            console.log("All orders for this user are already up to date.");
        }

    } catch (e) {
        console.error("ERROR", e);
    }
}
run();
