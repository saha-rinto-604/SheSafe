const googleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';

function withoutReactNativeMapsPlugin(plugin) {
  return Array.isArray(plugin) ? plugin[0] !== 'react-native-maps' : plugin !== 'react-native-maps';
}

module.exports = ({ config }) => {
  const plugins = (config.plugins || [])
    .filter(withoutReactNativeMapsPlugin)
    .filter((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) !== 'expo-camera')
    .filter((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) !== 'expo-video')
    .filter((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) !== '@config-plugins/react-native-webrtc');

  return {
    ...config,
    plugins: [
      ...plugins,
      [
        'expo-camera',
        {
          cameraPermission: 'SheSafe needs camera access to record Live Safety Video during an active SOS.',
          microphonePermission: 'SheSafe needs microphone access to include audio in Live Safety Video.',
          recordAudioAndroid: true,
        },
      ],
      'expo-video',
      '@config-plugins/react-native-webrtc',
      [
        'react-native-maps',
        {
          androidGoogleMapsApiKey: googleMapsApiKey,
          iosGoogleMapsApiKey: googleMapsApiKey,
        },
      ],
    ],
  };
};
