import React, { useState } from 'react';
import {
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { S, T } from '../../src/constants/theme';

type Props = Pick<
  TextInputProps,
  'value' | 'onChangeText' | 'placeholder' | 'placeholderTextColor' | 'onFocus' | 'onBlur' | 'accessibilityLabel'
> & {
  focused?: boolean;
  hasError?: boolean;
  containerStyle: StyleProp<ViewStyle>;
  focusedStyle?: StyleProp<ViewStyle>;
  errorStyle?: StyleProp<ViewStyle>;
  inputStyle: StyleProp<TextStyle>;
  iconStyle?: StyleProp<TextStyle>;
  iconName?: React.ComponentProps<typeof Feather>['name'];
};

export default function SecureTextField({
  value,
  onChangeText,
  placeholder,
  placeholderTextColor = T.ink5,
  onFocus,
  onBlur,
  accessibilityLabel = 'Password',
  focused,
  hasError,
  containerStyle,
  focusedStyle,
  errorStyle,
  inputStyle,
  iconStyle,
  iconName = 'lock',
}: Props) {
  const [hidden, setHidden] = useState(true);
  const toggleLabel = hidden ? 'Show password' : 'Hide password';

  return (
    <View style={[containerStyle, focused && focusedStyle, hasError && errorStyle]}>
      <Feather
        name={iconName}
        size={18}
        color={focused ? T.violet : T.inputIconDefault}
        style={iconStyle}
      />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={hidden}
        style={inputStyle}
        onFocus={onFocus}
        onBlur={onBlur}
        accessibilityLabel={accessibilityLabel}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="password"
      />
      <TouchableOpacity
        onPress={() => setHidden((current) => !current)}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel={toggleLabel}
        style={styles.eyeButton}
        activeOpacity={0.7}
      >
        <Feather name={hidden ? 'eye' : 'eye-off'} size={18} color={T.ink4} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  eyeButton: {
    width: 34,
    height: '100%',
    marginRight: -S.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
