import { Text, type ColorValue } from 'react-native';

/**
 * Material Symbols code points. The font is loaded in the root layout and used on every
 * platform, so the phone shows the same icons as the browser.
 */
export const Icons = {
  dashboard: 0xe871,
  trips: 0xeacd, // route
  fleet: 0xe558, // local_shipping
  clients: 0xebcb, // handshake
  bell: 0xe7f4, // notifications
  plus: 0xe145, // add
  search: 0xe8b6,
  warning: 0xe002,
  check: 0xe86c, // check_circle
  chevron: 0xe5cc, // chevron_right
} as const;

export const IconFont = 'MaterialSymbols_400Regular';

export function Icon({ name, size = 22, color }: { name: keyof typeof Icons; size?: number; color: ColorValue }) {
  return (
    <Text
      accessible={false}
      allowFontScaling={false}
      style={{ fontFamily: IconFont, fontSize: size, lineHeight: size, width: size, height: size, color, textAlign: 'center' }}>
      {String.fromCharCode(Icons[name])}
    </Text>
  );
}
