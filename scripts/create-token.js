const ConfigStore = require('configstore');

const sanityEnv = (process.env.SANITY_INTERNAL_ENV || '').toLowerCase();

module.exports = function createToken() {
  const config = new ConfigStore(
    sanityEnv && sanityEnv !== 'production' ? `sanity-${sanityEnv}` : 'sanity',
    {},
    { globalConfigPath: true },
  );

  return config.get('authToken');
};
