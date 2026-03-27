/**
 * Base Paymaster integration for gasless transactions
 * Supports gasless tipping for first 5 tips per user (EIP-4337)
 */

import { Abi, type Address, type Hex, encodeFunctionData, parseAbi } from 'viem';
import { CONTRACT_ADDRESSES, SOCIAL_NETWORK_ABI } from './contracts';

const PAYMASTER_ABI = parseAbi([
  'function approveTransaction(address, uint256, bytes) external',
  'function validatePaymasterUserOp((address,uint256,bytes32,bytes32,uint256,uint256,uint256,uint256,uint256,bytes32,bytes32), bytes32, uint256) external returns (bytes4, uint256)',
]);

export function isEligibleForGaslessTip(userAddress: Address, tipCount: number): boolean {
  const MAX_GASLESS_TIPS = 5;
  return tipCount < MAX_GASLESS_TIPS;
}

export function getPaymasterParams(
  userAddress: Address,
  tipAmount: bigint,
  postId: Hex
): { paymaster: Address; paymasterInput: Hex } {
  const paymasterAddress = '0x0000000000000000000000000000000000000000' as Address;

  const paymasterInput = encodeFunctionData({
    abi: PAYMASTER_ABI,
    functionName: 'approveTransaction',
    args: [userAddress, tipAmount, postId],
  }) as Hex;

  return { paymaster: paymasterAddress, paymasterInput };
}

export function createGaslessTipTransaction(
  postId: Hex,
  recipient: Address,
  tipAmount: bigint,
  userAddress: Address,
  tipCount: number
) {
  const isGasless = isEligibleForGaslessTip(userAddress, tipCount);

  const baseTransaction = {
    to: CONTRACT_ADDRESSES.SOCIAL_NETWORK,
    data: encodeFunctionData({
      abi: SOCIAL_NETWORK_ABI as Abi,
      functionName: 'tipPost',
      args: [postId, recipient],
    }) as Hex,
    value: tipAmount,
  };

  if (isGasless) {
    const { paymaster, paymasterInput } = getPaymasterParams(userAddress, tipAmount, postId);
    return {
      ...baseTransaction,
      paymaster,
      paymasterInput,
      customData: {
        paymasterParams: { paymaster, paymasterInput },
        gasPerPubdata: '50000' as Hex,
      },
    };
  }

  return baseTransaction;
}

export function getUserTipCount(userAddress: Address): number {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(`privnet_tip_count_${userAddress}`);
    return stored ? Number.parseInt(stored, 10) : 0;
  }
  return 0;
}

export function incrementTipCount(userAddress: Address): void {
  if (typeof window !== 'undefined') {
    const current = getUserTipCount(userAddress);
    localStorage.setItem(`privnet_tip_count_${userAddress}`, (current + 1).toString());
  }
}
