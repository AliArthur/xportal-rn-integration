import {useMemo} from 'react';
import {WalletConnectProvider} from './../walletConnectProvider/walletConnectProvider';
import {chainId, metadata, projectId, relayUrl} from './../app.config';
import {SignableMessage} from '@multiversx/sdk-core/out';

export default function useProvider() {
  const provider = useMemo(() => {
    const callbacks = {
      onClientLogin: () => {},
      onClientLogout: async () => {},
      onClientEvent: async () => {},
    };

    const provider = new WalletConnectProvider(
      callbacks,
      chainId,
      relayUrl,
      projectId,
      metadata,
    );

    const login = async () => {
      await provider.init();
      const {approval} = await provider.connect();

      await provider.login({approval});
    };

    const sign = async () => {
      const toSign = new SignableMessage({
        message: Buffer.from('Hello World'),
      });

      await provider.signMessage(toSign);
      console.log(toSign.toJSON());
    };

    return {
      login,
      sign,
      provider,
    };
  }, []);

  return provider;
}
