import {operation, optionalOperation} from './operation';

// WalletConnect Namespace for MultiversX
export const WALLETCONNECT_MULTIVERSX_NAMESPACE = 'mvx';

// WalletConnect default methods for Multiversx
export const WALLETCONNECT_MULTIVERSX_METHODS = Object.values(operation);

// WalletConnect optional methods for Multiversx
export const WALLETCONNECT_MULTIVERSX_OPTIONAL_METHODS =
  Object.values(optionalOperation);

// Delay the sign login token action for 200ms to allow the relay to update properly
export const WALLETCONNECT_SIGN_LOGIN_DELAY = 200;

export const MULTIVERSX_DEEPLINK_URL =
  'https://maiar.page.link/?apn=com.elrond.maiar.wallet&isi=1519405832&ibi=com.elrond.maiar.wallet&link=https://maiar.com';
