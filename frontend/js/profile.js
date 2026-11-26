/**
 * StudySync AI - Student Profile & Account Settings Client Logic
 */
let profileState = {
  user: null,
  stats: {}
};

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Load Profile & Statistics
  await loadUserProfile();

  // 2. Setup Form Handlers
  setupFormHandlers();

  // 3. Setup Logout Handler
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
      await API.logout();
    } finally {
      window.location.replace('/pages/login.html');
    }
  });
});

/**
 * Fetch and display user profile & metrics
 */
async function loadUserProfile() {
  try {
    const res = await API.getProfile();
    if (!res || !res.success || !res.data || !res.data.user) {
      window.location.replace('/pages/login.html');
      return;
    }

    profileState.user = res.data.user;
    profileState.stats = res.data.stats || {};

    const u = profileState.user;
    const s = profileState.stats;

    const initials = (u.name || 'ST').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();

    // Top Navigation
    const navName = document.getElementById('userNavName');
    const navAvatar = document.getElementById('userAvatar');
    if (navName) navName.textContent = u.name;
    if (navAvatar) navAvatar.textContent = initials;

    // Profile Hero Card
    document.getElementById('profileAvatarLarge').textContent = initials;
    document.getElementById('profileHeadingName').textContent = u.name;
    document.getElementById('profileRoleBadge').textContent = 'Student';
    document.getElementById('profileEmail').textContent = u.email;

    const instDept = [u.institution, u.department].filter(Boolean).join(' • ');
    document.getElementById('profileInstitutionDept').textContent = instDept || 'Student at StudySync AI';

    // Statistics
    document.getElementById('statRooms').textContent = s.roomsCount || 0;
    document.getElementById('statDoubts').textContent = `${s.doubtsCount || 0} (${s.solvedDoubtsCount || 0} resolved)`;
    document.getElementById('statSessions').textContent = s.sessionsCount || 0;
    document.getElementById('statKnowledge').textContent = s.knowledgeCount || 0;

    // Populate Edit Form
    document.getElementById('inputProfileName').value = u.name || '';
    document.getElementById('inputProfileEmail').value = u.email || '';
    document.getElementById('inputProfileInstitution').value = u.institution || '';
    document.getElementById('inputProfileDepartment').value = u.department || '';
    document.getElementById('inputProfileBio').value = u.bio || '';
  } catch (err) {
    console.error('[Profile] Failed to load user profile:', err.message);
    window.location.replace('/pages/login.html');
  }
}

/**
 * Setup Form Submit Handlers
 */
function setupFormHandlers() {
  // 1. Edit Profile Form
  const profileForm = document.getElementById('editProfileForm');
  profileForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSaveProfile');
    const alertBox = document.getElementById('profileAlert');

    const name = document.getElementById('inputProfileName').value.trim();
    const institution = document.getElementById('inputProfileInstitution').value.trim();
    const department = document.getElementById('inputProfileDepartment').value.trim();
    const bio = document.getElementById('inputProfileBio').value.trim();

    if (!name) {
      showAlert(alertBox, 'Full name cannot be blank.', 'error');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Saving...';
    }

    try {
      const res = await API.updateProfile({ name, institution, department, bio });
      if (res && res.success && res.data && res.data.user) {
        profileState.user = res.data.user;
        const initials = (name || 'ST').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();

        document.getElementById('profileHeadingName').textContent = name;
        document.getElementById('profileAvatarLarge').textContent = initials;
        document.getElementById('userNavName').textContent = name;
        document.getElementById('userAvatar').textContent = initials;

        const instDept = [institution, department].filter(Boolean).join(' • ');
        document.getElementById('profileInstitutionDept').textContent = instDept || 'Student at StudySync AI';

        showAlert(alertBox, 'Profile details updated successfully!', 'success');
      }
    } catch (err) {
      showAlert(alertBox, err.message || 'Failed to update profile.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Save Profile Changes';
      }
    }
  });

  // 2. Change Password Form
  const passwordForm = document.getElementById('changePasswordForm');
  passwordForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnChangePassword');
    const alertBox = document.getElementById('passwordAlert');

    const currentPassword = document.getElementById('inputCurrentPassword').value;
    const newPassword = document.getElementById('inputNewPassword').value;
    const confirmPassword = document.getElementById('inputConfirmPassword').value;

    if (newPassword !== confirmPassword) {
      showAlert(alertBox, 'New passwords do not match.', 'error');
      return;
    }

    if (newPassword.length < 6) {
      showAlert(alertBox, 'New password must be at least 6 characters.', 'error');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Updating...';
    }

    try {
      const res = await API.changePassword({ currentPassword, newPassword });
      if (res && res.success) {
        showAlert(alertBox, 'Password changed successfully!', 'success');
        passwordForm.reset();
      }
    } catch (err) {
      showAlert(alertBox, err.message || 'Could not change password.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Update Password';
      }
    }
  });
}

/**
 * Display Status Alert
 */
function showAlert(element, message, type) {
  if (!element) return;
  element.textContent = message;
  element.className = `status-alert-banner ${type}`;
  element.classList.remove('hidden');

  setTimeout(() => {
    element.classList.add('hidden');
  }, 4500);
}
