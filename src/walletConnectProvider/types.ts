import {SessionTypes} from '@walletconnect/types';

export type SessionEventTypes = {
  event: {
    name: string;
    data: any;
  };
  chainId: string;
};

export interface IClientConnect {
  onClientLogin: () => void;
  onClientLogout(): void;
  onClientEvent: (event: SessionEventTypes['event']) => void;
}

export interface ConnectParamsTypes {
  topic?: string;
  events?: SessionTypes.Namespace['events'];
  methods?: string[];
}
