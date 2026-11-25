/**
 * StudySync AI - Authentication Page Handler (Login & Register)
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Check if student is already logged in; if so, redirect directly to dashboard
  try {
    const me = await API.getMe();
    if (me && me.success && me.data && me.data.user) {
      window.location.replace('/pages/dashboard.html');
      return;
    }
  } catch (e) {
    // Expected when not logged in
  }

  // --- LOGIN FORM HANDLER ---
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAlert();

      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const submitBtn = document.getElementById('loginSubmitBtn');

      if (!email || !password) {
        showAlert('Please fill in both email and password.', 'error');
        return;
      }

      try {
        setLoading(submitBtn, true, 'Logging in...');
        const res = await API.login({ email, password });

        if (res.success) {
          showAlert('Login successful! Redirecting to dashboard...', 'success');
          setTimeout(() => {
            window.location.replace('/pages/dashboard.html');
          }, 600);
        }
      } catch (err) {
        showAlert(err.message || 'Invalid email or password.', 'error');
        setLoading(submitBtn, false, 'Log in');
      }
    });
  }

  // --- REGISTER FORM HANDLER ---
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAlert();

      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const course = document.getElementById('course').value.trim();
      const password = document.getElementById('password').value;
      const termsAccepted = document.getElementById('terms').checked;
      const submitBtn = document.getElementById('registerSubmitBtn');

      // Validation
      if (!name) {
        showAlert('Please enter your full name.', 'error');
        return;
      }
      if (!email) {
        showAlert('Please enter your college email address.', 'error');
        return;
      }
      if (!password || password.length < 8) {
        showAlert('Password must be at least 8 characters long and contain a number.', 'error');
        return;
      }
      if (!/\d/.test(password)) {
        showAlert('Password must include at least one number.', 'error');
        return;
      }
      if (!termsAccepted) {
        showAlert('Please agree to the Terms and Privacy Policy to proceed.', 'error');
        return;
      }

      try {
        setLoading(submitBtn, true, 'Creating account...');
        const res = await API.register({
          name,
          email,
          password,
          department: course,
          termsAccepted
        });

        if (res.success) {
          showAlert('Account created successfully! Taking you to dashboard...', 'success');
          setTimeout(() => {
            window.location.replace('/pages/dashboard.html');
          }, 800);
        }
      } catch (err) {
        showAlert(err.message || 'Could not create account. Please try again.', 'error');
        setLoading(submitBtn, false, 'Create account');
      }
    });
  }

  // --- FORGOT PASSWORD LINK HANDLER ---
  const forgotLink = document.getElementById('forgotPasswordLink');
  if (forgotLink) {
    forgotLink.addEventListener('click', async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('email');
      const email = emailInput ? emailInput.value.trim() : '';
      
      try {
        const res = await API.forgotPassword(email);
        showAlert(res.message, 'info');
      } catch (err) {
        showAlert(err.message, 'error');
      }
    });
  }

  // --- GOOGLE SIGN-IN BUTTON (PROTOTYPE NOTICE) ---
  const googleBtn = document.getElementById('googleSignInBtn');
  if (googleBtn) {
    googleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showAlert('Google sign-in is enabled for institutional accounts. For this demonstration, please use email & password authentication below.', 'info');
    });
  }

  // Helper UI utilities
  function showAlert(msg, type = 'error') {
    const alertBox = document.getElementById('authAlert');
    if (!alertBox) return;

    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = msg;
    alertBox.classList.remove('hidden');
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function clearAlert() {
    const alertBox = document.getElementById('authAlert');
    if (!alertBox) return;
    alertBox.className = 'alert hidden';
    alertBox.textContent = '';
  }

  function setLoading(btn, isLoading, text) {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.textContent = text;
  }
});
