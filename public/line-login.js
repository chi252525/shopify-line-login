(function(){
  const LINE_CHANNEL_ID = "你的LINE_CHANNEL_ID";
  const REDIRECT_URI = "https://shopify-line-login.vercel.app/api/line-callback";

  function generateState(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  function initLineButton() {
    const container = document.querySelector('#line-login-container');
    if (!container) return;

    const btn = document.createElement('button');
    btn.innerText = '使用 LINE 登入';
    btn.onclick = function() {
      const state = generateState();
      document.cookie = `line_oauth_state=${state}; path=/; max-age=1800; SameSite=Lax; Secure`;
      const lineLoginUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${LINE_CHANNEL_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${state}&scope=profile%20openid%20email`;
      window.location.href = lineLoginUrl;
    };
    container.appendChild(btn);
  }

  document.addEventListener('DOMContentLoaded', initLineButton);
})();
