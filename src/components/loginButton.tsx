import {Pressable, StyleSheet, Text} from 'react-native';
import useProvider from '../hooks/useProvider';

export default function LoginButton() {
  const {login, sign, provider} = useProvider();

  if (!provider.isConnected()) {
    return (
      <Pressable style={style.buttonContainer} onPress={login}>
        <Text style={style.text}>Login</Text>
      </Pressable>
    );
  }

  return (
    <Pressable style={style.buttonContainer} onPress={sign}>
      <Text style={style.text}>Sign message</Text>
    </Pressable>
  );
}

const style = StyleSheet.create({
  buttonContainer: {
    margin: 8,
    borderColor: 'white',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  text: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
