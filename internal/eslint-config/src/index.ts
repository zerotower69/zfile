export default {
  env: {
    // browser: true,
    node: true,
    es6: true,
  },
  root:true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  plugins: [
    "@typescript-eslint",
    "import"
  ],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    'plugin:prettier/recommended',
  ],
  rules:{
    "@typescript-eslint/no-explicit-any":"off",
    "no-console":"off",
    'no-unused-vars': 'off',
    'no-case-declarations': 'off',
    'no-use-before-define': 'off',
    'space-before-function-paren': 'off',
    'import/first': 'error',
    'import/newline-after-import': 'error',
    'import/no-duplicates': 'error',
    '@typescript-eslint/no-unused-vars':"off",
    '@typescript-eslint/ban-ts-ignore': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-use-before-define': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
  }
}
