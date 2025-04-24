export default {
  // Common
  app_title: 'Nosskey SDK Demo App',
  home: 'Home',
  register: 'Register',
  login: 'Login',
  nostr_features: 'Nostr Features',
  footer_copyright: '© 2025 Nosskey SDK Demo',

  // Home page
  home_title: 'Nosskey SDK Sample Application',
  home_description:
    'This application demonstrates the Passkey-based Nostr key derivation functionality using Nosskey SDK.',
  passkey_check_title: 'Passkey Support Check',
  checking_browser: 'Checking browser compatibility...',
  passkey_supported:
    'This browser supports Passkeys! You can register or login to try the features.',
  passkey_not_supported:
    'This browser does not support Passkeys. Please use a Passkey-compatible browser (latest versions of Chrome, Firefox, Safari, etc.).',
  about_nosskey_title: 'About Nosskey SDK',
  about_nosskey_description:
    'Nosskey SDK is a library for securely deriving key pairs for Nostr using WebAuthn/Passkey technology. This allows users to access Nostr applications using secure methods like biometric authentication without managing raw private keys.',

  // Registration page
  register_title: 'Passkey Registration',
  register_description:
    'Enter a user ID to register a Passkey on this device. After registration, you can log in with the same ID.',
  user_id: 'User ID',
  user_id_placeholder: 'e.g. alice123',
  processing: 'Processing...',
  register_passkey: 'Register Passkey',
  enter_user_id: 'Please enter a user ID',
  passkey_register_success: 'Passkey registration successful!',
  passkey_register_failed: 'Passkey registration failed',
  registration_complete:
    'Registration complete. Please proceed to the login page for authentication.',
  go_to_login: 'Go to Login',
  error_occurred: 'An error occurred',

  // Login page
  login_title: 'Passkey Authentication (Login)',
  login_description:
    'Enter your registered user ID to authenticate with Passkey. Once authenticated, you can use the Nostr features.',
  passkey_auth: 'Passkey Authentication',
  login_success: 'Login successful!',
  derived_pubkey: 'Derived Nostr public key',
  try_nostr_features: 'Try using the Nostr features to send a message.',
  go_to_nostr: 'Go to Nostr Features',

  // Nostr features page
  nostr_title: 'Nostr Features',
  user_info: 'User Information',
  connected_relays: 'Connected Relays',
  message_sending: 'Message Sending',
  message_form_description: 'You can send Nostr messages using the form below.',
  message: 'Message',
  message_placeholder: 'Enter a message to send...',
  send_message: 'Send Message',
  sending_message: 'Sending...',
  enter_message: 'Please enter a message',
  secret_key_missing: 'Secret key not available. Please log in again.',
  message_sent: 'Message sent! (Mock response)',
  logout: 'Logout',
  language: 'Language',
};
