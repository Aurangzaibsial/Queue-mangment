/**
 * Role helpers and post-auth routing for Customer, Business, and Platform Admin flows.
 *
 * Backend roles:
 *   user       → Customer (books queue tokens)
 *   admin      → Business signup (pre-onboarding)
 *   owner      → Business operator (after business registration)
 *   superadmin → Platform admin
 */

export const ROLES = {
  CUSTOMER: 'user',
  BUSINESS_PENDING: 'admin',
  BUSINESS_OWNER: 'owner',
  PLATFORM_ADMIN: 'superadmin',
};

export const isCustomer = (role) => role === ROLES.CUSTOMER;
export const isBusinessUser = (role) =>
  role === ROLES.BUSINESS_PENDING || role === ROLES.BUSINESS_OWNER;
export const isPlatformAdmin = (role) => role === ROLES.PLATFORM_ADMIN;

export const getRoleLabel = (role) => {
  switch (role) {
    case 'user':
      return 'Customer';
    case 'admin':
      return 'Business';
    case 'owner':
      return 'Business Owner';
    case 'superadmin':
      return 'Platform Admin';
    default:
      return role;
  }
};

export const getRoleBadgeColor = (role) => {
  switch (role) {
    case 'user':
      return { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' };
    case 'admin':
    case 'owner':
      return { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' };
    case 'superadmin':
      return { bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' };
    default:
      return { bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' };
  }
};

/** Where to send the user after login or signup */
export const getPostAuthRedirect = (user, business, redirectTo) => {
  if (redirectTo && redirectTo !== '/auth' && redirectTo.startsWith('/')) {
    return redirectTo;
  }

  if (!user) return '/';

  if (isPlatformAdmin(user.role)) return '/superadmin';
  if (isCustomer(user.role)) return '/businesses';
  if (isBusinessUser(user.role)) return business ? '/dashboard' : '/settings';

  return '/';
};

/** Primary CTA destination for logged-in users on the landing page */
export const getHomeCtaPath = (user, business) => {
  if (!user) return '/auth?mode=signup&type=business';
  return getPostAuthRedirect(user, business);
};

export const getHomeCtaLabel = (user, business) => {
  if (!user) return 'Get Started Free';
  if (isCustomer(user.role)) return 'Browse Queues';
  if (isBusinessUser(user.role) && !business) return 'Complete Setup';
  return 'Go to Dashboard';
};

export const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: '', color: '#E2E8F0' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score: 1, label: 'Weak', color: '#EF4444' };
  if (score <= 2) return { score: 2, label: 'Fair', color: '#F59E0B' };
  if (score <= 3) return { score: 3, label: 'Good', color: '#3B82F6' };
  return { score: 4, label: 'Strong', color: '#10B981' };
};

export const validateSignupForm = ({ name, email, password, confirmPassword, agreedToTerms }) => {
  if (!name?.trim() || name.trim().length < 2) return 'Name must be at least 2 characters';
  if (!email?.trim()) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address';
  if (!password || password.length < 8) return 'Password must be at least 8 characters';
  if (!/(?=.*[A-Za-z])(?=.*\d)/.test(password)) return 'Password must contain a letter and a number';
  if (password !== confirmPassword) return 'Passwords do not match';
  if (!agreedToTerms) return 'Please accept the Terms of Service to continue';
  return null;
};
