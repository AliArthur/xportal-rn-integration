import '@walletconnect/react-native-compat';

import React from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  useColorScheme,
} from 'react-native';
import LoginButton from './src/components/loginButton';
import {WalletConnect} from './src/wrapper/walletProvider';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaView>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <WalletConnect
        callbacks={{
          onClientLogin: () => {},
          onClientLogout: async () => {},
          onClientEvent: async () => {},
        }}
        chainId="1"
        projectId="9a2332f8a4940e749ddffb48e5297d14"
        metadata={{
          name: 'Example',
          description: 'WalletConnect Example App',
          url: 'https://walletconnect.com',
          icons: ['https://walletconnect.com/walletconnect-logo.png'],
        }}>
        <View style={style.container}>
          <LoginButton />
        </View>
      </WalletConnect>
    </SafeAreaView>
  );
}

const style = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;
