import Client from '@walletconnect/sign-client';
import {
  PairingTypes,
  SessionTypes,
  SignClientTypes,
} from '@walletconnect/types';
import {ConnectParamsTypes, IClientConnect, SessionEventTypes} from './types';
import {errors} from './errorMessages';
import {
  addressIsValid,
  getAddressFromSession,
  getConnectionParams,
  getCurrentSession,
  getCurrentTopic,
  sleep,
} from './utils';
import {getSdkError, isValidArray} from '@walletconnect/utils';
import {Logger} from './logger';
import {
  MULTIVERSX_DEEPLINK_URL,
  WALLETCONNECT_MULTIVERSX_NAMESPACE,
  WALLETCONNECT_SIGN_LOGIN_DELAY,
} from './constants';
import {operation, optionalOperation} from './operation';
import {Linking} from 'react-native';
import {SignableMessage} from '@multiversx/sdk-core';
import {Signature} from '@multiversx/sdk-core/out/signature';

export class WalletConnectProvider {
  private readonly walletConnectV2Relay: string;
  private readonly walletConnectV2ProjectId: string;
  private readonly chainId: string = '';
  private readonly options: SignClientTypes.Options | undefined = {};
  private readonly metadata: SignClientTypes.Metadata;

  private processingTopic: string = '';
  private client: Client | undefined;
  private session: SessionTypes.Struct | undefined;
  private onClientConnect: IClientConnect;
  private wcUri: string | undefined;

  private address: string = '';
  private signature: string = '';

  isInitializing: boolean = false;

  constructor(
    onClientConnect: IClientConnect,
    chainId: string,
    walletConnectV2Relay: string,
    walletConnectV2ProjectId: string,
    metadata: SignClientTypes.Metadata,
    options?: SignClientTypes.Options,
  ) {
    this.onClientConnect = onClientConnect;
    this.chainId = chainId;
    this.walletConnectV2Relay = walletConnectV2Relay;
    this.walletConnectV2ProjectId = walletConnectV2ProjectId;
    this.metadata = metadata;
    this.options = options;
  }

  private async loginAccount(options?: {address: string; signature?: string}) {
    if (!options) return '';

    if (!addressIsValid(options.address)) {
      this.logout();
      return '';
    }

    this.address = options.address;
    this.signature = options.signature || '';
    this.onClientConnect.onClientLogin();

    return this.address;
  }

  private reset() {
    this.address = '';
    this.signature = '';
    this.client = undefined;
    this.session = undefined;
  }

  private async onSessionConnected(options?: {
    session: SessionTypes.Struct;
    signature?: string;
  }) {
    if (!options) return '';

    this.session = options.session;
    const address = getAddressFromSession(this.session);

    if (!address) return '';
    await this.loginAccount({address, signature: options.signature});
    return address;
  }

  private async cleanupPendingPairings(
    options: {deletePairings?: boolean} = {},
  ) {
    if (typeof this.client === 'undefined') return;

    try {
      const inactivePairings = this.client.core?.pairing?.pairings?.getAll({
        active: false,
      });
      if (!isValidArray(inactivePairings)) return;

      for (const pairing of inactivePairings) {
        if (options.deletePairings) {
          this.client.core?.expirer?.set(pairing.topic, 0);
          continue;
        }
        try {
          await this.client.core?.relayer?.subscriber?.unsubscribe(
            pairing.topic,
          );
        } catch (error) {
          Logger.error(errors.unableToHandleCleanup);
        }
      }
    } catch (error) {
      Logger.error(errors.unableToHandleCleanup);
    }
  }

  private async handleSessionEvents({
    topic,
    params,
  }: {
    topic: string;
    params: SessionEventTypes;
  }) {
    if (typeof this.client === 'undefined')
      throw new Error(errors.clientNotInit);
    if (this.session && this.session?.topic !== topic) {
      return;
    }

    const {event} = params;
    if (event?.name && getCurrentTopic(this.chainId, this.client) === topic) {
      const eventData = event.data;

      this.onClientConnect.onClientEvent(eventData);
    }
  }

