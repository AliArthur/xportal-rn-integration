import {SignClientTypes} from '@walletconnect/types';
import {IClientConnect} from '../walletConnectProvider/types';

export type ClientOptions = {
  callbacks: IClientConnect;
  chainId: '1' | 'D' | 'T';
  projectId: string;
  metadata: SignClientTypes.Metadata;
  options?: SignClientTypes.Options;

  /**
   * @default 'wss://relay.walletconnect.org'
   */
  relay?: string;
};
