import {EngineTypes, SessionTypes} from '@walletconnect/types';
import {
  WALLETCONNECT_MULTIVERSX_METHODS,
  WALLETCONNECT_MULTIVERSX_NAMESPACE,
} from './constants';
import {Address} from '@multiversx/sdk-core';
import Client from '@walletconnect/sign-client';
import {errors} from './errorMessages';
import {ConnectParamsTypes} from './types';
import {optionalOperation} from './operation';

export function getConnectionParams(
  chainId: string,
  options?: ConnectParamsTypes,
): EngineTypes.FindParams {
  const methods = [
    ...WALLETCONNECT_MULTIVERSX_METHODS,
    ...(options?.methods ?? []),
  ];
  if (!options?.methods?.includes(optionalOperation.SIGN_LOGIN_TOKEN)) {
    methods.push(optionalOperation.SIGN_LOGIN_TOKEN);
  }
  const chains = [`${WALLETCONNECT_MULTIVERSX_NAMESPACE}:${chainId}`];
  const events = options?.events ?? [];

  return {
    requiredNamespaces: {
      [WALLETCONNECT_MULTIVERSX_NAMESPACE]: {
        methods,
        chains,
        events,
      },
    },
  };
}

export function getCurrentSession(
  chainId: string,
  client?: Client,
): SessionTypes.Struct {
  if (!client) throw new Error(errors.clientNotInit);

  const acknowledgedSessions = client
    .find(getConnectionParams(chainId))
    .filter(s => s.acknowledged);

  if (acknowledgedSessions.length > 0) {
    const lastKeyIndex = acknowledgedSessions.length - 1;
    const session = acknowledgedSessions[lastKeyIndex];

    return session;
  }

  if (client.session.length > 0) {
    const lastKeyIndex = client.session.keys.length - 1;
    const session = client.session.get(client.session.keys[lastKeyIndex]);

    return session;
  }

  throw new Error(errors.sessionNotConnected);
}

export function getCurrentTopic(
  chainId: string,
  client?: Client,
): SessionTypes.Struct['topic'] {
  if (!client) throw new Error(errors.clientNotInit);

  const session = getCurrentSession(chainId, client);
  if (!session?.topic) {
    throw new Error(errors.sessionNotConnected);
  }

  return session.topic;
}

export function getAddressFromSession(session: SessionTypes.Struct): string {
  const selectedNamespace =
    session.namespaces[WALLETCONNECT_MULTIVERSX_NAMESPACE];

  if (selectedNamespace && selectedNamespace.accounts) {
    // Use only the first address in case of multiple provided addresses
    const currentSession = selectedNamespace.accounts[0];
    const [_namespace, _reference, address] = currentSession.split(':');

    return address;
  }

  return '';
}

export function addressIsValid(address: string): boolean {
  try {
    const addr = Address.fromBech32(address);
    return !addr.isEmpty();
  } catch {
    return false;
  }
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
