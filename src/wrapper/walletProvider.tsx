import {PropsWithChildren, createContext, useContext, useMemo} from 'react';
import {ClientOptions} from './types';
import {WalletConnectProvider} from '../walletConnectProvider/walletConnectProvider';
import {SignableMessage} from '@multiversx/sdk-core/out';

function useStore({
  chainId,
  projectId,
  metadata,
  callbacks,
  relay,
}: ClientOptions) {
  const {provider, login, sign} = useMemo(() => {
    const provider = new WalletConnectProvider(
      callbacks,
      chainId,
      relay ?? 'wss://relay.walletconnect.org',
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

  return {
    login,
    sign,
    provider,
  };
}

const WalletConnectContext = createContext<{
  provider?: WalletConnectProvider;
  login?: () => Promise<void>;
  sign?: () => Promise<void>;
}>({});

export function WalletConnect(props: PropsWithChildren<ClientOptions>) {
  const {children} = props;
  const store = useStore(props);

  return (
    <WalletConnectContext.Provider value={store}>
      {children}
    </WalletConnectContext.Provider>
  );
}

export function useProvider() {
  const context = useContext(WalletConnectContext);

  if (!context || !context.provider || !context.login || !context.sign) {
    throw new Error('useProvider must be used within a WalletConnectProvider');
  }

  return {
    provider: context.provider,
    login: context.login,
    sign: context.sign,
  };
}
