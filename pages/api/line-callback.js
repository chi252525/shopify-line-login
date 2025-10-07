import fetch from 'node-fetch';

// 假設你已經在前端登入頁生成並存了 state，例如用 cookie 或 session
const validateState = (reqState) => {
  // TODO: 實作你的 state 驗證
  // 簡單示範：接受任何 state
  return !!reqState;
};

export default async function handler(req, res) {
  try {
    const { code, state } = req.query;

    // 1️⃣ 驗證 state 防止 CSRF
    if (!validateState(state)) {
      return res.status(400).send('Invalid state');
    }

    // 2️⃣ 讀取環境變數
    const clientId = process.env.LINE_CHANNEL_ID;
    const clientSecret = process.env.LINE_CHANNEL_SECRET;
    const redirectUri = `https://${req.headers.host}/api/line-callback`; 
    const shopifyStore = process.env.SHOPIFY_STORE;
    const shopifyApiKey = process.env.SHOPIFY_ADMIN_API_PASSWORD;

    // 3️⃣ 用 code 換取 LINE access_token
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret
      })
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return res.status(400).send('LINE token exchange failed');
    }

    // 4️⃣ 取得 LINE Profile
    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const profile = await profileRes.json();

    if (!profile || !profile.userId) {
      return res.status(400).send('Failed to fetch LINE profile');
    }

    const email = profile.email || `${profile.userId}@line.fake`; // LINE 沒提供 email 時，用 fake email

    // 5️⃣ 檢查 Shopify 顧客是否存在
    const searchRes = await fetch(
      `https://${shopifyStore}.myshopify.com/admin/api/2025-07/customers/search.json?query=email:${email}`,
      {
        headers: { 'X-Shopify-Access-Token': shopifyApiKey }
      }
    );
    const searchData = await searchRes.json();

    let customerId;

    if (searchData.customers && searchData.customers.length > 0) {
      // 顧客已存在 → 更新
      customerId = searchData.customers[0].id;
      await fetch(`https://${shopifyStore}.myshopify.com/admin/api/2025-07/customers/${customerId}.json`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': shopifyApiKey
        },
        body: JSON.stringify({
          customer: {
            id: customerId,
            first_name: profile.displayName,
            tags: 'LINE Login'
          }
        })
      });
    } else {
      // 顧客不存在 → 建立
      const createRes = await fetch(`https://${shopifyStore}.myshopify.com/admin/api/2025-07/customers.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': shopifyApiKey
        },
        body: JSON.stringify({
          customer: {
            first_name: profile.displayName,
            email,
            tags: 'LINE Login'
          }
        })
      });
      const createData = await createRes.json();
      customerId = createData.customer?.id;
    }

    // 6️⃣ 導回 Shopify 前台會員頁
    res.redirect('/account');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
}
