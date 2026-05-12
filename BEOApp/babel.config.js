module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      // Worklets plugin (Reanimated 4 split it out). Must be last.
      'react-native-worklets/plugin',
    ],
  };
};
