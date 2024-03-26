// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config({
  files: [
    './src/*.ts',
    './tests/*.ts',
  ],
  extends: [
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': 'off',
  },
});
