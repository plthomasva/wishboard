import base from './vite.config.ts';
import { mergeConfig } from 'vite';

export default mergeConfig(base, {
  test: {
    include: ['src/client/src/passphrase.test.ts']
  }
});