  private async handleTopicUpdateEvent({topic}: {topic: string}) {
    if (typeof this.client === 'undefined') {
      Logger.error(errors.clientNotInit);
      return;
    }

    try {
      const existingPairings = await this.getPairings();

      if (this.address && !this.isInitializing && existingPairings) {
        if (existingPairings?.length === 0) {
          this.onClientConnect.onClientLogout();
        } else {
          const lastActivePairing =
            existingPairings[existingPairings.length - 1];

          if (lastActivePairing?.topic === topic) {
            this.onClientConnect.onClientLogout();
          }
        }
      }
    } catch (error) {
      Logger.error(errors.unableToHandleTopic);
    }
  }

  private async subscribeToEvents(client: Client) {
    if (typeof client === 'undefined') throw new Error(errors.clientNotInit);

    try {
      client.on('session_update', ({topic, params}) => {
        if (!this.session || this.session?.topic !== topic) {
          return;
        }

        const {namespaces} = params;
        const _session = client.session.get(topic);
        const updatedSession = {..._session, namespaces};
        this.onSessionConnected({session: updatedSession});
      });

      client.on('session_event', this.handleSessionEvents.bind(this));

      client.on('session_delete', async ({topic}) => {
        if (this.isInitializing) {
          this.onClientConnect.onClientLogout();
          this.reset();
        }

        if (!this.session || this.session?.topic !== topic) {
          return;
        }

        this.onClientConnect.onClientLogout();
        this.reset();

        await this.cleanupPendingPairings({deletePairings: true});
      });

      client.on('session_expire', async ({topic}) => {
        if (!this.session || this.session?.topic !== topic) {
          return;
        }

        Logger.error(errors.sessionExpired);
        this.onClientConnect.onClientLogout();

        this.reset();
        await this.cleanupPendingPairings({deletePairings: true});
      });

      // Pairing events
      client.core?.pairing?.events.on(
        'pairing_delete',
        this.handleTopicUpdateEvent.bind(this),
      );

      client.core?.pairing?.events.on(
        'pairing_expire',
        this.handleTopicUpdateEvent.bind(this),
      );
    } catch (error) {
      throw new Error(errors.unableToHandleEvent);
    }
  }

  private async checkPersistedState(client: Client) {
    if (typeof client === 'undefined') throw new Error(errors.clientNotInit);

    if (typeof this.session === 'undefined') return;

    if (client.session.length && !this.address && !this.isInitializing) {
      const session = getCurrentSession(this.chainId, client);
      if (session) {
        await this.onSessionConnected({session});

        return session;
      }
    }

    return;
  }

  isInitialized(): boolean {
    return !!this.client && !this.isInitializing;
  }

  isConnected() {
    return this.isInitialized() && typeof this.session !== 'undefined';
  }

  /**
   * Initiates WalletConnect client.
   */
  async init() {
    if (this.isInitializing) throw new Error(errors.initProcessStarted);
    if (this.isInitialized()) this.isInitialized();
    this.isInitializing = true;
    this.reset();

    try {
      const client = await Client.init({
        ...this.options,
        relayUrl: this.walletConnectV2Relay,
        projectId: this.walletConnectV2ProjectId,
        metadata: this.metadata,
      });

      this.client = client;
      this.isInitializing = false;

      await this.subscribeToEvents(client);
      await this.checkPersistedState(client);
    } catch (error) {
      throw new Error(errors.unableToInit);
    } finally {
      this.isInitializing = false;
      return this.isInitialized();
    }
  }

  async connect(options?: ConnectParamsTypes) {
    if (typeof this.client === 'undefined') {
      throw new Error(errors.clientNotInit);
    }

    const connectParams = getConnectionParams(this.chainId, options);

    try {
      const response = await this.client.connect({
        pairingTopic: options?.topic,
        ...connectParams,
      });
      this.wcUri = response.uri;

      return response;
    } catch (error) {
      this.reset();
      throw new Error(
        options?.topic
          ? errors.unableToConnectExisting
          : errors.unableToConnect,
      );
    }
  }

