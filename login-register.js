/* Dùng chung cho dang-nhap.html và dang-ky.html
   Nạp TRƯỚC script riêng của từng trang:  const { $, SPINNER, ... } = KD; */
window.KD = (() => {
  'use strict';

  /* Đổi đường dẫn này nếu trang chủ của bạn khác */
  const HOME_URL = '/';

  const $ = (id) => document.getElementById(id);
  const SPINNER = '<i class="ri-loader-4-line kd-spinner"></i>';

  const getToken = () => localStorage.getItem('kd_session_token') || '';
  const setToken = (t) => localStorage.setItem('kd_session_token', t);
  const setProfile = (p) => { try { localStorage.setItem('kd_profile', JSON.stringify(p)); } catch (e) {} };

  async function postJson(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res.json();
  }

  /* đã đăng nhập thì về trang chủ */
  if (getToken()) window.location.replace(HOME_URL);

  return { HOME_URL, $, SPINNER, getToken, setToken, setProfile, postJson };
})();
