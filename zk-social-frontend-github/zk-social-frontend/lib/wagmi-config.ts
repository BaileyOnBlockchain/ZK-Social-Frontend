import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  rainbowWallet,
  coinbaseWallet,
  walletConnectWallet,
  injectedWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { base } from 'viem/chains';

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo';

if (!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) {
  console.warn('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. WalletConnect features may not work.');
}

export const config = getDefaultConfig({
  appName: 'PrivNet',
  projectId: walletConnectProjectId,
  chains: [base],
  ssr: true,
  wallets: [
    {
      groupName: 'Popular',
      wallets: [
        injectedWallet,    // Browser extension first — no WalletConnect relay needed
        coinbaseWallet,    // Own SDK, less relay-dependent
        metaMaskWallet,
        rainbowWallet,
        walletConnectWallet,
      ],
    },
  ],
});

export const isMobileBrowser = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};