  async login(options?: {
    approval?: () => Promise<SessionTypes.Struct>;
    token?: string;
  }) {
    this.isInitializing = true;

    if (typeof this.client === 'undefined') {
      throw new Error(errors.clientNotInit);
    }

    if (typeof this.session !== 'undefined') {
      await this.logout();
    }

    if (!options || !options.approval || !this.wcUri) return '';
    const url = `${MULTIVERSX_DEEPLINK_URL}?wallet-connect=${encodeURIComponent(
      this.wcUri,
    )}`;

    const canOpenUri = await Linking.canOpenURL(url);
    if (!canOpenUri) throw new Error(errors.unableToConnect);

    await Linking.openURL(url);
    try {
      const session = await options.approval();

      if (options.token) {
        await sleep(WALLETCONNECT_SIGN_LOGIN_DELAY);
        const address = getAddressFromSession(session);

        const selectedNamespace =
          session.namespaces[WALLETCONNECT_MULTIVERSX_NAMESPACE];
        const method = selectedNamespace.methods.includes(
          optionalOperation.SIGN_NATIVE_AUTH_TOKEN,
        )
          ? optionalOperation.SIGN_NATIVE_AUTH_TOKEN
          : optionalOperation.SIGN_LOGIN_TOKEN;

        const {signature}: {signature: string} = await this.client.request({
          chainId: `${WALLETCONNECT_MULTIVERSX_NAMESPACE}:${this.chainId}`,
          topic: session.topic,
          request: {
            method,
            params: {
              token: options.token,
              address,
            },
          },
        });

        if (!signature) throw new Error(errors.unableToSignLoginToken);
        return this.onSessionConnected({session, signature});
      }

      return this.onSessionConnected({session});
    } catch (error) {
      throw new Error(errors.unableToLogin);
    } finally {
      this.isInitializing = false;
    }
  }

  async logout(options?: {topic?: string}) {
    if (typeof this.client === 'undefined') {
      throw new Error(errors.clientNotInit);
    }

    try {
      if (
        this.processingTopic ===
        (options?.topic || getCurrentTopic(this.chainId, this.client))
      ) {
        return true;
      }

      if (options?.topic) {
        this.processingTopic = options.topic;
        await this.client.disconnect({
          topic: options.topic,
          reason: getSdkError('USER_DISCONNECTED'),
        });
      } else {
        const currentSessionTopic = getCurrentTopic(this.chainId, this.client);
        this.processingTopic = currentSessionTopic;
        await this.client.disconnect({
          topic: currentSessionTopic,
          reason: getSdkError('USER_DISCONNECTED'),
        });

        this.reset();

        await this.cleanupPendingPairings({deletePairings: true});
      }
    } catch {
      Logger.error(errors.alreadyLoggedOut);
    } finally {
      this.processingTopic = '';
    }
  }

  async signMessage(message: SignableMessage) {
    if (typeof this.client === 'undefined') {
      throw new Error(errors.clientNotInit);
    }

    if (typeof this.session === 'undefined') {
      this.onClientConnect.onClientLogout();
      throw new Error(errors.sessionNotConnected);
    }

    const canOpenUri = await Linking.canOpenURL(MULTIVERSX_DEEPLINK_URL);
    if (!canOpenUri) throw new Error(errors.unableToConnect);

    await Linking.openURL(MULTIVERSX_DEEPLINK_URL);
    const address = this.getAddress();
    const {signature} = await this.client.request<{signature: string}>({
      chainId: `${WALLETCONNECT_MULTIVERSX_NAMESPACE}:${this.chainId}`,
      topic: getCurrentTopic(this.chainId, this.client),
      request: {
        method: operation.SIGN_MESSAGE,
        params: {
          address,
          message: message.message.toString(),
        },
      },
    });

    if (!signature) throw new Error(errors.invalidMessageResponse);

    try {
      message.applySignature(new Signature(signature));
    } catch (error) {
      throw new Error(errors.invalidMessageSignature);
    }

    return message;
  }

  async getPairings() {
    if (typeof this.client === 'undefined') {
      throw new Error(errors.clientNotInit);
    }

    return this.client?.core?.pairing?.pairings?.getAll({active: true}) ?? [];
  }

  getAddress() {
    if (typeof this.client === 'undefined') {
      throw new Error(errors.clientNotInit);
    }

    return this.address;
  }

  getSignature() {
    if (typeof this.client === 'undefined') {
      throw new Error(errors.clientNotInit);
    }

    return this.signature;
  }
}
